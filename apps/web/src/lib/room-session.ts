import { roomSessionSchema, type RoomSession } from "@cueroom/shared";

type SessionStorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const roomSessionStoragePrefix = "cueroom.roomSession.";

export function roomSessionStorageKey(roomId: string) {
  return `${roomSessionStoragePrefix}${roomId}`;
}

export function storeRoomSession(session: RoomSession, storage = getBrowserStorage()) {
  storage?.setItem(roomSessionStorageKey(session.room.id), JSON.stringify(session));
}

export function readRoomSession(roomId: string, storage = getBrowserStorage()): RoomSession | null {
  const rawSession = storage?.getItem(roomSessionStorageKey(roomId));
  if (!rawSession) {
    return null;
  }

  try {
    const parsed = roomSessionSchema.safeParse(JSON.parse(rawSession));
    if (
      !parsed.success ||
      parsed.data.room.id !== roomId ||
      Date.parse(parsed.data.room.expiresAt) <= Date.now()
    ) {
      storage?.removeItem(roomSessionStorageKey(roomId));
      return null;
    }
    return parsed.data;
  } catch {
    storage?.removeItem(roomSessionStorageKey(roomId));
    return null;
  }
}

export function clearRoomSession(roomId: string, storage = getBrowserStorage()) {
  storage?.removeItem(roomSessionStorageKey(roomId));
}

function getBrowserStorage(): SessionStorageLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.sessionStorage;
}
