import { readFile } from "node:fs/promises";

const failures = [];
const compose = await readFile("infra/docker/compose.prod.yml", "utf8");
const caddyfile = await readFile("infra/docker/caddy/Caddyfile.prod", "utf8");
const livekitProdExample = await readFile("infra/docker/livekit/livekit.prod.example.yaml", "utf8");
const apiDockerfile = await readFile("apps/api/Dockerfile", "utf8");
const webDockerfile = await readFile("apps/web/Dockerfile", "utf8");
const runbook = await readFile("RUNBOOK.md", "utf8");
const dockerIgnore = await readFile("infra/docker/secrets/.gitignore", "utf8");
const secretsReadme = await readFile("infra/docker/secrets/README.md", "utf8");

for (const requiredText of [
  "POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password",
  "POSTGRES_URL_FILE: /run/secrets/postgres_url",
  "REDIS_URL_FILE: /run/secrets/redis_url",
  "LIVEKIT_API_SECRET_FILE: /run/secrets/livekit_api_secret",
  "SMTP_PASSWORD_FILE: /run/secrets/smtp_password",
  "file: ./secrets/redis_password",
  "file: ./secrets/redis.conf",
  "file: ./secrets/redis_url",
  "file: ./secrets/livekit.yaml",
  "/run/secrets/redis.conf",
  "REDISCLI_AUTH",
  'AUTH_REQUIRED: "true"',
  "read_only: true",
  "no-new-privileges:true",
  "50000-60000:50000-60000/udp",
  "80:80",
  "443:443"
]) {
  requireText(compose, requiredText, "infra/docker/compose.prod.yml");
}

for (const forbiddenText of [
  "POSTGRES_PASSWORD:",
  "POSTGRES_URL:",
  "REDIS_URL:",
  "LIVEKIT_API_SECRET:",
  "SMTP_PASSWORD:",
  "AUTH_DEV_MAGIC_LINKS"
]) {
  forbidText(compose, forbiddenText, "infra/docker/compose.prod.yml");
}

for (const internalService of ["postgres", "redis", "api", "web"]) {
  const block = requireServiceBlock(compose, internalService);
  if (/\n {4}ports:/.test(block)) {
    failures.push(`${internalService} must not publish host ports in compose.prod.yml.`);
  }
}

for (const hardenedService of ["redis", "api", "web"]) {
  const block = requireServiceBlock(compose, hardenedService);
  requireText(block, "healthcheck:", `${hardenedService} service`);
  requireText(block, "cap_drop:", `${hardenedService} service`);
  requireText(block, "no-new-privileges:true", `${hardenedService} service`);
  requireText(block, "read_only: true", `${hardenedService} service`);
}

requireText(apiDockerfile, "USER node", "apps/api/Dockerfile");
requireText(webDockerfile, "USER node", "apps/web/Dockerfile");

for (const requiredCaddyText of [
  "{$CUEROOM_DOMAIN}",
  "{$CUEROOM_API_DOMAIN}",
  "{$CUEROOM_LIVEKIT_DOMAIN}",
  "reverse_proxy web:3000",
  "reverse_proxy api:4000",
  "reverse_proxy livekit:7880",
  "Strict-Transport-Security"
]) {
  requireText(caddyfile, requiredCaddyText, "infra/docker/caddy/Caddyfile.prod");
}

for (const requiredLiveKitText of [
  "password: replace-with-redis-password",
  "turn:",
  "tls_port:",
  "udp_port:"
]) {
  requireText(
    livekitProdExample,
    requiredLiveKitText,
    "infra/docker/livekit/livekit.prod.example.yaml"
  );
}

for (const requiredSecretsText of ["redis_password", "redis_url", "redis.conf", "requirepass"]) {
  requireText(secretsReadme, requiredSecretsText, "infra/docker/secrets/README.md");
}

for (const requiredRunbookText of [
  "infra/docker/compose.prod.yml",
  "infra/docker/.env.prod.example",
  "infra/docker/secrets/README.md",
  "direct ICE only",
  "Firewall matrix",
  "https://$CUEROOM_DOMAIN/privacy"
]) {
  requireText(runbook, requiredRunbookText, "RUNBOOK.md");
}

if (!dockerIgnore.includes("*") || !dockerIgnore.includes("!README.md")) {
  failures.push("infra/docker/secrets/.gitignore must keep real secret files ignored.");
}

if (failures.length > 0) {
  console.error("Production Docker check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.info("Production Docker check passed.");

function requireText(content, expectedText, filePath) {
  if (!content.includes(expectedText)) {
    failures.push(`${filePath} must include: ${expectedText}`);
  }
}

function forbidText(content, forbiddenText, filePath) {
  if (content.includes(forbiddenText)) {
    failures.push(`${filePath} must not include plaintext secret key: ${forbiddenText}`);
  }
}

function requireServiceBlock(content, serviceName) {
  const match = content.match(
    new RegExp(`^  ${serviceName}:\\n([\\s\\S]*?)(?=^  [a-zA-Z0-9_-]+:|^volumes:|^secrets:)`, "m")
  );
  if (!match) {
    failures.push(`compose.prod.yml is missing service: ${serviceName}.`);
    return "";
  }
  return match[0];
}
