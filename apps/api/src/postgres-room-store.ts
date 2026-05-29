import crypto from "node:crypto";
import type { Participant, Room, RoomRole, RoomSession, SyncCommand } from "@cueroom/shared";
import {
  createInviteCode,
  createParticipant,
  createSessionToken,
  roomTtlMs,
  sessionTtlMs,
  type ActiveSession,
  type CreateRoomInput,
  type JoinRoomInput,
  type RoomStore,
  type StoreError
} from "./room-store.js";
import type { PostgresClient, PostgresPool } from "./postgres.js";
import { withTransaction } from "./postgres.js";

type RoomRow = {
  id: string;
  invite_code: string;
  title: string;
  locked: boolean;
  created_at: Date | string;
  expires_at: Date | string;
};

type ParticipantRow = {
  id: string;
  display_name: string;
  role: RoomRole;
  joined_at: Date | string;
  muted: boolean;
  camera_enabled: boolean;
};

type Queryable = PostgresPool | PostgresClient;

export function hashSessionToken(sessionToken: string) {
  return crypto.createHash("sha256").update(sessionToken).digest("base64url");
}

export function createPostgresRoomStore(pool: PostgresPool): RoomStore {
  const lastSyncSequenceByRoom = new Map<string, number>();

  async function insertSession(
    queryable: Queryable,
    roomId: string,
    participantId: string,
    sessionToken: string
  ) {
    await queryable.query(
      `
        INSERT INTO room_sessions (token_hash, room_id, participant_id, expires_at)
        VALUES ($1, $2, $3, $4)
      `,
      [
        hashSessionToken(sessionToken),
        roomId,
        participantId,
        new Date(Date.now() + sessionTtlMs).toISOString()
      ]
    );
  }

  async function loadRoom(queryable: Queryable, roomId: string): Promise<Room | undefined> {
    const roomResult = await queryable.query<RoomRow>(
      `
        SELECT id, invite_code, title, locked, created_at, expires_at
        FROM rooms
        WHERE id = $1
      `,
      [roomId]
    );
    const row = roomResult.rows[0];
    if (!row) {
      return undefined;
    }

    const participantResult = await queryable.query<ParticipantRow>(
      `
        SELECT id, display_name, role, joined_at, muted, camera_enabled
        FROM participants
        WHERE room_id = $1
        ORDER BY joined_at ASC
      `,
      [roomId]
    );

    return roomFromRows(row, participantResult.rows);
  }

  async function requireSession(
    queryable: Queryable,
    roomId: string,
    sessionToken: string
  ): Promise<ActiveSession | null> {
    const result = await queryable.query<RoomRow & ParticipantRow>(
      `
        SELECT
          rooms.id,
          rooms.invite_code,
          rooms.title,
          rooms.locked,
          rooms.created_at,
          rooms.expires_at,
          participants.id AS participant_id,
          participants.display_name,
          participants.role,
          participants.joined_at,
          participants.muted,
          participants.camera_enabled
        FROM room_sessions
        INNER JOIN rooms ON rooms.id = room_sessions.room_id
        INNER JOIN participants ON participants.id = room_sessions.participant_id
        WHERE room_sessions.token_hash = $1
          AND room_sessions.room_id = $2
          AND room_sessions.expires_at > NOW()
          AND rooms.expires_at > NOW()
      `,
      [hashSessionToken(sessionToken), roomId]
    );
    const row = result.rows[0] as
      | (RoomRow & ParticipantRow & { participant_id: string })
      | undefined;
    if (!row) {
      return null;
    }

    const room = await loadRoom(queryable, roomId);
    if (!room) {
      return null;
    }

    const participant = room.participants.find((entry) => entry.id === row.participant_id);
    if (!participant) {
      return null;
    }

    return { room, participant };
  }

  async function requireRole(
    queryable: Queryable,
    roomId: string,
    sessionToken: string,
    allowedRoles: RoomRole[]
  ) {
    const activeSession = await requireSession(queryable, roomId, sessionToken);
    if (!activeSession || !allowedRoles.includes(activeSession.participant.role)) {
      return null;
    }
    return activeSession;
  }

  const store: RoomStore = {
    async createRoom(input: CreateRoomInput): Promise<RoomSession> {
      return withTransaction(pool, async (client) => {
        const host = createParticipant(input.hostName, "host");
        const sessionToken = createSessionToken();
        const now = new Date();
        const room: Room = {
          id: `room_${crypto.randomUUID()}`,
          inviteCode: createInviteCode(),
          title: input.title,
          locked: false,
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + roomTtlMs).toISOString(),
          participants: [host]
        };

        await client.query(
          `
            INSERT INTO rooms (id, invite_code, title, locked, created_at, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [room.id, room.inviteCode, room.title, room.locked, room.createdAt, room.expiresAt]
        );
        await client.query(
          `
            INSERT INTO participants
              (id, room_id, display_name, role, joined_at, muted, camera_enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            host.id,
            room.id,
            host.displayName,
            host.role,
            host.joinedAt,
            host.muted,
            host.cameraEnabled
          ]
        );
        await insertSession(client, room.id, host.id, sessionToken);

        return { room, participant: host, sessionToken };
      });
    },

    async joinRoom(input: JoinRoomInput): Promise<RoomSession | StoreError> {
      return withTransaction(pool, async (client) => {
        const roomResult = await client.query<RoomRow>(
          `
            SELECT id, invite_code, title, locked, created_at, expires_at
            FROM rooms
            WHERE invite_code = $1
            FOR UPDATE
          `,
          [input.inviteCode]
        );
        const roomRow = roomResult.rows[0];
        if (!roomRow) {
          return { error: "Invite not found" };
        }
        if (roomRow.locked) {
          return { error: "Room is locked" };
        }
        if (Date.parse(toIsoString(roomRow.expires_at)) < Date.now()) {
          return { error: "Invite expired" };
        }

        const guest = createParticipant(input.displayName, "guest");
        const sessionToken = createSessionToken();
        await client.query(
          `
            INSERT INTO participants
              (id, room_id, display_name, role, joined_at, muted, camera_enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            guest.id,
            roomRow.id,
            guest.displayName,
            guest.role,
            guest.joinedAt,
            guest.muted,
            guest.cameraEnabled
          ]
        );
        await insertSession(client, roomRow.id, guest.id, sessionToken);
        const room = await loadRoom(client, roomRow.id);
        if (!room) {
          return { error: "Invite not found" };
        }

        return { room, participant: guest, sessionToken };
      });
    },

    getRoom(roomId: string) {
      return loadRoom(pool, roomId);
    },

    requireSession(roomId: string, sessionToken: string) {
      return requireSession(pool, roomId, sessionToken);
    },

    requireRole(roomId: string, sessionToken: string, allowedRoles: RoomRole[]) {
      return requireRole(pool, roomId, sessionToken, allowedRoles);
    },

    async setLocked(roomId: string, sessionToken: string, locked: boolean) {
      return withTransaction(pool, async (client) => {
        const activeSession = await requireRole(client, roomId, sessionToken, ["host", "cohost"]);
        if (!activeSession) {
          return { error: "Forbidden" };
        }
        await client.query("UPDATE rooms SET locked = $1 WHERE id = $2", [locked, roomId]);
        const room = await loadRoom(client, roomId);
        if (!room) {
          return { error: "Forbidden" };
        }
        return { room };
      });
    },

    async kick(roomId: string, sessionToken: string, participantId: string) {
      return withTransaction(pool, async (client) => {
        const activeSession = await requireRole(client, roomId, sessionToken, ["host", "cohost"]);
        if (!activeSession) {
          return { error: "Forbidden" };
        }
        const removed = await client.query<{ id: string }>(
          `
            DELETE FROM participants
            WHERE room_id = $1 AND id = $2 AND role <> 'host'
            RETURNING id
          `,
          [roomId, participantId]
        );
        const removedParticipantIds = removed.rows.map((row) => row.id);
        const room = await loadRoom(client, roomId);
        if (!room) {
          return { error: "Forbidden" };
        }
        return { room, removedParticipantIds };
      });
    },

    async rotateInvite(roomId: string, sessionToken: string) {
      return withTransaction(pool, async (client) => {
        const activeSession = await requireRole(client, roomId, sessionToken, ["host", "cohost"]);
        if (!activeSession) {
          return { error: "Forbidden" };
        }
        await client.query("UPDATE rooms SET invite_code = $1 WHERE id = $2", [
          createInviteCode(),
          roomId
        ]);
        const room = await loadRoom(client, roomId);
        if (!room) {
          return { error: "Forbidden" };
        }
        return { room };
      });
    },

    async acceptSyncCommand(roomId: string, sessionToken: string, command: SyncCommand) {
      const activeSession = await requireRole(pool, roomId, sessionToken, ["host", "cohost"]);
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
    },

    close() {
      return pool.end();
    }
  };

  return store;
}

function roomFromRows(room: RoomRow, participants: ParticipantRow[]): Room {
  return {
    id: room.id,
    inviteCode: room.invite_code,
    title: room.title,
    locked: room.locked,
    createdAt: toIsoString(room.created_at),
    expiresAt: toIsoString(room.expires_at),
    participants: participants.map(participantFromRow)
  };
}

function participantFromRow(row: ParticipantRow): Participant {
  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    joinedAt: toIsoString(row.joined_at),
    muted: row.muted,
    cameraEnabled: row.camera_enabled
  };
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
