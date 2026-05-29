import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createPostgresPool, runPostgresMigrations, type PostgresPool } from "../src/postgres";
import { createPostgresRoomStore, hashSessionToken } from "../src/postgres-room-store";
import { closeRedisClient, createRedisClient, type RedisClient } from "../src/redis";
import { createRedisRoomState, type RedisRoomState } from "../src/redis-room-state";

const describePostgres = process.env.POSTGRES_TEST_URL ? describe : describe.skip;

describePostgres("Postgres room store", () => {
  let pool: PostgresPool;

  beforeAll(async () => {
    pool = createPostgresPool(process.env.POSTGRES_TEST_URL);
    await runPostgresMigrations(pool);
  });

  afterEach(async () => {
    await pool.query("DELETE FROM rooms");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("persists room membership and hashed sessions across store instances", async () => {
    const firstStore = createPostgresRoomStore(pool);
    const created = await firstStore.createRoom({
      hostName: "Host",
      title: "Persistent room"
    });

    const secondStore = createPostgresRoomStore(pool);
    const activeSession = await secondStore.requireSession(created.room.id, created.sessionToken);
    expect(activeSession?.participant.id).toBe(created.participant.id);

    const tokenRows = await pool.query<{ token_hash: string }>(
      "SELECT token_hash FROM room_sessions WHERE room_id = $1",
      [created.room.id]
    );
    expect(tokenRows.rows).toHaveLength(1);
    expect(tokenRows.rows[0]?.token_hash).toBe(hashSessionToken(created.sessionToken));
    expect(tokenRows.rows[0]?.token_hash).not.toBe(created.sessionToken);
  });

  it("rotates invites and rejects removed participant sessions", async () => {
    const store = createPostgresRoomStore(pool);
    const created = await store.createRoom({
      hostName: "Host",
      title: "Controls room"
    });
    const guest = await store.joinRoom({
      inviteCode: created.room.inviteCode,
      displayName: "Guest"
    });
    expect("error" in guest).toBe(false);
    if ("error" in guest) {
      throw new Error(guest.error);
    }

    const rotated = await store.rotateInvite(created.room.id, created.sessionToken);
    expect("error" in rotated).toBe(false);
    if ("error" in rotated) {
      throw new Error(rotated.error);
    }
    expect(rotated.room.inviteCode).not.toBe(created.room.inviteCode);

    const oldInviteJoin = await store.joinRoom({
      inviteCode: created.room.inviteCode,
      displayName: "Late guest"
    });
    expect(oldInviteJoin).toEqual({ error: "Invite not found" });

    const kicked = await store.kick(created.room.id, created.sessionToken, guest.participant.id);
    expect("error" in kicked).toBe(false);
    expect(await store.requireSession(created.room.id, guest.sessionToken)).toBeNull();
  });
});

const describePostgresRedis =
  process.env.POSTGRES_TEST_URL && process.env.REDIS_TEST_URL ? describe : describe.skip;

describePostgresRedis("Postgres room store with Redis ephemeral state", () => {
  const keyPrefix = `cueroom-test-postgres-${process.pid}`;
  let pool: PostgresPool;
  let redis: RedisClient;
  let state: RedisRoomState;

  beforeAll(async () => {
    pool = createPostgresPool(process.env.POSTGRES_TEST_URL);
    redis = createRedisClient(process.env.REDIS_TEST_URL);
    state = createRedisRoomState(redis, keyPrefix);
    await runPostgresMigrations(pool);
    await redis.ping();
  });

  afterEach(async () => {
    await pool.query("DELETE FROM rooms");
    await deleteCueRoomKeys(redis, keyPrefix);
  });

  afterAll(async () => {
    await pool.end();
    await closeRedisClient(redis);
  });

  it("repairs invite index misses from Postgres and invalidates rotated invites", async () => {
    const store = createPostgresRoomStore(pool, state);
    const created = await store.createRoom({
      hostName: "Host",
      title: "Redis invite room"
    });

    await state.deleteInvite(created.room.inviteCode);
    expect(await state.getRoomIdByInvite(created.room.inviteCode)).toBeNull();

    const joined = await store.joinRoom({
      inviteCode: created.room.inviteCode,
      displayName: "Guest"
    });
    expect("error" in joined).toBe(false);
    expect(await state.getRoomIdByInvite(created.room.inviteCode)).toBe(created.room.id);

    const rotated = await store.rotateInvite(created.room.id, created.sessionToken);
    expect("error" in rotated).toBe(false);
    if ("error" in rotated) {
      throw new Error(rotated.error);
    }

    expect(await state.getRoomIdByInvite(created.room.inviteCode)).toBeNull();
    expect(await state.getRoomIdByInvite(rotated.room.inviteCode)).toBe(created.room.id);
    await expect(
      store.joinRoom({
        inviteCode: created.room.inviteCode,
        displayName: "Late guest"
      })
    ).resolves.toEqual({ error: "Invite not found" });
  });

  it("removes kicked participants from advisory presence", async () => {
    const store = createPostgresRoomStore(pool, state);
    const created = await store.createRoom({
      hostName: "Host",
      title: "Redis presence room"
    });
    const guest = await store.joinRoom({
      inviteCode: created.room.inviteCode,
      displayName: "Guest"
    });
    expect("error" in guest).toBe(false);
    if ("error" in guest) {
      throw new Error(guest.error);
    }

    expect(await state.getPresence(created.room.id)).toContain(guest.participant.id);
    await store.kick(created.room.id, created.sessionToken, guest.participant.id);
    expect(await state.getPresence(created.room.id)).not.toContain(guest.participant.id);
  });

  it("rejects replayed sync sequences across store instances", async () => {
    const firstStore = createPostgresRoomStore(pool, state);
    const secondStore = createPostgresRoomStore(pool, state);
    const created = await firstStore.createRoom({
      hostName: "Host",
      title: "Redis sync room"
    });
    const command = {
      roomId: created.room.id,
      actorId: created.participant.id,
      command: "pause" as const,
      issuedAt: Date.now(),
      sequence: 1
    };

    await expect(
      firstStore.acceptSyncCommand(created.room.id, created.sessionToken, command)
    ).resolves.toEqual({ accepted: true, command });
    await expect(
      secondStore.acceptSyncCommand(created.room.id, created.sessionToken, command)
    ).resolves.toEqual({ error: "Replay detected" });
  });
});

async function deleteCueRoomKeys(redis: RedisClient, keyPrefix: string) {
  const keys = await redis.keys(`${keyPrefix}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
