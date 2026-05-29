import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { registerRoutes } from "./routes.js";
import { createPostgresPool, runPostgresMigrations } from "./postgres.js";
import { createPostgresAuthStore } from "./postgres-auth-store.js";
import { createPostgresRoomStore } from "./postgres-room-store.js";
import { closeRedisClient, createRedisClient, type RedisClient } from "./redis.js";
import { createRedisRoomState } from "./redis-room-state.js";
import { createRoomStore, type RoomStore } from "./room-store.js";
import { createAuthStore, validateAuthConfig, type AuthStore } from "./auth-store.js";
import { createConfiguredMailer, validateEmailConfig, type MagicLinkMailer } from "./email.js";
import { validateLiveKitConfig } from "./livekit.js";

type RemoveLiveKitParticipant = (roomId: string, participantId: string) => Promise<void>;

type BuildServerOptions = {
  store?: RoomStore;
  authStore?: AuthStore;
  mailer?: MagicLinkMailer;
  removeLiveKitParticipant?: RemoveLiveKitParticipant;
};

export async function buildServer(options: BuildServerOptions = {}) {
  validateAuthConfig();
  validateEmailConfig();
  validateLiveKitConfig();
  const redis = process.env.REDIS_URL ? createRedisClient() : undefined;
  const mailer = options.mailer ?? createConfiguredMailer();
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: [
        "req.headers.authorization",
        "*.sessionToken",
        "*.accountSessionToken",
        "*.token",
        "*.devToken",
        "*.devLink",
        "*.magicLinkUrl"
      ]
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
  await server.register(websocket, {
    options: {
      maxPayload: 64 * 1024
    }
  });
  server.addHook("onRequest", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
  });

  const configuredStores = await createConfiguredStores(redis, options, mailer);
  const store = configuredStores.store;
  const authStore = configuredStores.authStore;
  server.addHook("onClose", async () => {
    await store.close?.();
    if (redis) {
      await closeRedisClient(redis);
    }
    await mailer?.close?.();
  });
  if (options.removeLiveKitParticipant) {
    registerRoutes(server, store, authStore, {
      removeLiveKitParticipant: options.removeLiveKitParticipant
    });
  } else {
    registerRoutes(server, store, authStore);
  }

  return server;
}

async function createConfiguredStores(
  redis: RedisClient | undefined,
  options: BuildServerOptions,
  mailer: MagicLinkMailer | undefined
): Promise<{ store: RoomStore; authStore: AuthStore }> {
  const deliverMagicLink = mailer?.sendMagicLink.bind(mailer);
  if (options.store || options.authStore) {
    return {
      store: options.store ?? createRoomStore(),
      authStore: options.authStore ?? createMemoryAuthStore(deliverMagicLink)
    };
  }

  if (process.env.ROOM_STORE === "postgres") {
    const pool = createPostgresPool();
    if (process.env.POSTGRES_AUTO_MIGRATE !== "false") {
      await runPostgresMigrations(pool);
    }
    return {
      store: createPostgresRoomStore(pool, redis ? createRedisRoomState(redis) : undefined),
      authStore: deliverMagicLink
        ? createPostgresAuthStore(pool, { deliverMagicLink })
        : createPostgresAuthStore(pool)
    };
  }

  return {
    store: createRoomStore(),
    authStore: createMemoryAuthStore(deliverMagicLink)
  };
}

function createMemoryAuthStore(deliverMagicLink: MagicLinkMailer["sendMagicLink"] | undefined) {
  return deliverMagicLink ? createAuthStore({ deliverMagicLink }) : createAuthStore();
}
