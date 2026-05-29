import { z } from "zod";

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
  issuedAt: z.number().int().positive(),
  sequence: z.number().int().nonnegative()
});
export type SyncCommand = z.infer<typeof syncCommandSchema>;

export const extensionPairRequestSchema = z.object({
  type: z.literal("PAIR_ROOM"),
  roomId: z.string().min(8),
  participantId: z.string().min(8),
  sessionToken: z.string().min(24),
  appOrigin: z.string().url()
});
export type ExtensionPairRequest = z.infer<typeof extensionPairRequestSchema>;

export const extensionMessageSchema = z.discriminatedUnion("type", [
  extensionPairRequestSchema,
  z.object({
    type: z.literal("UNPAIR_ROOM")
  }),
  z.object({
    type: z.literal("PLAYBACK_STATE"),
    state: playbackStateSchema
  }),
  z.object({
    type: z.literal("APPLY_SYNC_COMMAND"),
    command: syncCommandSchema
  })
]);
export type ExtensionMessage = z.infer<typeof extensionMessageSchema>;

export const roomEventSchema = z.discriminatedUnion("type", [
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
    state: playbackStateSchema
  }),
  z.object({
    type: z.literal("sync.command"),
    command: syncCommandSchema
  }),
  z.object({
    type: z.literal("sync.error"),
    roomId: z.string(),
    reason: z.string().max(160)
  })
]);
export type RoomEvent = z.infer<typeof roomEventSchema>;

export function parseJsonWithSchema<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return schema.parse(input);
}
