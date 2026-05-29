import crypto from "node:crypto";
import type { Participant, Room, RoomRole, SyncCommand } from "@cueroom/shared";

type SessionRecord = {
  roomId: string;
  participantId: string;
  token: string;
  expiresAt: number;
};

type CreateRoomInput = {
  hostName: string;
  title: string;
};

type JoinRoomInput = {
  inviteCode: string;
  displayName: string;
};

export type RoomStore = ReturnType<typeof createRoomStore>;

const roomTtlMs = 6 * 60 * 60 * 1000;
const sessionTtlMs = 2 * 60 * 60 * 1000;

export function createRoomStore() {
  const rooms = new Map<string, Room>();
  const sessions = new Map<string, SessionRecord>();
  const lastSyncSequenceByRoom = new Map<string, number>();

  function createParticipant(displayName: string, role: RoomRole): Participant {
    return {
      id: `p_${crypto.randomUUID()}`,
      displayName,
      role,
      joinedAt: new Date().toISOString(),
      muted: false,
      cameraEnabled: true
    };
  }

  function createSession(roomId: string, participantId: string) {
    const token = `crs_${crypto.randomBytes(32).toString("base64url")}`;
    sessions.set(token, {
      roomId,
      participantId,
      token,
      expiresAt: Date.now() + sessionTtlMs
    });
    return token;
  }

  function findByInvite(inviteCode: string) {
    return [...rooms.values()].find((room) => room.inviteCode === inviteCode);
  }

  return {
    createRoom(input: CreateRoomInput) {
      const host = createParticipant(input.hostName, "host");
      const room: Room = {
        id: `room_${crypto.randomUUID()}`,
        inviteCode: crypto.randomBytes(8).toString("base64url"),
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

    joinRoom(input: JoinRoomInput) {
      const room = findByInvite(input.inviteCode);
      if (!room) {
        return { error: "Invite not found" as const };
      }
      if (room.locked) {
        return { error: "Room is locked" as const };
      }
      if (Date.parse(room.expiresAt) < Date.now()) {
        return { error: "Invite expired" as const };
      }

      const guest = createParticipant(input.displayName, "guest");
      room.participants.push(guest);
      return {
        room,
        participant: guest,
        sessionToken: createSession(room.id, guest.id)
      };
    },

    getRoom(roomId: string) {
      return rooms.get(roomId);
    },

    requireSession(roomId: string, sessionToken: string) {
      const session = sessions.get(sessionToken);
      if (!session || session.roomId !== roomId || session.expiresAt < Date.now()) {
        return null;
      }
      const room = rooms.get(roomId);
      const participant = room?.participants.find((entry) => entry.id === session.participantId);
      if (!room || !participant) {
        return null;
      }
      return { room, participant, session };
    },

    requireRole(roomId: string, sessionToken: string, allowedRoles: RoomRole[]) {
      const activeSession = this.requireSession(roomId, sessionToken);
      if (!activeSession || !allowedRoles.includes(activeSession.participant.role)) {
        return null;
      }
      return activeSession;
    },

    setLocked(roomId: string, sessionToken: string, locked: boolean) {
      const activeSession = this.requireRole(roomId, sessionToken, ["host", "cohost"]);
      if (!activeSession) {
        return { error: "Forbidden" as const };
      }
      activeSession.room.locked = locked;
      return { room: activeSession.room };
    },

    kick(roomId: string, sessionToken: string, participantId: string) {
      const activeSession = this.requireRole(roomId, sessionToken, ["host", "cohost"]);
      if (!activeSession) {
        return { error: "Forbidden" as const };
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

    rotateInvite(roomId: string, sessionToken: string) {
      const activeSession = this.requireRole(roomId, sessionToken, ["host", "cohost"]);
      if (!activeSession) {
        return { error: "Forbidden" as const };
      }
      activeSession.room.inviteCode = crypto.randomBytes(8).toString("base64url");
      return { room: activeSession.room };
    },

    acceptSyncCommand(roomId: string, sessionToken: string, command: SyncCommand) {
      const activeSession = this.requireRole(roomId, sessionToken, ["host", "cohost"]);
      if (!activeSession) {
        return { error: "Forbidden" as const };
      }
      if (command.roomId !== roomId || command.actorId !== activeSession.participant.id) {
        return { error: "Command actor mismatch" as const };
      }
      const maxClockSkewMs = 30_000;
      if (Math.abs(Date.now() - command.issuedAt) > maxClockSkewMs) {
        return { error: "Stale command" as const };
      }
      const lastSequence = lastSyncSequenceByRoom.get(roomId) ?? -1;
      if (command.sequence <= lastSequence) {
        return { error: "Replay detected" as const };
      }
      lastSyncSequenceByRoom.set(roomId, command.sequence);
      return { accepted: true as const, command };
    }
  };
}
