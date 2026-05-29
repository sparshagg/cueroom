import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import type { Participant, Room } from "@cueroom/shared";

type LiveKitConfig = {
  url: string;
  apiKey: string;
  apiSecret: string;
};

export async function createLiveKitToken(room: Room, participant: Participant) {
  const { apiKey, apiSecret } = requireLiveKitTokenConfig();

  const token = new AccessToken(apiKey, apiSecret, {
    identity: participant.id,
    name: participant.displayName,
    ttl: "10m"
  });

  token.addGrant({
    room: room.id,
    roomJoin: true,
    canPublish: true,
    canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
    canSubscribe: true,
    canPublishData: false
  });

  return token.toJwt();
}

export async function removeLiveKitParticipant(roomId: string, participantId: string) {
  const config = getOptionalLiveKitConfig();
  if (!config) {
    return;
  }

  const serviceUrl = config.url.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
  const client = new RoomServiceClient(serviceUrl, config.apiKey, config.apiSecret);
  await client.removeParticipant(roomId, participantId);
}

export function validateLiveKitConfig() {
  if (process.env.NODE_ENV === "production") {
    requireLiveKitConfig();
    return;
  }
  getOptionalLiveKitConfig();
}

function requireLiveKitTokenConfig() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required");
  }

  return { apiKey, apiSecret };
}

function requireLiveKitConfig(): LiveKitConfig {
  const url = process.env.LIVEKIT_URL;
  const { apiKey, apiSecret } = requireLiveKitTokenConfig();
  if (!url) {
    throw new Error("LIVEKIT_URL is required");
  }
  return { url, apiKey, apiSecret };
}

function getOptionalLiveKitConfig(): LiveKitConfig | null {
  const values = [
    process.env.LIVEKIT_URL,
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET
  ];
  if (values.every(Boolean)) {
    return requireLiveKitConfig();
  }
  if (values.some(Boolean)) {
    throw new Error(
      "LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be configured together"
    );
  }
  return null;
}
