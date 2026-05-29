import type { RoomEvent, RoomSession } from "@cueroom/shared";
import { describe, expect, it } from "vitest";
import { buildServer } from "../src/server";

type RealtimeTestSocket = {
  on(event: "message", listener: (data: unknown) => void): void;
  off(event: "message", listener: (data: unknown) => void): void;
  send(data: string): void;
  terminate(): void;
};

describe("CueRoom realtime room WebSocket", () => {
  it("authenticates room sessions before accepting playback state", async () => {
    const server = await buildServer();
    await server.ready();

    try {
      const created = (
        await server.inject({
          method: "POST",
          url: "/v1/rooms",
          payload: { hostName: "Host", title: "Realtime room" }
        })
      ).json() as RoomSession;
      const guest = (
        await server.inject({
          method: "POST",
          url: "/v1/rooms/join",
          payload: { inviteCode: created.room.inviteCode, displayName: "Guest" }
        })
      ).json() as RoomSession;

      const host = await connectRealtime(server, created);
      const guestSocket = await connectRealtime(server, guest);
      const stateReceived = waitForRoomEvent(guestSocket, "sync.state");

      host.send(
        JSON.stringify({
          type: "sync.state",
          roomId: created.room.id,
          participantId: created.participant.id,
          state: playbackState()
        })
      );

      expect(await stateReceived).toMatchObject({
        type: "sync.state",
        roomId: created.room.id,
        participantId: created.participant.id,
        state: {
          watchId: "81234567",
          paused: true
        }
      });

      host.terminate();
      guestSocket.terminate();
    } finally {
      await server.close();
    }
  });

  it("broadcasts only server-authorized sync commands", async () => {
    const server = await buildServer();
    await server.ready();

    try {
      const created = (
        await server.inject({
          method: "POST",
          url: "/v1/rooms",
          payload: { hostName: "Host", title: "Realtime room" }
        })
      ).json() as RoomSession;
      const guest = (
        await server.inject({
          method: "POST",
          url: "/v1/rooms/join",
          payload: { inviteCode: created.room.inviteCode, displayName: "Guest" }
        })
      ).json() as RoomSession;

      const host = await connectRealtime(server, created);
      const guestSocket = await connectRealtime(server, guest);
      const guestError = waitForRoomEvent(guestSocket, "sync.error");

      guestSocket.send(
        JSON.stringify({
          type: "sync.command",
          command: {
            roomId: created.room.id,
            actorId: guest.participant.id,
            command: "pause",
            issuedAt: Date.now(),
            sequence: 1
          }
        })
      );

      expect(await guestError).toMatchObject({
        type: "sync.error",
        reason: "Forbidden"
      });

      const commandReceived = waitForRoomEvent(guestSocket, "sync.command");
      host.send(
        JSON.stringify({
          type: "sync.command",
          command: {
            roomId: created.room.id,
            actorId: created.participant.id,
            command: "pause",
            issuedAt: Date.now(),
            sequence: 2
          }
        })
      );

      expect(await commandReceived).toMatchObject({
        type: "sync.command",
        command: {
          roomId: created.room.id,
          actorId: created.participant.id,
          command: "pause",
          sequence: 2
        }
      });

      const replayError = waitForRoomEvent(host, "sync.error");
      host.send(
        JSON.stringify({
          type: "sync.command",
          command: {
            roomId: created.room.id,
            actorId: created.participant.id,
            command: "pause",
            issuedAt: Date.now(),
            sequence: 2
          }
        })
      );

      expect(await replayError).toMatchObject({
        type: "sync.error",
        reason: "Replay detected"
      });

      host.terminate();
      guestSocket.terminate();
    } finally {
      await server.close();
    }
  });
});

async function connectRealtime(
  server: Awaited<ReturnType<typeof buildServer>>,
  session: RoomSession
) {
  const socket = (await server.injectWS(
    `/v1/rooms/${session.room.id}/realtime`
  )) as RealtimeTestSocket;
  const ready = waitForRoomEvent(socket, "room.ready");

  socket.send(
    JSON.stringify({
      type: "room.auth",
      roomId: session.room.id,
      participantId: session.participant.id,
      sessionToken: session.sessionToken
    })
  );

  expect(await ready).toMatchObject({
    type: "room.ready",
    roomId: session.room.id,
    participantId: session.participant.id
  });
  return socket;
}

function waitForRoomEvent<TType extends RoomEvent["type"]>(
  socket: RealtimeTestSocket,
  type: TType
): Promise<Extract<RoomEvent, { type: TType }>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", listener);
      reject(new Error(`Timed out waiting for ${type}`));
    }, 1_000);

    const listener = (data: unknown) => {
      const event = parseRoomEvent(data);
      if (event.type !== type) {
        return;
      }
      clearTimeout(timeout);
      socket.off("message", listener);
      resolve(event as Extract<RoomEvent, { type: TType }>);
    };

    socket.on("message", listener);
  });
}

function parseRoomEvent(data: unknown): RoomEvent {
  const text = data instanceof Buffer ? data.toString("utf8") : String(data);
  return JSON.parse(text) as RoomEvent;
}

function playbackState() {
  return {
    watchId: "81234567",
    titleHint: "Test title",
    url: "https://www.netflix.com/watch/81234567",
    paused: true,
    currentTime: 120,
    duration: 3600,
    playbackRate: 1,
    buffering: false,
    observedAt: Date.now(),
    sequence: 1
  };
}
