import { z } from "zod";

export const roomRoleSchema = z.enum(["host", "cohost", "guest"]);
export type RoomRole = z.infer<typeof roomRoleSchema>;

export const participantSchema = z.object({
  id: z.string().min(8),
  displayName: z.string().min(1).max(48),
  role: roomRoleSchema,
  joinedAt: z.string().datetime(),
  muted: z.boolean().default(false),
  cameraEnabled: z.boolean().default(true)
});
export type Participant = z.infer<typeof participantSchema>;

export const roomSchema = z.object({
  id: z.string().min(8),
  inviteCode: z.string().min(8),
  title: z.string().min(1).max(120),
  locked: z.boolean(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  participants: z.array(participantSchema)
});
export type Room = z.infer<typeof roomSchema>;

export const createRoomRequestSchema = z.object({
  hostName: z.string().min(1).max(48),
  title: z.string().min(1).max(120).default("Movie night")
});
export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>;

export const joinRoomRequestSchema = z.object({
  inviteCode: z.string().min(8),
  displayName: z.string().min(1).max(48)
});
export type JoinRoomRequest = z.infer<typeof joinRoomRequestSchema>;

export const roomSessionSchema = z.object({
  room: roomSchema,
  participant: participantSchema,
  sessionToken: z.string().startsWith("crs_").min(24)
});
export type RoomSession = z.infer<typeof roomSessionSchema>;

export const liveKitTokenRequestSchema = z.object({
  roomId: z.string().min(8),
  participantId: z.string().min(8),
  sessionToken: z.string().startsWith("crs_").min(24)
});
export type LiveKitTokenRequest = z.infer<typeof liveKitTokenRequestSchema>;

export const liveKitTokenResponseSchema = z.object({
  url: z
    .string()
    .url()
    .refine((url) => url.startsWith("ws://") || url.startsWith("wss://"), {
      message: "LiveKit URL must use ws:// or wss://"
    }),
  token: z.string().min(20)
});
export type LiveKitTokenResponse = z.infer<typeof liveKitTokenResponseSchema>;
