import {
  extensionPairRequestSchema,
  playbackStateSchema,
  roomEventSchema,
  syncCommandSchema,
  type RoomEvent,
  type RoomSocketClientMessage
} from "@cueroom/shared";

const allowedOrigins = new Set(["http://localhost:3000", "https://cueroom.app"]);
const allowedApiOriginsByAppOrigin = new Map<string, Set<string>>([
  ["http://localhost:3000", new Set(["http://localhost:4000"])],
  ["https://cueroom.app", new Set(["https://api.cueroom.app", "https://cueroom.app"])]
]);
const realtimeKeepAliveMs = 20_000;
const latestSyncWarningKey = "latestSyncWarning";

type PairedRoom = {
  roomId: string;
  participantId: string;
  sessionToken: string;
  appOrigin: string;
  apiOrigin: string;
  pairedAt: number;
  tabId: number | null;
  lastCommandSequence: number;
};

type StoredPairedRoom = Omit<PairedRoom, "apiOrigin"> & {
  apiOrigin?: string;
};

let realtimeSocket: WebSocket | null = null;
let realtimeSocketKey: string | null = null;
let realtimeReady: Promise<WebSocket> | null = null;
let realtimeKeepAliveTimer: ReturnType<typeof setInterval> | null = null;

async function getPairing(): Promise<PairedRoom | null> {
  const stored = await chrome.storage.local.get("pairedRoom");
  const pairing = stored["pairedRoom"] as StoredPairedRoom | undefined;
  if (!pairing) {
    return null;
  }
  const apiOrigin = normalizeApiOrigin(pairing.apiOrigin, pairing.appOrigin);
  return apiOrigin ? { ...pairing, apiOrigin } : null;
}

async function setPairing(pairing: PairedRoom | null) {
  if (!pairing) {
    disconnectRealtime();
    await chrome.storage.local.remove(["pairedRoom", latestSyncWarningKey, "latestSyncCorrection"]);
    return;
  }
  await chrome.storage.local.set({ pairedRoom: pairing });
}

function originFromUrl(url: string | undefined) {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function isAllowedSender(sender: chrome.runtime.MessageSender) {
  const origin = originFromUrl(sender.url);
  return origin ? allowedOrigins.has(origin) : false;
}

function isPairedSender(sender: chrome.runtime.MessageSender, pairing: PairedRoom) {
  return originFromUrl(sender.url) === new URL(pairing.appOrigin).origin;
}

function normalizeApiOrigin(apiOrigin: string | undefined, appOrigin: string) {
  const app = originFromUrl(appOrigin);
  if (!app) {
    return null;
  }
  const configuredApiOrigin = apiOrigin?.trim() || defaultApiOrigin(app);
  try {
    const origin = new URL(configuredApiOrigin).origin;
    const allowedApiOrigins = allowedApiOriginsByAppOrigin.get(app);
    if (!allowedApiOrigins?.has(origin)) {
      return null;
    }
    return origin;
  } catch {
    return null;
  }
}

function defaultApiOrigin(appOrigin: string) {
  if (appOrigin === "http://localhost:3000") {
    return "http://localhost:4000";
  }
  return "https://api.cueroom.app";
}

function realtimeUrl(pairing: PairedRoom) {
  const url = new URL(
    `/v1/rooms/${encodeURIComponent(pairing.roomId)}/realtime`,
    pairing.apiOrigin
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function realtimeKey(pairing: PairedRoom) {
  return `${pairing.apiOrigin}|${pairing.roomId}|${pairing.participantId}`;
}

async function findActiveNetflixTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
    url: "https://www.netflix.com/watch/*"
  });
  return tabs[0] ?? null;
}

async function findPairedTab(pairing: PairedRoom) {
  if (pairing.tabId !== null) {
    const tab = await chrome.tabs.get(pairing.tabId).catch(() => null);
    if (tab?.url?.startsWith("https://www.netflix.com/watch/")) {
      return tab;
    }
  }
  return findActiveNetflixTab();
}

function isExternalCommandMessage(
  message: unknown
): message is { type: "APPLY_SYNC_COMMAND"; command: unknown } {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "APPLY_SYNC_COMMAND"
  );
}

function isUnpairMessage(message: unknown) {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "UNPAIR_ROOM"
  );
}

function isStatusMessage(message: unknown) {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "GET_STATUS"
  );
}

function isOkResponse(response: unknown) {
  return (
    typeof response === "object" && response !== null && "ok" in response && response.ok === true
  );
}

function disconnectRealtime() {
  if (realtimeKeepAliveTimer) {
    clearInterval(realtimeKeepAliveTimer);
    realtimeKeepAliveTimer = null;
  }
  realtimeSocket?.close();
  realtimeSocket = null;
  realtimeSocketKey = null;
  realtimeReady = null;
}

function startRealtimeKeepAlive(pairing: PairedRoom) {
  if (realtimeKeepAliveTimer) {
    clearInterval(realtimeKeepAliveTimer);
  }
  realtimeKeepAliveTimer = setInterval(() => {
    if (realtimeSocket?.readyState === WebSocket.OPEN) {
      sendSocketMessage(realtimeSocket, {
        type: "ping",
        sentAt: Date.now()
      });
      return;
    }
    void ensureRealtimeSocket(pairing).catch(() => undefined);
  }, realtimeKeepAliveMs);
}

function ensureRealtimeSocket(pairing: PairedRoom) {
  const key = realtimeKey(pairing);
  if (realtimeSocket?.readyState === WebSocket.OPEN && realtimeSocketKey === key) {
    return Promise.resolve(realtimeSocket);
  }
  if (
    realtimeReady &&
    realtimeSocketKey === key &&
    realtimeSocket?.readyState === WebSocket.CONNECTING
  ) {
    return realtimeReady;
  }

  disconnectRealtime();
  const socket = new WebSocket(realtimeUrl(pairing));
  realtimeSocket = socket;
  realtimeSocketKey = key;
  realtimeReady = new Promise<WebSocket>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      rejectReady(new Error("Realtime authentication timed out"));
      socket.close();
    }, 5_000);

    const resolveReady = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      startRealtimeKeepAlive(pairing);
      resolve(socket);
    };
    const rejectReady = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };

    socket.onopen = () => {
      sendSocketMessage(socket, {
        type: "room.auth",
        roomId: pairing.roomId,
        participantId: pairing.participantId,
        sessionToken: pairing.sessionToken
      });
    };
    socket.onerror = () => rejectReady(new Error("Realtime connection failed"));
    socket.onclose = () => {
      rejectReady(new Error("Realtime connection closed"));
      if (realtimeSocket === socket) {
        realtimeSocket = null;
        realtimeSocketKey = null;
        realtimeReady = null;
      }
    };
    socket.onmessage = (event) => {
      void handleRealtimeEvent(pairing, event.data, resolveReady);
    };
  });

  return realtimeReady;
}

function sendSocketMessage(socket: WebSocket, message: RoomSocketClientMessage) {
  socket.send(JSON.stringify(message));
}

async function sendRealtimeMessage(pairing: PairedRoom, message: RoomSocketClientMessage) {
  const socket = await ensureRealtimeSocket(pairing);
  if (socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  sendSocketMessage(socket, message);
  return true;
}

async function handleRealtimeEvent(pairing: PairedRoom, rawEvent: unknown, markReady: () => void) {
  const parsed = roomEventSchema.safeParse(parseJson(rawEvent));
  if (!parsed.success) {
    await chrome.storage.local.set({ latestRealtimeError: "Invalid realtime event" });
    return;
  }

  if (
    parsed.data.type === "room.ready" &&
    parsed.data.roomId === pairing.roomId &&
    parsed.data.participantId === pairing.participantId
  ) {
    markReady();
    return;
  }

  if (parsed.data.type === "sync.command") {
    await applyServerCommand(parsed.data);
    return;
  }

  if (parsed.data.type === "sync.correction") {
    await applyServerCorrection(parsed.data);
    return;
  }

  if (parsed.data.type === "sync.warning") {
    await storeServerWarning(parsed.data);
    return;
  }

  if (parsed.data.type === "sync.error") {
    await chrome.storage.local.set({
      latestRealtimeError: parsed.data.reason,
      latestRealtimeErrorAt: Date.now()
    });
  }
}

function parseJson(rawEvent: unknown) {
  try {
    return JSON.parse(typeof rawEvent === "string" ? rawEvent : String(rawEvent)) as unknown;
  } catch {
    return undefined;
  }
}

async function applyServerCommand(event: Extract<RoomEvent, { type: "sync.command" }>) {
  const pairing = await getPairing();
  if (!pairing || event.command.roomId !== pairing.roomId) {
    return;
  }
  if (event.command.sequence <= pairing.lastCommandSequence) {
    return;
  }
  const target = await findPairedTab(pairing);
  if (!target?.id) {
    await chrome.storage.local.set({
      latestRealtimeError: "No Netflix watch tab found",
      latestRealtimeErrorAt: Date.now()
    });
    return;
  }
  try {
    await chrome.tabs.sendMessage(target.id, {
      type: "APPLY_SYNC_COMMAND",
      command: event.command
    });
  } catch {
    await chrome.storage.local.set({
      latestRealtimeError: "Unable to reach Netflix tab",
      latestRealtimeErrorAt: Date.now()
    });
    return;
  }
  await setPairing({
    ...pairing,
    tabId: target.id,
    lastCommandSequence: event.command.sequence
  });
}

async function applyServerCorrection(event: Extract<RoomEvent, { type: "sync.correction" }>) {
  const pairing = await getPairing();
  if (
    !pairing ||
    event.correction.roomId !== pairing.roomId ||
    event.correction.participantId !== pairing.participantId
  ) {
    return;
  }

  const target = await findPairedTab(pairing);
  if (!target?.id) {
    await chrome.storage.local.set({
      latestRealtimeError: "No Netflix watch tab found",
      latestRealtimeErrorAt: Date.now()
    });
    return;
  }

  let response: unknown;
  try {
    response = await chrome.tabs.sendMessage(target.id, {
      type: "APPLY_SYNC_CORRECTION",
      correction: event.correction
    });
  } catch {
    await chrome.storage.local.set({
      latestRealtimeError: "Unable to reach Netflix tab",
      latestRealtimeErrorAt: Date.now()
    });
    return;
  }
  if (!isOkResponse(response)) {
    await chrome.storage.local.set({
      latestRealtimeError: "Correction skipped for active Netflix tab",
      latestRealtimeErrorAt: Date.now()
    });
    return;
  }

  await chrome.storage.local.set({
    latestSyncCorrection: {
      correctedAt: Date.now(),
      driftSeconds: event.correction.driftSeconds,
      command: event.correction.command
    }
  });
}

async function storeServerWarning(event: Extract<RoomEvent, { type: "sync.warning" }>) {
  const pairing = await getPairing();
  if (
    !pairing ||
    event.warning.roomId !== pairing.roomId ||
    event.warning.participantId !== pairing.participantId
  ) {
    return;
  }
  await chrome.storage.local.set({ [latestSyncWarningKey]: event.warning });
}

chrome.runtime.onMessageExternal.addListener((message: unknown, sender, sendResponse) => {
  if (!sender.url) {
    sendResponse({ ok: false, error: "Origin not allowed" });
    return false;
  }

  if (!isAllowedSender(sender)) {
    sendResponse({ ok: false, error: "Origin not allowed" });
    return false;
  }

  const parsedPair = extensionPairRequestSchema.safeParse(message);
  if (parsedPair.success) {
    const senderOrigin = originFromUrl(sender.url);
    const apiOrigin = normalizeApiOrigin(parsedPair.data.apiOrigin, parsedPair.data.appOrigin);
    if (!senderOrigin || senderOrigin !== new URL(parsedPair.data.appOrigin).origin) {
      sendResponse({ ok: false, error: "Pairing origin mismatch" });
      return false;
    }
    if (!apiOrigin) {
      sendResponse({ ok: false, error: "API origin not allowed" });
      return false;
    }
    void findActiveNetflixTab().then((tab) => {
      const pairing = {
        roomId: parsedPair.data.roomId,
        participantId: parsedPair.data.participantId,
        sessionToken: parsedPair.data.sessionToken,
        appOrigin: parsedPair.data.appOrigin,
        apiOrigin,
        pairedAt: Date.now(),
        tabId: tab?.id ?? null,
        lastCommandSequence: -1
      };
      return setPairing(pairing)
        .then(() => ensureRealtimeSocket(pairing))
        .then(() => sendResponse({ ok: true, tabPaired: Boolean(tab?.id), realtime: true }))
        .catch(() => sendResponse({ ok: false, error: "Realtime connection failed" }));
    });
    return true;
  }

  if (isUnpairMessage(message)) {
    void getPairing().then((pairing) => {
      if (pairing && !isPairedSender(sender, pairing)) {
        sendResponse({ ok: false, error: "Sender does not match paired origin" });
        return;
      }
      void setPairing(null).then(() => sendResponse({ ok: true }));
    });
    return true;
  }

  if (isStatusMessage(message)) {
    void Promise.all([
      getPairing(),
      chrome.storage.local.get(["latestPlaybackState", latestSyncWarningKey])
    ]).then(([pairing, stored]) => {
      if (pairing && !isPairedSender(sender, pairing)) {
        sendResponse({ ok: false, error: "Sender does not match paired origin" });
        return;
      }
      sendResponse({
        ok: true,
        pairedRoomId: pairing?.roomId ?? null,
        playbackState: stored["latestPlaybackState"] ?? null,
        realtimeConnected: realtimeSocket?.readyState === WebSocket.OPEN,
        syncWarning: stored[latestSyncWarningKey] ?? null
      });
    });
    return true;
  }

  if (isExternalCommandMessage(message)) {
    const parsedCommand = syncCommandSchema.safeParse(message.command);
    if (!parsedCommand.success) {
      sendResponse({ ok: false, error: "Invalid sync command" });
      return false;
    }
    void getPairing().then(async (pairing) => {
      if (!pairing) {
        sendResponse({ ok: false, error: "Extension is not paired" });
        return;
      }
      if (!isPairedSender(sender, pairing)) {
        sendResponse({ ok: false, error: "Sender does not match paired origin" });
        return;
      }
      if (
        parsedCommand.data.roomId !== pairing.roomId ||
        parsedCommand.data.actorId !== pairing.participantId
      ) {
        sendResponse({ ok: false, error: "Command does not match paired room" });
        return;
      }
      const relayed = await sendRealtimeMessage(pairing, {
        type: "sync.command",
        command: parsedCommand.data
      }).catch(() => false);
      sendResponse(
        relayed ? { ok: true, relayed: true } : { ok: false, error: "Realtime unavailable" }
      );
    });
    return true;
  }

  sendResponse({ ok: false, error: "Unsupported message" });
  return false;
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!sender.tab?.url?.startsWith("https://www.netflix.com/watch/")) {
    sendResponse({ ok: false, error: "Unexpected sender" });
    return false;
  }

  const parsed = playbackStateSchema.safeParse(
    typeof message === "object" && message !== null && "state" in message
      ? message.state
      : undefined
  );
  if (!parsed.success) {
    sendResponse({ ok: false, error: "Invalid playback state" });
    return false;
  }

  void getPairing().then(async (pairing) => {
    await chrome.storage.local.set({
      latestPlaybackState: {
        watchId: parsed.data.watchId,
        titleHint: parsed.data.titleHint,
        url: parsed.data.url,
        paused: parsed.data.paused,
        currentTime: parsed.data.currentTime,
        duration: parsed.data.duration,
        playbackRate: parsed.data.playbackRate,
        buffering: parsed.data.buffering,
        observedAt: parsed.data.observedAt,
        sequence: parsed.data.sequence,
        pairedRoomId: pairing?.roomId ?? null,
        receivedAt: Date.now()
      }
    });
    const stored = await chrome.storage.local.get(latestSyncWarningKey);
    const syncWarning = stored[latestSyncWarningKey] as { expectedWatchId?: string } | undefined;
    if (syncWarning?.expectedWatchId === parsed.data.watchId) {
      await chrome.storage.local.remove(latestSyncWarningKey);
    }

    const pairedTabId = sender.tab?.id ?? null;
    const shouldForward = Boolean(
      pairing && pairing.tabId !== null && pairing.tabId === pairedTabId
    );
    const realtimeForwarded =
      shouldForward && pairing
        ? await sendRealtimeMessage(pairing, {
            type: "sync.state",
            roomId: pairing.roomId,
            participantId: pairing.participantId,
            state: parsed.data
          }).catch(() => false)
        : false;

    sendResponse({
      ok: true,
      paired: Boolean(pairing),
      realtimeForwarded
    });
  });

  return true;
});
