import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { registerRoutes } from "./routes.js";
import { createPostgresPool, runPostgresMigrations } from "./postgres.js";
import { createPostgresRoomStore } from "./postgres-room-store.js";
import { closeRedisClient, createRedisClient, type RedisClient } from "./redis.js";
import { createRedisRoomState } from "./redis-room-state.js";
import { createRoomStore, type RoomStore } from "./room-store.js";

type BuildServerOptions = {
  store?: RoomStore;
};

export async function buildServer(options: BuildServerOptions = {}) {
  const redis = process.env.REDIS_URL ? createRedisClient() : undefined;
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: ["req.headers.authorization", "*.sessionToken", "*.token"]
    }
  });

  await server.register(cors, {
    origin: (origin, callback) => {
      const allowed = new Set([process.env.WEB_ORIGIN ?? "http://localhost:3000"]);
      if (!origin || allowed.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"), false);
    },
    credentials: true
  });
  await server.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    ...(redis
      ? {
          nameSpace: "cueroom:rate-limit:",
          redis,
          skipOnError: false
        }
      : {})
  });
  await server.register(websocket);

  const store = options.store ?? (await createConfiguredRoomStore(redis));
  server.addHook("onClose", async () => {
    await store.close?.();
    if (redis) {
      await closeRedisClient(redis);
    }
  });
  registerRoutes(server, store);

  return server;
}

async function createConfiguredRoomStore(redis?: RedisClient) {
  if (process.env.ROOM_STORE === "postgres") {
    const pool = createPostgresPool();
    if (process.env.POSTGRES_AUTO_MIGRATE !== "false") {
      await runPostgresMigrations(pool);
    }
    return createPostgresRoomStore(pool, redis ? createRedisRoomState(redis) : undefined);
  }

  return createRoomStore();
}
