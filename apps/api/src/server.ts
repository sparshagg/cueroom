import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { registerRoutes } from "./routes";
import { createRoomStore } from "./room-store";

export async function buildServer() {
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
    timeWindow: "1 minute"
  });
  await server.register(websocket);

  const store = createRoomStore();
  registerRoutes(server, store);

  return server;
}
