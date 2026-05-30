import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { closeRedisClient, createRedisClient, type RedisClient } from "../src/redis";
import { createRedisRoomState, type RedisRoomState } from "../src/redis-room-state";

const describeRedis = process.env.REDIS_TEST_URL ? describe : describe.skip;

describeRedis("Redis room state", () => {
  const keyPrefix = `cueroom-test-redis-${process.pid}`;
  let redis: RedisClient;
  let state: RedisRoomState;

  beforeAll(async () => {
    redis = createRedisClient(process.env.REDIS_TEST_URL);
    state = createRedisRoomState(redis, keyPrefix);
    await redis.ping();
  });

  afterEach(async () => {
    await deleteCueRoomKeys(redis, keyPrefix);
  });

  afterAll(async () => {
    await closeRedisClient(redis);
  });

  it("indexes invites and tracks advisory presence with TTLs", async () => {
    await state.indexInvite("invite_1", "room_1", 5_000);
    expect(await state.getRoomIdByInvite("invite_1")).toBe("room_1");
    expect(await redis.pttl(state.keys.invite("invite_1"))).toBeGreaterThan(0);

    await state.trackPresence("room_1", "participant_1", 5_000);
    expect(await state.getPresence("room_1")).toContain("participant_1");
    expect(await redis.pttl(state.keys.presence("room_1"))).toBeGreaterThan(0);

    await state.removePresence("room_1", ["participant_1"]);
    expect(await state.getPresence("room_1")).not.toContain("participant_1");
  });

  it("accepts only monotonic sync sequences", async () => {
    await expect(state.acceptSyncSequence("room_1", 1, 5_000)).resolves.toBe(true);
    await expect(state.acceptSyncSequence("room_1", 1, 5_000)).resolves.toBe(false);
    await expect(state.acceptSyncSequence("room_1", 2, 5_000)).resolves.toBe(true);
  });
});

async function deleteCueRoomKeys(redis: RedisClient, keyPrefix: string) {
  const keys = await redis.keys(`${keyPrefix}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
