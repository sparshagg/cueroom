import type { FastifyInstance } from "fastify";
import {
  createRoomRequestSchema,
  joinRoomRequestSchema,
  liveKitTokenRequestSchema,
  syncCommandSchema
} from "@cueroom/shared";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";
import { createLiveKitToken, removeLiveKitParticipant } from "./livekit.js";
import type { AuthSession, AuthStore } from "./auth-store.js";
import type { RoomStore } from "./room-store.js";

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

export function registerRoutes(server: FastifyInstance, store: RoomStore, authStore: AuthStore) {
  server.get("/health", async () => ({
    ok: true,
    service: "cueroom-api"
  }));

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
    return authStore.requestMagicLink(input);
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

  server.post("/v1/rooms", async (request, reply) => {
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

  server.get("/v1/rooms/:roomId", async (request, reply) => {
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

  server.post("/v1/rooms/join", async (request, reply) => {
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

  server.post("/v1/rooms/:roomId/lock", async (request, reply) => {
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

  server.post("/v1/rooms/:roomId/kick", async (request, reply) => {
    const { roomId } = z.object({ roomId: z.string().min(8) }).parse(request.params);
    const body = kickBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid kick request", details: body.error.flatten() });
    }
    const result = await store.kick(roomId, body.data.sessionToken, body.data.participantId);
    if ("error" in result) {
      return reply.code(403).send(result);
    }
    await Promise.allSettled(
      result.removedParticipantIds.map((participantId) =>
        removeLiveKitParticipant(roomId, participantId)
      )
    );
    return result;
  });

  server.post("/v1/rooms/:roomId/rotate-invite", async (request, reply) => {
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

  server.post("/v1/rooms/:roomId/sync-command", async (request, reply) => {
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
