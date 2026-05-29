import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import type { Participant, Room } from "@cueroom/shared";

export async function createLiveKitToken(room: Room, participant: Participant) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required");
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: participant.id,
    name: participant.displayName,
    ttl: "15m"
  });

  token.addGrant({
    room: room.id,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true
  });

  return token.toJwt();
}

export async function removeLiveKitParticipant(roomId: string, participantId: string) {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    return;
  }

  const serviceUrl = url.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
  const client = new RoomServiceClient(serviceUrl, apiKey, apiSecret);
  await client.removeParticipant(roomId, participantId);
}
