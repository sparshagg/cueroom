import type { FastifyInstance } from "fastify";
import {
  createRoomRequestSchema,
  joinRoomRequestSchema,
  liveKitTokenRequestSchema,
  syncCommandSchema
} from "@cueroom/shared";
import { z } from "zod";
import { createLiveKitToken, removeLiveKitParticipant } from "./livekit";
import type { RoomStore } from "./room-store";

const sessionBodySchema = z.object({
  sessionToken: z.string().min(24)
});

const kickBodySchema = sessionBodySchema.extend({
  participantId: z.string().min(8)
});

export function registerRoutes(server: FastifyInstance, store: RoomStore) {
  server.get("/health", async () => ({
    ok: true,
    service: "cueroom-api"
  }));

  server.post("/v1/rooms", async (request, reply) => {
    const parsed = createRoomRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid room request", details: parsed.error.flatten() });
    }
    return store.createRoom(parsed.data);
  });

  server.get("/v1/rooms/:roomId", async (request, reply) => {
    const { roomId } = z.object({ roomId: z.string().min(8) }).parse(request.params);
    const authHeader = request.headers.authorization;
    const sessionToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";
    const activeSession = store.requireSession(roomId, sessionToken);
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
    const result = store.joinRoom(parsed.data);
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
    const result = store.setLocked(roomId, body.data.sessionToken, body.data.locked);
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
    const result = store.kick(roomId, body.data.sessionToken, body.data.participantId);
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
    const result = store.rotateInvite(roomId, body.data.sessionToken);
    if ("error" in result) {
      return reply.code(403).send(result);
    }
    return result;
  });

  server.post("/v1/livekit/token", async (request, reply) => {
    const parsed = liveKitTokenRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid token request", details: parsed.error.flatten() });
    }
    const activeSession = store.requireSession(parsed.data.roomId, parsed.data.sessionToken);
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

    const result = store.acceptSyncCommand(roomId, body.data.sessionToken, body.data.command);
    if ("error" in result) {
      return reply.code(403).send(result);
    }
    return result;
  });
}
