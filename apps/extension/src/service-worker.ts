import {
  extensionPairRequestSchema,
  playbackStateSchema,
  syncCommandSchema
} from "@cueroom/shared";

const allowedOrigins = new Set(["http://localhost:3000", "https://cueroom.app"]);

type PairedRoom = {
  roomId: string;
  participantId: string;
  sessionToken: string;
  appOrigin: string;
  pairedAt: number;
  tabId: number | null;
  lastCommandSequence: number;
};

async function getPairing(): Promise<PairedRoom | null> {
  const stored = await chrome.storage.local.get("pairedRoom");
  return (stored["pairedRoom"] as PairedRoom | undefined) ?? null;
}

async function setPairing(pairing: PairedRoom | null) {
  if (!pairing) {
    await chrome.storage.local.remove("pairedRoom");
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
    if (!senderOrigin || senderOrigin !== new URL(parsedPair.data.appOrigin).origin) {
      sendResponse({ ok: false, error: "Pairing origin mismatch" });
      return false;
    }
    void findActiveNetflixTab().then((tab) =>
      setPairing({
        roomId: parsedPair.data.roomId,
        participantId: parsedPair.data.participantId,
        sessionToken: parsedPair.data.sessionToken,
        appOrigin: parsedPair.data.appOrigin,
        pairedAt: Date.now(),
        tabId: tab?.id ?? null,
        lastCommandSequence: -1
      }).then(() => sendResponse({ ok: true, tabPaired: Boolean(tab?.id) }))
    );
    return true;
  }

  if (isUnpairMessage(message)) {
    void setPairing(null).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (isStatusMessage(message)) {
    void Promise.all([getPairing(), chrome.storage.local.get("latestPlaybackState")]).then(
      ([pairing, stored]) =>
        sendResponse({
          ok: true,
          pairedRoomId: pairing?.roomId ?? null,
          playbackState: stored["latestPlaybackState"] ?? null
        })
    );
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
      if (originFromUrl(sender.url) !== new URL(pairing.appOrigin).origin) {
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
      if (parsedCommand.data.sequence <= pairing.lastCommandSequence) {
        sendResponse({ ok: false, error: "Replay detected" });
        return;
      }
      const target = await findPairedTab(pairing);
      if (!target?.id) {
        sendResponse({ ok: false, error: "No Netflix watch tab found" });
        return;
      }
      void chrome.tabs
        .sendMessage(target.id, { type: "APPLY_SYNC_COMMAND", command: parsedCommand.data })
        .then(() =>
          setPairing({
            ...pairing,
            tabId: target.id ?? pairing.tabId,
            lastCommandSequence: parsedCommand.data.sequence
          }).then(() => sendResponse({ ok: true }))
        )
        .catch(() => sendResponse({ ok: false, error: "Unable to reach Netflix tab" }));
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
    sendResponse({ ok: true, paired: Boolean(pairing) });
  });

  return true;
});
