import { z } from "zod";
import { roomRoleSchema } from "./rooms.js";

export const playbackStateSchema = z.object({
  watchId: z.string().min(1).max(256),
  titleHint: z.string().max(160).optional(),
  url: z.string().url(),
  paused: z.boolean(),
  currentTime: z.number().finite().min(0),
  duration: z.number().finite().min(0),
  playbackRate: z.number().finite().min(0.25).max(3),
  buffering: z.boolean(),
  observedAt: z.number().int().positive(),
  sequence: z.number().int().nonnegative()
});
export type PlaybackState = z.infer<typeof playbackStateSchema>;

export const syncCommandSchema = z.object({
  roomId: z.string().min(8),
  actorId: z.string().min(8),
  command: z.enum(["play", "pause", "seek", "catch-up"]),
  position: z.number().finite().min(0).optional(),
  playbackRate: z.number().finite().min(0.25).max(3).optional(),
  issuedAt: z.number().int().positive(),
  sequence: z.number().int().nonnegative()
});
export type SyncCommand = z.infer<typeof syncCommandSchema>;

export const syncCorrectionSchema = z.object({
  roomId: z.string().min(8),
  participantId: z.string().min(8),
  authorityParticipantId: z.string().min(8),
  watchId: z.string().min(1).max(256),
  command: z.enum(["pause", "catch-up"]),
  position: z.number().finite().min(0).optional(),
  playbackRate: z.number().finite().min(0.25).max(3).optional(),
  driftSeconds: z.number().finite(),
  issuedAt: z.number().int().positive()
});
export type SyncCorrection = z.infer<typeof syncCorrectionSchema>;

export const syncWarningSchema = z.object({
  type: z.literal("wrong-title"),
  roomId: z.string().min(8),
  participantId: z.string().min(8),
  expectedWatchId: z.string().min(1).max(256),
  expectedTitleHint: z.string().max(160).optional(),
  expectedUrl: z.string().url(),
  currentWatchId: z.string().min(1).max(256),
  currentTitleHint: z.string().max(160).optional(),
  detectedAt: z.number().int().positive()
});
export type SyncWarning = z.infer<typeof syncWarningSchema>;

export const extensionPairRequestSchema = z.object({
  type: z.literal("PAIR_ROOM"),
  roomId: z.string().min(8),
  participantId: z.string().min(8),
  sessionToken: z.string().startsWith("crs_").min(24),
  appOrigin: z.string().url(),
  apiOrigin: z.string().url().optional()
});
export type ExtensionPairRequest = z.infer<typeof extensionPairRequestSchema>;

export const extensionMessageSchema = z.discriminatedUnion("type", [
  extensionPairRequestSchema,
  z.object({
    type: z.literal("UNPAIR_ROOM")
  }),
  z.object({
    type: z.literal("GET_STATUS")
  }),
  z.object({
    type: z.literal("PLAYBACK_STATE"),
    state: playbackStateSchema
  }),
  z.object({
    type: z.literal("APPLY_SYNC_COMMAND"),
    command: syncCommandSchema
  }),
  z.object({
    type: z.literal("APPLY_SYNC_CORRECTION"),
    correction: syncCorrectionSchema
  })
]);
export type ExtensionMessage = z.infer<typeof extensionMessageSchema>;

export const roomSocketAuthMessageSchema = z.object({
  type: z.literal("room.auth"),
  roomId: z.string().min(8),
  participantId: z.string().min(8),
  sessionToken: z.string().startsWith("crs_").min(24)
});

export const roomSocketPlaybackMessageSchema = z.object({
  type: z.literal("sync.state"),
  roomId: z.string().min(8),
  participantId: z.string().min(8),
  state: playbackStateSchema
});

export const roomSocketCommandMessageSchema = z.object({
  type: z.literal("sync.command"),
  command: syncCommandSchema
});

export const roomSocketPingMessageSchema = z.object({
  type: z.literal("ping"),
  sentAt: z.number().int().positive()
});

export const roomSocketClientMessageSchema = z.discriminatedUnion("type", [
  roomSocketAuthMessageSchema,
  roomSocketPlaybackMessageSchema,
  roomSocketCommandMessageSchema,
  roomSocketPingMessageSchema
]);
export type RoomSocketClientMessage = z.infer<typeof roomSocketClientMessageSchema>;

export const roomEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("room.ready"),
    roomId: z.string(),
    participantId: z.string(),
    role: roomRoleSchema
  }),
  z.object({
    type: z.literal("presence.joined"),
    roomId: z.string(),
    participantId: z.string(),
    displayName: z.string()
  }),
  z.object({
    type: z.literal("presence.left"),
    roomId: z.string(),
    participantId: z.string()
  }),
  z.object({
    type: z.literal("sync.state"),
    roomId: z.string(),
    participantId: z.string(),
    role: roomRoleSchema,
    state: playbackStateSchema
  }),
  z.object({
    type: z.literal("sync.command"),
    command: syncCommandSchema
  }),
  z.object({
    type: z.literal("sync.correction"),
    correction: syncCorrectionSchema
  }),
  z.object({
    type: z.literal("sync.warning"),
    warning: syncWarningSchema
  }),
  z.object({
    type: z.literal("sync.error"),
    roomId: z.string(),
    reason: z.string().max(160)
  }),
  z.object({
    type: z.literal("pong"),
    sentAt: z.number().int().positive(),
    receivedAt: z.number().int().positive()
  })
]);
export type RoomEvent = z.infer<typeof roomEventSchema>;

export const extensionStatusResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    pairedRoomId: z.string().nullable(),
    playbackState: playbackStateSchema.nullable(),
    realtimeConnected: z.boolean(),
    syncWarning: syncWarningSchema.nullable()
  }),
  z.object({
    ok: z.literal(false),
    error: z.string().max(160).optional()
  })
]);
export type ExtensionStatusResponse = z.infer<typeof extensionStatusResponseSchema>;

export function parseJsonWithSchema<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return schema.parse(input);
}
