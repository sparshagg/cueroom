import { readFile } from "node:fs/promises";

const routesPath = "apps/api/src/routes.ts";
const routesSource = await readFile(routesPath, "utf8");
const failures = [];

const expectedRouteLimits = [
  {
    route: 'server.post("/v1/rooms", roomCreateRateLimit,',
    reason: "room creation can verify account sessions when AUTH_REQUIRED is enabled"
  },
  {
    route: 'server.get("/v1/rooms/:roomId", roomReadRateLimit,',
    reason: "room metadata reads authorize room session tokens"
  },
  {
    route: 'server.post("/v1/rooms/join", roomJoinRateLimit,',
    reason: "invite joins are abuse-sensitive"
  },
  {
    route: 'server.post("/v1/rooms/:roomId/lock", roomControlRateLimit,',
    reason: "room lock changes authorize host/cohost session tokens"
  },
  {
    route: 'server.post("/v1/rooms/:roomId/kick", roomControlRateLimit,',
    reason: "room kick changes authorize host/cohost session tokens"
  },
  {
    route: 'server.post("/v1/rooms/:roomId/rotate-invite", roomControlRateLimit,',
    reason: "invite rotation authorizes host/cohost session tokens"
  },
  {
    route: 'server.post("/v1/rooms/:roomId/report", roomReportRateLimit,',
    reason: "participant reports authorize room session tokens and persist report metadata"
  },
  {
    route: 'server.post("/v1/livekit/token", tokenMintRateLimit,',
    reason: "LiveKit token minting authorizes room session tokens"
  },
  {
    route: 'server.post("/v1/rooms/:roomId/sync-command", syncCommandRateLimit,',
    reason: "HTTP sync commands authorize host/cohost session tokens"
  },
  {
    route: 'server.get("/v1/rooms/:roomId/realtime", realtimeHandshakeRateLimit,',
    reason: "realtime websocket handshakes authenticate room session tokens"
  }
];

for (const expected of expectedRouteLimits) {
  if (!routesSource.includes(expected.route)) {
    failures.push(`${routesPath} missing route limiter for ${expected.reason}: ${expected.route}`);
  }
}

for (const limiterName of [
  "roomCreateRateLimit",
  "roomJoinRateLimit",
  "roomReadRateLimit",
  "roomControlRateLimit",
  "syncCommandRateLimit",
  "realtimeHandshakeRateLimit"
]) {
  if (!routesSource.includes(`const ${limiterName} = {`)) {
    failures.push(`${routesPath} missing limiter definition: ${limiterName}`);
  }
}

if (failures.length > 0) {
  console.error(`API rate-limit check failed:\n${failures.join("\n")}`);
  process.exit(1);
}

console.info(`API rate-limit check passed for ${expectedRouteLimits.length} routes.`);
