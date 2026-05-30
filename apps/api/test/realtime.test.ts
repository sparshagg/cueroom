import type { RoomEvent, RoomSession } from "@cueroom/shared";
import { describe, expect, it } from "vitest";
import { createRoomStore, type ActiveSession, type RoomStore } from "../src/room-store";
import { buildServer } from "../src/server";

type RealtimeTestSocket = {
  on(event: "message", listener: (data: unknown) => void): void;
  on(event: "close", listener: () => void): void;
  off(event: "message", listener: (data: unknown) => void): void;
  off(event: "close", listener: () => void): void;
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
        role: "host",
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
            watchId: "81234567",
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
            watchId: "81234567",
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
          watchId: "81234567",
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
            watchId: "81234567",
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

  it("sends targeted drift corrections from host playback state", async () => {
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
      const hostStateSeen = waitForRoomEvent(guestSocket, "sync.state");
      host.send(
        JSON.stringify({
          type: "sync.state",
          roomId: created.room.id,
          participantId: created.participant.id,
          state: playbackState({ paused: false, currentTime: 120, sequence: 10 })
        })
      );
      await hostStateSeen;

      const correctionReceived = waitForRoomEvent(guestSocket, "sync.correction");
      guestSocket.send(
        JSON.stringify({
          type: "sync.state",
          roomId: created.room.id,
          participantId: guest.participant.id,
          state: playbackState({ paused: false, currentTime: 90, sequence: 11 })
        })
      );

      expect(await correctionReceived).toMatchObject({
        type: "sync.correction",
        correction: {
          roomId: created.room.id,
          participantId: guest.participant.id,
          authorityParticipantId: created.participant.id,
          watchId: "81234567",
          command: "catch-up"
        }
      });

      host.terminate();
      guestSocket.terminate();
    } finally {
      await server.close();
    }
  });

  it("warns on wrong Netflix watch ID without sending a correction", async () => {
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
      const hostStateSeen = waitForRoomEvent(guestSocket, "sync.state");
      host.send(
        JSON.stringify({
          type: "sync.state",
          roomId: created.room.id,
          participantId: created.participant.id,
          state: playbackState({ watchId: "81234567", titleHint: "Host title", sequence: 20 })
        })
      );
      await hostStateSeen;

      const warningReceived = waitForRoomEvent(guestSocket, "sync.warning");
      guestSocket.send(
        JSON.stringify({
          type: "sync.state",
          roomId: created.room.id,
          participantId: guest.participant.id,
          state: playbackState({
            watchId: "89999999",
            titleHint: "Guest title",
            url: "https://www.netflix.com/watch/89999999",
            sequence: 21
          })
        })
      );

      expect(await warningReceived).toMatchObject({
        type: "sync.warning",
        warning: {
          type: "wrong-title",
          roomId: created.room.id,
          participantId: guest.participant.id,
          expectedWatchId: "81234567",
          currentWatchId: "89999999"
        }
      });
      await expectNoRoomEvent(guestSocket, "sync.correction");

      host.terminate();
      guestSocket.terminate();
    } finally {
      await server.close();
    }
  });

  it("does not let guest playback state establish room authority", async () => {
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
      const secondGuest = (
        await server.inject({
          method: "POST",
          url: "/v1/rooms/join",
          payload: { inviteCode: created.room.inviteCode, displayName: "Second guest" }
        })
      ).json() as RoomSession;

      const guestSocket = await connectRealtime(server, guest);
      const secondGuestSocket = await connectRealtime(server, secondGuest);
      guestSocket.send(
        JSON.stringify({
          type: "sync.state",
          roomId: created.room.id,
          participantId: guest.participant.id,
          state: playbackState({ currentTime: 240, sequence: 30 })
        })
      );

      secondGuestSocket.send(
        JSON.stringify({
          type: "sync.state",
          roomId: created.room.id,
          participantId: secondGuest.participant.id,
          state: playbackState({ currentTime: 30, sequence: 31 })
        })
      );

      await expectNoRoomEvent(secondGuestSocket, "sync.correction");
      await expectNoRoomEvent(secondGuestSocket, "sync.warning");

      guestSocket.terminate();
      secondGuestSocket.terminate();
    } finally {
      await server.close();
    }
  });

  it("closes realtime access when a participant is kicked", async () => {
    const server = await buildServer();
    await server.ready();

    try {
      const created = (
        await server.inject({
          method: "POST",
          url: "/v1/rooms",
          payload: { hostName: "Host", title: "Kick room" }
        })
      ).json() as RoomSession;
      const guest = (
        await server.inject({
          method: "POST",
          url: "/v1/rooms/join",
          payload: { inviteCode: created.room.inviteCode, displayName: "Guest" }
        })
      ).json() as RoomSession;
      const secondGuest = (
        await server.inject({
          method: "POST",
          url: "/v1/rooms/join",
          payload: { inviteCode: created.room.inviteCode, displayName: "Second guest" }
        })
      ).json() as RoomSession;

      const host = await connectRealtime(server, created);
      const guestSocket = await connectRealtime(server, guest);
      const secondGuestSocket = await connectRealtime(server, secondGuest);
      const kickedNotice = waitForRoomEvent(secondGuestSocket, "presence.left");

      const kickResponse = await server.inject({
        method: "POST",
        url: `/v1/rooms/${created.room.id}/kick`,
        payload: {
          sessionToken: created.sessionToken,
          participantId: guest.participant.id
        }
      });
      expect(kickResponse.statusCode).toBe(200);
      expect(await kickedNotice).toMatchObject({
        type: "presence.left",
        roomId: created.room.id,
        participantId: guest.participant.id
      });

      const leakedState = expectNoRoomEvent(secondGuestSocket, "sync.state");
      try {
        guestSocket.send(
          JSON.stringify({
            type: "sync.state",
            roomId: created.room.id,
            participantId: guest.participant.id,
            state: playbackState({ sequence: 40 })
          })
        );
      } catch {
        // The expected secure state is for the kicked socket to be closed already.
      }
      await leakedState;

      host.terminate();
      secondGuestSocket.terminate();
    } finally {
      await server.close();
    }
  });

  it("rechecks room membership before accepting playback state", async () => {
    const backingStore = createRoomStore();
    let sessionsAreValid = true;
    const store: RoomStore = {
      ...backingStore,
      requireSession(roomId, sessionToken) {
        return sessionsAreValid
          ? (backingStore.requireSession(roomId, sessionToken) as ActiveSession | null)
          : null;
      }
    };
    const server = await buildServer({ store });
    await server.ready();

    try {
      const created = (
        await server.inject({
          method: "POST",
          url: "/v1/rooms",
          payload: { hostName: "Host", title: "Recheck room" }
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
      sessionsAreValid = false;

      const leakedState = expectNoRoomEvent(guestSocket, "sync.state");
      host.send(
        JSON.stringify({
          type: "sync.state",
          roomId: created.room.id,
          participantId: created.participant.id,
          state: playbackState({ sequence: 50 })
        })
      );
      await leakedState;

      guestSocket.terminate();
    } finally {
      await server.close();
    }
  });

  it("rate limits realtime message bursts", async () => {
    const server = await buildServer();
    await server.ready();

    try {
      const created = (
        await server.inject({
          method: "POST",
          url: "/v1/rooms",
          payload: { hostName: "Host", title: "Rate limit room" }
        })
      ).json() as RoomSession;

      const host = await connectRealtime(server, created);
      const closed = waitForSocketClose(host);
      for (let index = 0; index < 35; index += 1) {
        try {
          host.send(
            JSON.stringify({
              type: "ping",
              sentAt: Date.now() + index + 1
            })
          );
        } catch {
          break;
        }
      }

      await closed;
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

function expectNoRoomEvent<TType extends RoomEvent["type"]>(
  socket: RealtimeTestSocket,
  type: TType
) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", listener);
      resolve();
    }, 150);

    const listener = (data: unknown) => {
      const event = parseRoomEvent(data);
      if (event.type !== type) {
        return;
      }
      clearTimeout(timeout);
      socket.off("message", listener);
      reject(new Error(`Unexpected ${type} event`));
    };

    socket.on("message", listener);
  });
}

function waitForSocketClose(socket: RealtimeTestSocket) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("close", listener);
      reject(new Error("Timed out waiting for socket close"));
    }, 1_000);
    const listener = () => {
      clearTimeout(timeout);
      socket.off("close", listener);
      resolve();
    };
    socket.on("close", listener);
  });
}

function parseRoomEvent(data: unknown): RoomEvent {
  const text = data instanceof Buffer ? data.toString("utf8") : String(data);
  return JSON.parse(text) as RoomEvent;
}

function playbackState(overrides: Partial<ReturnType<typeof basePlaybackState>> = {}) {
  return {
    ...basePlaybackState(),
    ...overrides
  };
}

function basePlaybackState() {
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
