import { Redis } from "ioredis";

export type RedisClient = InstanceType<typeof Redis>;

export const redisKeyPrefix = "cueroom";

export function createRedisClient(connectionString = process.env.REDIS_URL) {
  if (!connectionString) {
    throw new Error("REDIS_URL is required to create a Redis client");
  }

  const redis = new Redis(connectionString, {
    connectTimeout: 500,
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    retryStrategy(times: number) {
      return times > 2 ? null : Math.min(times * 100, 300);
    }
  });

  redis.on("error", () => {
    // ioredis emits connection errors outside command promises; Fastify logs request failures.
  });

  return redis;
}

export async function closeRedisClient(redis: RedisClient) {
  if (redis.status === "end") {
    return;
  }

  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
