import type { RoomSession } from "@cueroom/shared";
import { describe, expect, it } from "vitest";
import { readRoomSession, roomSessionStorageKey, storeRoomSession } from "./room-session";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value)
  };
}

const roomSession = {
  room: {
    id: "room_12345678",
    inviteCode: "invite123",
    title: "Movie night",
    locked: false,
    createdAt: "2099-05-29T12:00:00.000Z",
    expiresAt: "2099-05-29T18:00:00.000Z",
    participants: [
      {
        id: "p_12345678",
        displayName: "Host",
        role: "host",
        joinedAt: "2099-05-29T12:00:00.000Z",
        muted: false,
        cameraEnabled: true
      }
    ]
  },
  participant: {
    id: "p_12345678",
    displayName: "Host",
    role: "host",
    joinedAt: "2099-05-29T12:00:00.000Z",
    muted: false,
    cameraEnabled: true
  },
  sessionToken: "crs_123456789012345678901234"
} satisfies RoomSession;

describe("room session storage", () => {
  it("stores and reads a room-scoped session", () => {
    const storage = createStorage();

    storeRoomSession(roomSession, storage);

    expect(readRoomSession(roomSession.room.id, storage)).toEqual(roomSession);
  });

  it("removes sessions stored under the wrong room id", () => {
    const storage = createStorage();
    storage.setItem(roomSessionStorageKey("room_other123"), JSON.stringify(roomSession));

    expect(readRoomSession("room_other123", storage)).toBeNull();
    expect(storage.getItem(roomSessionStorageKey("room_other123"))).toBeNull();
  });

  it("removes expired and non-room-token sessions", () => {
    const storage = createStorage();
    storage.setItem(
      roomSessionStorageKey(roomSession.room.id),
      JSON.stringify({
        ...roomSession,
        room: {
          ...roomSession.room,
          expiresAt: "2020-01-01T00:00:00.000Z"
        }
      })
    );
    expect(readRoomSession(roomSession.room.id, storage)).toBeNull();

    storage.setItem(
      roomSessionStorageKey(roomSession.room.id),
      JSON.stringify({ ...roomSession, sessionToken: "cas_123456789012345678901234" })
    );
    expect(readRoomSession(roomSession.room.id, storage)).toBeNull();
  });
});
