import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createPostgresPool, runPostgresMigrations, type PostgresPool } from "../src/postgres";
import { createPostgresRoomStore, hashSessionToken } from "../src/postgres-room-store";

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
