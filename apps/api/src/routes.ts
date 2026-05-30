import type { FastifyInstance } from "fastify";
import {
  createRoomRequestSchema,
  joinRoomRequestSchema,
  liveKitTokenRequestSchema,
  roomEventSchema,
  roomReportRequestSchema,
  roomSocketClientMessageSchema,
  syncCommandSchema
} from "@cueroom/shared";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";
import { createLiveKitToken, removeLiveKitParticipant } from "./livekit.js";
import type { AuthSession, AuthStore } from "./auth-store.js";
import type { ActiveSession, RoomStore } from "./room-store.js";
import { decideFollowerSync, type AuthoritativePlaybackState } from "./sync-policy.js";

const sessionBodySchema = z.object({
  sessionToken: z.string().min(24)
});

const kickBodySchema = sessionBodySchema.extend({
  participantId: z.string().min(8)
});

const magicLinkRequestSchema = z.object({
  email: z.string().email().max(254),
  displayName: z.string().min(1).max(48).optional()
});

const magicLinkVerifySchema = z.object({
  token: z.string().startsWith("cml_").min(24)
});

const passkeyEmailSchema = z.object({
  email: z.string().email().max(254)
});

const passkeyRegistrationVerifySchema = z.object({
  response: z.record(z.unknown())
});

const passkeyAuthenticationVerifySchema = passkeyEmailSchema.extend({
  response: z.record(z.unknown())
});

const authRequestRateLimit = {
  config: {
    rateLimit: {
      max: 20,
      timeWindow: "1 minute"
    }
  }
} as const;

const authVerifyRateLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: "1 minute"
    }
  }
} as const;

const tokenMintRateLimit = {
  config: {
    rateLimit: {
      max: 30,
      timeWindow: "1 minute"
    }
  }
} as const;

const roomReportRateLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: "1 minute"
    }
  }
} as const;

const roomCreateRateLimit = {
  config: {
    rateLimit: {
      max: 20,
      timeWindow: "1 minute"
    }
  }
} as const;

const roomJoinRateLimit = {
  config: {
    rateLimit: {
      max: 30,
      timeWindow: "1 minute"
    }
  }
} as const;

const roomReadRateLimit = {
  config: {
    rateLimit: {
      max: 60,
      timeWindow: "1 minute"
    }
  }
} as const;

const roomControlRateLimit = {
  config: {
    rateLimit: {
      max: 30,
      timeWindow: "1 minute"
    }
  }
} as const;

const syncCommandRateLimit = {
  config: {
    rateLimit: {
      max: 60,
      timeWindow: "1 minute"
    }
  }
} as const;

const realtimeHandshakeRateLimit = {
  websocket: true,
  config: {
    rateLimit: {
      max: 30,
      timeWindow: "1 minute"
    }
  }
} as const;

type RegisterRoutesOptions = {
  removeLiveKitParticipant?: (roomId: string, participantId: string) => Promise<void>;
  checkDependencies?: () => Promise<void>;
};

export function registerRoutes(
  server: FastifyInstance,
  store: RoomStore,
  authStore: AuthStore,
  options: RegisterRoutesOptions = {}
) {
  const realtimeRooms = new Map<string, Set<RealtimeClient>>();
  const authoritativePlaybackByRoom = new Map<string, AuthoritativePlaybackState>();
  const removeParticipantFromLiveKit = options.removeLiveKitParticipant ?? removeLiveKitParticipant;

  server.get("/health", async (_request, reply) => {
    try {
      await options.checkDependencies?.();
    } catch {
      return reply.code(503).send({
        ok: false,
        service: "cueroom-api"
      });
    }

    return {
      ok: true,
      service: "cueroom-api"
    };
  });

  server.post("/v1/auth/magic-link/request", authRequestRateLimit, async (request, reply) => {
    const parsed = magicLinkRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid magic link request", details: parsed.error.flatten() });
    }
    const input = {
      email: parsed.data.email,
      ...(parsed.data.displayName ? { displayName: parsed.data.displayName } : {})
    };
    try {
      return await authStore.requestMagicLink(input);
    } catch (error) {
      request.log.error({ err: error }, "Failed to deliver magic link");
      return reply.code(502).send({ error: "Magic link delivery unavailable" });
    }
  });

  server.post("/v1/auth/magic-link/verify", authVerifyRateLimit, async (request, reply) => {
    const parsed = magicLinkVerifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid magic link verification", details: parsed.error.flatten() });
    }
    const result = await authStore.verifyMagicLink(parsed.data.token);
    if ("error" in result) {
      return reply.code(403).send(result);
    }
    return publicAuthSession(result);
  });

  server.get("/v1/auth/me", authRequestRateLimit, async (request, reply) => {
    const account = await requireAccountSession(request, authStore);
    if (!account) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    return { account };
  });

  server.post(
    "/v1/auth/passkeys/registration/options",
    authRequestRateLimit,
    async (request, reply) => {
      const accountSessionToken = getAccountBearerToken(request);
      if (!accountSessionToken) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const result = await authStore.createPasskeyRegistrationOptions(accountSessionToken);
      if ("error" in result) {
        return reply.code(403).send(result);
      }
      return result;
    }
  );

  server.post(
    "/v1/auth/passkeys/registration/verify",
    authVerifyRateLimit,
    async (request, reply) => {
      const accountSessionToken = getAccountBearerToken(request);
      if (!accountSessionToken) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const parsed = passkeyRegistrationVerifySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Invalid passkey registration", details: parsed.error.flatten() });
      }
      const result = await authStore.verifyPasskeyRegistration(
        accountSessionToken,
        parsed.data.response as unknown as RegistrationResponseJSON
      );
      if ("error" in result) {
        return reply.code(403).send(result);
      }
      return result;
    }
  );

  server.post(
    "/v1/auth/passkeys/authentication/options",
    authRequestRateLimit,
    async (request, reply) => {
      const parsed = passkeyEmailSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Invalid passkey request", details: parsed.error.flatten() });
      }
      return authStore.createPasskeyAuthenticationOptions(parsed.data.email);
    }
  );

  server.post(
    "/v1/auth/passkeys/authentication/verify",
    authVerifyRateLimit,
    async (request, reply) => {
      const parsed = passkeyAuthenticationVerifySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Invalid passkey authentication", details: parsed.error.flatten() });
      }
      const result = await authStore.verifyPasskeyAuthentication(
        parsed.data.email,
        parsed.data.response as unknown as AuthenticationResponseJSON
      );
      if ("error" in result) {
        return reply.code(403).send(result);
      }
      return publicAuthSession(result);
    }
  );

  server.post("/v1/rooms", roomCreateRateLimit, async (request, reply) => {
    const parsed = createRoomRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid room request", details: parsed.error.flatten() });
    }
    const account = await getOptionalAccountSession(request, authStore);
    if (process.env.AUTH_REQUIRED === "true" && !account) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    return store.createRoom({ ...parsed.data, ...(account ? { accountId: account.id } : {}) });
  });

  server.get("/v1/rooms/:roomId", roomReadRateLimit, async (request, reply) => {
    const { roomId } = z.object({ roomId: z.string().min(8) }).parse(request.params);
    const authHeader = request.headers.authorization;
    const sessionToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";
    const activeSession = await store.requireSession(roomId, sessionToken);
    if (!activeSession) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const { inviteCode: _inviteCode, ...safeRoom } = activeSession.room;
    return { room: safeRoom, participant: activeSession.participant };
  });

  server.post("/v1/rooms/join", roomJoinRateLimit, async (request, reply) => {
    const parsed = joinRoomRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid join request", details: parsed.error.flatten() });
    }
    const result = await store.joinRoom(parsed.data);
    if ("error" in result) {
      return reply.code(403).send(result);
    }
    return result;
  });

  server.post("/v1/rooms/:roomId/lock", roomControlRateLimit, async (request, reply) => {
    const { roomId } = z.object({ roomId: z.string().min(8) }).parse(request.params);
    const body = sessionBodySchema.extend({ locked: z.boolean() }).safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid lock request", details: body.error.flatten() });
    }
    const result = await store.setLocked(roomId, body.data.sessionToken, body.data.locked);
    if ("error" in result) {
      return reply.code(403).send(result);
    }
    return result;
  });

  server.post("/v1/rooms/:roomId/kick", roomControlRateLimit, async (request, reply) => {
    const { roomId } = z.object({ roomId: z.string().min(8) }).parse(request.params);
    const body = kickBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid kick request", details: body.error.flatten() });
    }
    const result = await store.kick(roomId, body.data.sessionToken, body.data.participantId);
    if ("error" in result) {
      return reply.code(403).send(result);
    }
    const liveKitRemovalPromises = result.removedParticipantIds.map((participantId) =>
      removeParticipantFromLiveKit(roomId, participantId)
    );
    closeRealtimeParticipants(realtimeRooms, roomId, result.removedParticipantIds);
    const liveKitRemovals = await Promise.allSettled(liveKitRemovalPromises);
    if (liveKitRemovals.some((entry) => entry.status === "rejected")) {
      request.log.error(
        {
          roomId,
          participantIds: result.removedParticipantIds
        },
        "Failed to remove kicked participant from LiveKit"
      );
      return reply.code(502).send({
        error: "Participant removed from room, but call removal failed"
      });
    }
    return result;
  });

  server.post("/v1/rooms/:roomId/rotate-invite", roomControlRateLimit, async (request, reply) => {
    const { roomId } = z.object({ roomId: z.string().min(8) }).parse(request.params);
    const body = sessionBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .code(400)
        .send({ error: "Invalid rotate request", details: body.error.flatten() });
    }
    const result = await store.rotateInvite(roomId, body.data.sessionToken);
    if ("error" in result) {
      return reply.code(403).send(result);
    }
    return result;
  });

  server.post("/v1/rooms/:roomId/report", roomReportRateLimit, async (request, reply) => {
    const { roomId } = z.object({ roomId: z.string().min(8) }).parse(request.params);
    const body = roomReportRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .code(400)
        .send({ error: "Invalid report request", details: body.error.flatten() });
    }
    const result = await store.reportParticipant(roomId, body.data.sessionToken, {
      targetParticipantId: body.data.targetParticipantId,
      reason: body.data.reason,
      ...(body.data.details ? { details: body.data.details } : {})
    });
    if ("error" in result) {
      return reply.code(403).send(result);
    }
    request.log.warn(
      {
        reportId: result.report.id,
        roomId,
        reporterParticipantId: result.report.reporterParticipantId,
        targetParticipantId: result.report.targetParticipantId,
        reason: result.report.reason
      },
      "Room participant reported"
    );
    return result;
  });

  server.post("/v1/livekit/token", tokenMintRateLimit, async (request, reply) => {
    const parsed = liveKitTokenRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid token request", details: parsed.error.flatten() });
    }
    const activeSession = await store.requireSession(parsed.data.roomId, parsed.data.sessionToken);
    if (!activeSession || activeSession.participant.id !== parsed.data.participantId) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const token = await createLiveKitToken(activeSession.room, activeSession.participant);
    return {
      url: process.env.LIVEKIT_URL ?? "ws://localhost:7880",
      token
    };
  });

  server.post("/v1/rooms/:roomId/sync-command", syncCommandRateLimit, async (request, reply) => {
    const { roomId } = z.object({ roomId: z.string().min(8) }).parse(request.params);
    const body = z
      .object({
        sessionToken: z.string().min(24),
        command: syncCommandSchema
      })
      .safeParse(request.body);

    if (!body.success) {
      return reply.code(400).send({ error: "Invalid sync command", details: body.error.flatten() });
    }

    const result = await store.acceptSyncCommand(roomId, body.data.sessionToken, body.data.command);
    if ("error" in result) {
      return reply.code(403).send(result);
    }
    return result;
  });

  server.get("/v1/rooms/:roomId/realtime", realtimeHandshakeRateLimit, (socket, request) => {
    const params = z.object({ roomId: z.string().min(8) }).safeParse(request.params);
    if (!params.success) {
      socket.close(1008, "Invalid room");
      return;
    }
    const roomId = params.data.roomId;

    let client: RealtimeClient | null = null;
    const authTimeout = setTimeout(() => {
      if (!client) {
        socket.close(1008, "Authentication required");
      }
    }, 5_000);
    const realtimeRateLimiter = createRealtimeRateLimiter();

    socket.on("message", (rawMessage: unknown) => {
      if (!realtimeRateLimiter.consume()) {
        socket.close(1008, "Rate limit exceeded");
        return;
      }
      void handleRealtimeMessage(rawMessage);
    });

    socket.on("close", () => {
      clearTimeout(authTimeout);
      if (client) {
        const wasPresent = removeRealtimeClient(realtimeRooms, client);
        if (client.role === "host") {
          authoritativePlaybackByRoom.delete(client.roomId);
        }
        if (wasPresent) {
          broadcastRealtime(realtimeRooms, client.roomId, {
            type: "presence.left",
            roomId: client.roomId,
            participantId: client.participantId
          });
        }
      }
    });

    async function handleRealtimeMessage(rawMessage: unknown) {
      const parsedMessage = parseSocketMessage(rawMessage);
      if (!parsedMessage.ok) {
        sendRealtime(client, {
          type: "sync.error",
          roomId,
          reason: parsedMessage.error
        });
        return;
      }

      const parsed = roomSocketClientMessageSchema.safeParse(parsedMessage.value);
      if (!parsed.success) {
        sendRealtime(client, {
          type: "sync.error",
          roomId,
          reason: "Invalid realtime message"
        });
        return;
      }

      if (parsed.data.type === "room.auth") {
        if (client) {
          sendRealtime(client, {
            type: "sync.error",
            roomId,
            reason: "Already authenticated"
          });
          return;
        }
        if (parsed.data.roomId !== roomId) {
          socket.close(1008, "Room mismatch");
          return;
        }
        const activeSession = await store.requireSession(
          parsed.data.roomId,
          parsed.data.sessionToken
        );
        if (!activeSession || activeSession.participant.id !== parsed.data.participantId) {
          socket.close(1008, "Forbidden");
          return;
        }
        client = {
          roomId: activeSession.room.id,
          participantId: activeSession.participant.id,
          role: activeSession.participant.role,
          sessionToken: parsed.data.sessionToken,
          socket
        };
        addRealtimeClient(realtimeRooms, client);
        clearTimeout(authTimeout);
        sendRealtime(client, {
          type: "room.ready",
          roomId: client.roomId,
          participantId: client.participantId,
          role: client.role
        });
        broadcastRealtime(
          realtimeRooms,
          client.roomId,
          {
            type: "presence.joined",
            roomId: client.roomId,
            participantId: client.participantId,
            displayName: activeSession.participant.displayName
          },
          client
        );
        return;
      }

      if (!client) {
        socket.close(1008, "Authentication required");
        return;
      }

      const activeSession = await store.requireSession(client.roomId, client.sessionToken);
      if (!activeSession || activeSession.participant.id !== client.participantId) {
        socket.close(1008, "Forbidden");
        return;
      }
      if (client.role === "host" && activeSession.participant.role !== "host") {
        authoritativePlaybackByRoom.delete(client.roomId);
      }
      client.role = activeSession.participant.role;

      if (parsed.data.type === "ping") {
        sendRealtime(client, {
          type: "pong",
          sentAt: parsed.data.sentAt,
          receivedAt: Date.now()
        });
        return;
      }

      if (
        "roomId" in parsed.data &&
        (parsed.data.roomId !== client.roomId || parsed.data.participantId !== client.participantId)
      ) {
        sendRealtime(client, {
          type: "sync.error",
          roomId: client.roomId,
          reason: "Realtime actor mismatch"
        });
        return;
      }

      if (parsed.data.type === "sync.state") {
        if (client.role === "host") {
          authoritativePlaybackByRoom.set(client.roomId, {
            participantId: client.participantId,
            state: parsed.data.state
          });
        } else {
          const authority = authoritativePlaybackByRoom.get(client.roomId);
          if (authority) {
            const decision = decideFollowerSync({
              roomId: client.roomId,
              participantId: client.participantId,
              authority,
              followerState: parsed.data.state,
              now: Date.now()
            });
            if (decision.warning) {
              sendRealtime(client, {
                type: "sync.warning",
                warning: decision.warning
              });
            } else if (decision.correction) {
              sendRealtime(client, {
                type: "sync.correction",
                correction: decision.correction
              });
            }
          }
        }

        broadcastRealtime(realtimeRooms, client.roomId, {
          type: "sync.state",
          roomId: client.roomId,
          participantId: client.participantId,
          role: client.role,
          state: parsed.data.state
        });
        return;
      }

      const result = await store.acceptSyncCommand(
        client.roomId,
        client.sessionToken,
        parsed.data.command
      );
      if ("error" in result) {
        sendRealtime(client, {
          type: "sync.error",
          roomId: client.roomId,
          reason: result.error
        });
        return;
      }
      broadcastRealtime(realtimeRooms, client.roomId, {
        type: "sync.command",
        command: result.command
      });
    }
  });
}

type RealtimeSocket = {
  close(code?: number, data?: string): void;
  on(event: "message", listener: (data: unknown) => void): void;
  on(event: "close", listener: () => void): void;
  readyState: number;
  send(data: string): void;
};

type RealtimeClient = Pick<ActiveSession["participant"], "role"> & {
  roomId: string;
  participantId: string;
  sessionToken: string;
  socket: RealtimeSocket;
};

function addRealtimeClient(rooms: Map<string, Set<RealtimeClient>>, client: RealtimeClient) {
  const clients = rooms.get(client.roomId) ?? new Set<RealtimeClient>();
  clients.add(client);
  rooms.set(client.roomId, clients);
}

function removeRealtimeClient(rooms: Map<string, Set<RealtimeClient>>, client: RealtimeClient) {
  const clients = rooms.get(client.roomId);
  if (!clients) {
    return false;
  }
  const wasPresent = clients.delete(client);
  if (clients.size === 0) {
    rooms.delete(client.roomId);
  }
  return wasPresent;
}

function closeRealtimeParticipants(
  rooms: Map<string, Set<RealtimeClient>>,
  roomId: string,
  participantIds: string[]
) {
  const removed = new Set(participantIds);
  for (const client of [...(rooms.get(roomId) ?? [])]) {
    if (removed.has(client.participantId)) {
      const wasPresent = removeRealtimeClient(rooms, client);
      client.socket.close(1008, "Removed from room");
      if (wasPresent) {
        broadcastRealtime(rooms, roomId, {
          type: "presence.left",
          roomId,
          participantId: client.participantId
        });
      }
    }
  }
}

function broadcastRealtime(
  rooms: Map<string, Set<RealtimeClient>>,
  roomId: string,
  event: unknown,
  except?: RealtimeClient
) {
  for (const client of rooms.get(roomId) ?? []) {
    if (client !== except) {
      sendRealtime(client, event);
    }
  }
}

function sendRealtime(client: RealtimeClient | null, event: unknown) {
  if (!client || client.socket.readyState !== 1) {
    return;
  }
  const parsed = roomEventSchema.safeParse(event);
  if (!parsed.success) {
    client.socket.send(
      JSON.stringify({
        type: "sync.error",
        roomId: client.roomId,
        reason: "Invalid realtime event"
      })
    );
    return;
  }
  client.socket.send(JSON.stringify(parsed.data));
}

function createRealtimeRateLimiter() {
  const windowMs = 1_000;
  const maxMessages = 30;
  let windowStartedAt = Date.now();
  let count = 0;

  return {
    consume() {
      const now = Date.now();
      if (now - windowStartedAt >= windowMs) {
        windowStartedAt = now;
        count = 0;
      }
      count += 1;
      return count <= maxMessages;
    }
  };
}

function parseSocketMessage(
  rawMessage: unknown
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    const text =
      typeof rawMessage === "string"
        ? rawMessage
        : rawMessage instanceof Buffer
          ? rawMessage.toString("utf8")
          : String(rawMessage);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "Malformed realtime message" };
  }
}

function getBearerToken(request: { headers: { authorization?: string | undefined } }) {
  const authHeader = request.headers.authorization;
  return authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
}

function getAccountBearerToken(request: { headers: { authorization?: string | undefined } }) {
  const token = getBearerToken(request);
  return token.startsWith("cas_") ? token : "";
}

async function requireAccountSession(
  request: { headers: { authorization?: string | undefined } },
  authStore: AuthStore
) {
  const sessionToken = getAccountBearerToken(request);
  return sessionToken ? authStore.requireSession(sessionToken) : null;
}

async function getOptionalAccountSession(
  request: { headers: { authorization?: string | undefined } },
  authStore: AuthStore
) {
  try {
    return await requireAccountSession(request, authStore);
  } catch {
    return null;
  }
}

function publicAuthSession(session: AuthSession) {
  return {
    account: session.account,
    accountSessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
    authMethod: session.authMethod
  };
}
