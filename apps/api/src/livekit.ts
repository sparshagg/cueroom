import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import type { Participant, Room } from "@cueroom/shared";

type LiveKitConfig = {
  url: string;
  apiKey: string;
  apiSecret: string;
};

export async function createLiveKitToken(room: Room, participant: Participant) {
  const { apiKey, apiSecret } = requireLiveKitTokenConfig(process.env);

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
  const config = getOptionalLiveKitConfig(process.env);
  if (!config) {
    return;
  }

  const serviceUrl = config.url.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
  const client = new RoomServiceClient(serviceUrl, config.apiKey, config.apiSecret);
  await client.removeParticipant(roomId, participantId);
}

export function validateLiveKitConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === "production") {
    const config = requireLiveKitConfig(env);
    validateProductionLiveKitConfig(config);
    return;
  }
  getOptionalLiveKitConfig(env);
}

function requireLiveKitTokenConfig(env: NodeJS.ProcessEnv) {
  const apiKey = env.LIVEKIT_API_KEY;
  const apiSecret = env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required");
  }

  return { apiKey, apiSecret };
}

function requireLiveKitConfig(env: NodeJS.ProcessEnv): LiveKitConfig {
  const url = env.LIVEKIT_URL;
  const { apiKey, apiSecret } = requireLiveKitTokenConfig(env);
  if (!url) {
    throw new Error("LIVEKIT_URL is required");
  }
  return { url, apiKey, apiSecret };
}

function getOptionalLiveKitConfig(env: NodeJS.ProcessEnv): LiveKitConfig | null {
  const values = [env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET];
  if (values.every(Boolean)) {
    return requireLiveKitConfig(env);
  }
  if (values.some(Boolean)) {
    throw new Error(
      "LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be configured together"
    );
  }
  return null;
}

function validateProductionLiveKitConfig(config: LiveKitConfig) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(config.url);
  } catch {
    throw new Error("LIVEKIT_URL must be a valid wss:// URL in production");
  }

  if (parsedUrl.protocol !== "wss:") {
    throw new Error("LIVEKIT_URL must use wss:// in production");
  }

  const forbiddenApiKeys = new Set(["devkey", "replace-with-livekit-api-key"]);
  if (forbiddenApiKeys.has(config.apiKey)) {
    throw new Error("LIVEKIT_API_KEY must not use a development placeholder in production");
  }

  const forbiddenApiSecrets = new Set(["secret", "devsecret", "replace-with-livekit-api-secret"]);
  if (forbiddenApiSecrets.has(config.apiSecret)) {
    throw new Error("LIVEKIT_API_SECRET must not use a development placeholder in production");
  }
}
