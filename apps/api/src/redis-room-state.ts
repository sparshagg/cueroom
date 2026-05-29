import type { RedisClient } from "./redis.js";
import { redisKeyPrefix } from "./redis.js";

export type RedisRoomState = ReturnType<typeof createRedisRoomState>;

const acceptSequenceScript = `
  local key = KEYS[1]
  local sequence = tonumber(ARGV[1])
  local ttl = tonumber(ARGV[2])
  local current = redis.call('GET', key)

  if current and sequence <= tonumber(current) then
    return 0
  end

  redis.call('SET', key, sequence, 'PX', ttl)
  return 1
`;

export function createRedisRoomState(redis: RedisClient, keyPrefix = redisKeyPrefix) {
  const inviteKey = (inviteCode: string) => `${keyPrefix}:invite:${inviteCode}`;
  const presenceKey = (roomId: string) => `${keyPrefix}:presence:${roomId}`;
  const syncSequenceKey = (roomId: string) => `${keyPrefix}:sync-seq:${roomId}`;

  return {
    async indexInvite(inviteCode: string, roomId: string, ttlMs: number) {
      await redis.set(inviteKey(inviteCode), roomId, "PX", clampTtl(ttlMs));
    },

    getRoomIdByInvite(inviteCode: string) {
      return redis.get(inviteKey(inviteCode));
    },

    async deleteInvite(inviteCode: string) {
      await redis.del(inviteKey(inviteCode));
    },

    async trackPresence(roomId: string, participantId: string, ttlMs: number) {
      const key = presenceKey(roomId);
      await redis.multi().sadd(key, participantId).pexpire(key, clampTtl(ttlMs)).exec();
    },

    async removePresence(roomId: string, participantIds: string[]) {
      if (participantIds.length === 0) {
        return;
      }
      await redis.srem(presenceKey(roomId), ...participantIds);
    },

    async getPresence(roomId: string) {
      return redis.smembers(presenceKey(roomId));
    },

    async acceptSyncSequence(roomId: string, sequence: number, ttlMs: number) {
      const accepted = await redis.eval(
        acceptSequenceScript,
        1,
        syncSequenceKey(roomId),
        sequence,
        clampTtl(ttlMs)
      );
      return accepted === 1;
    },

    async clearRoom(roomId: string) {
      await redis.del(presenceKey(roomId), syncSequenceKey(roomId));
    },

    keys: {
      invite: inviteKey,
      presence: presenceKey,
      syncSequence: syncSequenceKey
    }
  };
}

function clampTtl(ttlMs: number) {
  return Math.max(1_000, Math.ceil(ttlMs));
}
