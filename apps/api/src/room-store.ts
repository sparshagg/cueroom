import crypto from "node:crypto";
import type { Participant, Room, RoomRole, RoomSession, SyncCommand } from "@cueroom/shared";

type SessionRecord = {
  roomId: string;
  participantId: string;
  expiresAt: number;
};

export type ActiveSession = {
  room: Room;
  participant: Participant;
};

export type CreateRoomInput = {
  hostName: string;
  title: string;
  accountId?: string;
};

export type JoinRoomInput = {
  inviteCode: string;
  displayName: string;
};

export type StoreError = {
  error: string;
};

type Awaitable<T> = T | Promise<T>;

export type RoomStore = {
  createRoom(input: CreateRoomInput): Awaitable<RoomSession>;
  joinRoom(input: JoinRoomInput): Awaitable<RoomSession | StoreError>;
  getRoom(roomId: string): Awaitable<Room | undefined>;
  requireSession(roomId: string, sessionToken: string): Awaitable<ActiveSession | null>;
  requireRole(
    roomId: string,
    sessionToken: string,
    allowedRoles: RoomRole[]
  ): Awaitable<ActiveSession | null>;
  setLocked(
    roomId: string,
    sessionToken: string,
    locked: boolean
  ): Awaitable<{ room: Room } | StoreError>;
  kick(
    roomId: string,
    sessionToken: string,
    participantId: string
  ): Awaitable<{ room: Room; removedParticipantIds: string[] } | StoreError>;
  rotateInvite(roomId: string, sessionToken: string): Awaitable<{ room: Room } | StoreError>;
  acceptSyncCommand(
    roomId: string,
    sessionToken: string,
    command: SyncCommand
  ): Awaitable<{ accepted: true; command: SyncCommand } | StoreError>;
  close?(): Promise<void>;
};

export const roomTtlMs = 6 * 60 * 60 * 1000;
export const sessionTtlMs = 2 * 60 * 60 * 1000;

export function createParticipant(displayName: string, role: RoomRole): Participant {
  return {
    id: `p_${crypto.randomUUID()}`,
    displayName,
    role,
    joinedAt: new Date().toISOString(),
    muted: false,
    cameraEnabled: true
  };
}

export function createSessionToken() {
  return `crs_${crypto.randomBytes(32).toString("base64url")}`;
}

export function createInviteCode() {
  return crypto.randomBytes(8).toString("base64url");
}

export function createRoomStore(): RoomStore {
  const rooms = new Map<string, Room>();
  const sessions = new Map<string, SessionRecord>();
  const lastSyncSequenceByRoom = new Map<string, number>();

  function createSession(roomId: string, participantId: string) {
    const token = createSessionToken();
    sessions.set(token, {
      roomId,
      participantId,
      expiresAt: Date.now() + sessionTtlMs
    });
    return token;
  }

  function findByInvite(inviteCode: string) {
    return [...rooms.values()].find((room) => room.inviteCode === inviteCode);
  }

  const store: RoomStore = {
    createRoom(input) {
      const host = createParticipant(input.hostName, "host");
      const room: Room = {
        id: `room_${crypto.randomUUID()}`,
        inviteCode: createInviteCode(),
        title: input.title,
        locked: false,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + roomTtlMs).toISOString(),
        participants: [host]
      };
      rooms.set(room.id, room);
      return {
        room,
        participant: host,
        sessionToken: createSession(room.id, host.id)
      };
    },

    joinRoom(input) {
      const room = findByInvite(input.inviteCode);
      if (!room) {
        return { error: "Invite not found" };
      }
      if (room.locked) {
        return { error: "Room is locked" };
      }
      if (Date.parse(room.expiresAt) < Date.now()) {
        return { error: "Invite expired" };
      }

      const guest = createParticipant(input.displayName, "guest");
      room.participants.push(guest);
      return {
        room,
        participant: guest,
        sessionToken: createSession(room.id, guest.id)
      };
    },

    getRoom(roomId) {
      return rooms.get(roomId);
    },

    requireSession(roomId, sessionToken) {
      const session = sessions.get(sessionToken);
      if (!session || session.roomId !== roomId || session.expiresAt < Date.now()) {
        return null;
      }
      const room = rooms.get(roomId);
      if (!room || Date.parse(room.expiresAt) < Date.now()) {
        return null;
      }
      const participant = room.participants.find((entry) => entry.id === session.participantId);
      if (!participant) {
        return null;
      }
      return { room, participant };
    },

    requireRole(roomId, sessionToken, allowedRoles) {
      const activeSession = this.requireSession(roomId, sessionToken) as ActiveSession | null;
      if (!activeSession || !allowedRoles.includes(activeSession.participant.role)) {
        return null;
      }
      return activeSession;
    },

    setLocked(roomId, sessionToken, locked) {
      const activeSession = this.requireRole(roomId, sessionToken, [
        "host",
        "cohost"
      ]) as ActiveSession | null;
      if (!activeSession) {
        return { error: "Forbidden" };
      }
      activeSession.room.locked = locked;
      return { room: activeSession.room };
    },

    kick(roomId, sessionToken, participantId) {
      const activeSession = this.requireRole(roomId, sessionToken, [
        "host",
        "cohost"
      ]) as ActiveSession | null;
      if (!activeSession) {
        return { error: "Forbidden" };
      }
      const removedParticipantIds = activeSession.room.participants
        .filter((participant) => participant.id === participantId && participant.role !== "host")
        .map((participant) => participant.id);
      activeSession.room.participants = activeSession.room.participants.filter(
        (participant) => !removedParticipantIds.includes(participant.id)
      );
      for (const [token, session] of sessions) {
        if (session.roomId === roomId && removedParticipantIds.includes(session.participantId)) {
          sessions.delete(token);
        }
      }
      return { room: activeSession.room, removedParticipantIds };
    },

    rotateInvite(roomId, sessionToken) {
      const activeSession = this.requireRole(roomId, sessionToken, [
        "host",
        "cohost"
      ]) as ActiveSession | null;
      if (!activeSession) {
        return { error: "Forbidden" };
      }
      activeSession.room.inviteCode = createInviteCode();
      return { room: activeSession.room };
    },

    acceptSyncCommand(roomId, sessionToken, command) {
      const activeSession = this.requireRole(roomId, sessionToken, [
        "host",
        "cohost"
      ]) as ActiveSession | null;
      if (!activeSession) {
        return { error: "Forbidden" };
      }
      if (command.roomId !== roomId || command.actorId !== activeSession.participant.id) {
        return { error: "Command actor mismatch" };
      }
      const maxClockSkewMs = 30_000;
      if (Math.abs(Date.now() - command.issuedAt) > maxClockSkewMs) {
        return { error: "Stale command" };
      }
      const lastSequence = lastSyncSequenceByRoom.get(roomId) ?? -1;
      if (command.sequence <= lastSequence) {
        return { error: "Replay detected" };
      }
      lastSyncSequenceByRoom.set(roomId, command.sequence);
      return { accepted: true, command };
    }
  };

  return store;
}
