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
import type { RedisRoomState } from "./redis-room-state.js";

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

export function createPostgresRoomStore(pool: PostgresPool, roomState?: RedisRoomState): RoomStore {
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

  async function findRoomRowByInvite(queryable: Queryable, inviteCode: string) {
    const cachedRoomId = await bestEffort(() => roomState?.getRoomIdByInvite(inviteCode));
    if (cachedRoomId) {
      const cachedResult = await queryable.query<RoomRow>(
        `
          SELECT id, invite_code, title, locked, created_at, expires_at
          FROM rooms
          WHERE id = $1 AND invite_code = $2
          FOR UPDATE
        `,
        [cachedRoomId, inviteCode]
      );
      if (cachedResult.rows[0]) {
        return cachedResult.rows[0];
      }
      await bestEffort(() => roomState?.deleteInvite(inviteCode));
    }

    const result = await queryable.query<RoomRow>(
      `
        SELECT id, invite_code, title, locked, created_at, expires_at
        FROM rooms
        WHERE invite_code = $1
        FOR UPDATE
      `,
      [inviteCode]
    );
    const roomRow = result.rows[0];
    if (roomRow) {
      await bestEffort(() =>
        roomState?.indexInvite(roomRow.invite_code, roomRow.id, ttlUntil(roomRow.expires_at))
      );
    }
    return roomRow;
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

    await bestEffort(() => roomState?.trackPresence(roomId, participant.id, sessionTtlMs));
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
      const created = await withTransaction(pool, async (client) => {
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
      await bestEffort(() =>
        roomState?.indexInvite(
          created.room.inviteCode,
          created.room.id,
          ttlUntil(created.room.expiresAt)
        )
      );
      await bestEffort(() =>
        roomState?.trackPresence(created.room.id, created.participant.id, sessionTtlMs)
      );
      return created;
    },

    async joinRoom(input: JoinRoomInput): Promise<RoomSession | StoreError> {
      const result = await withTransaction(pool, async (client) => {
        const roomRow = await findRoomRowByInvite(client, input.inviteCode);
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
      if (!("error" in result)) {
        await bestEffort(() =>
          roomState?.trackPresence(result.room.id, result.participant.id, sessionTtlMs)
        );
      }
      return result;
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
      const result = await withTransaction(pool, async (client) => {
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
      if (!("error" in result)) {
        await bestEffort(() => roomState?.removePresence(roomId, result.removedParticipantIds));
      }
      return result;
    },

    async rotateInvite(roomId: string, sessionToken: string) {
      const result = await withTransaction(pool, async (client) => {
        const activeSession = await requireRole(client, roomId, sessionToken, ["host", "cohost"]);
        if (!activeSession) {
          return { error: "Forbidden" };
        }
        const oldInviteCode = activeSession.room.inviteCode;
        await client.query("UPDATE rooms SET invite_code = $1 WHERE id = $2", [
          createInviteCode(),
          roomId
        ]);
        const room = await loadRoom(client, roomId);
        if (!room) {
          return { error: "Forbidden" };
        }
        return { room, oldInviteCode };
      });
      if ("error" in result) {
        return result;
      }
      await bestEffort(() => roomState?.deleteInvite(result.oldInviteCode));
      await bestEffort(() =>
        roomState?.indexInvite(
          result.room.inviteCode,
          result.room.id,
          ttlUntil(result.room.expiresAt)
        )
      );
      return { room: result.room };
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
      if (roomState) {
        const accepted = await acceptRedisSyncSequence(
          roomState,
          roomId,
          command.sequence,
          activeSession.room
        );
        if (!accepted) {
          return { error: "Replay detected" };
        }
      } else {
        const lastSequence = lastSyncSequenceByRoom.get(roomId) ?? -1;
        if (command.sequence <= lastSequence) {
          return { error: "Replay detected" };
        }
        lastSyncSequenceByRoom.set(roomId, command.sequence);
      }
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

function ttlUntil(value: Date | string) {
  return Math.max(1_000, Date.parse(toIsoString(value)) - Date.now());
}

async function bestEffort<T>(callback: () => Promise<T> | undefined) {
  try {
    return await callback();
  } catch {
    return undefined;
  }
}

async function acceptRedisSyncSequence(
  roomState: RedisRoomState,
  roomId: string,
  sequence: number,
  room: Room
) {
  try {
    return await roomState.acceptSyncSequence(roomId, sequence, ttlUntil(room.expiresAt));
  } catch {
    return false;
  }
}
