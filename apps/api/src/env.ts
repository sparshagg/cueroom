import { readFileSync } from "node:fs";

const secretBackedEnvNames = [
  "POSTGRES_URL",
  "REDIS_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "SMTP_USER",
  "SMTP_PASSWORD"
];

export function loadSecretEnvFiles(env: NodeJS.ProcessEnv = process.env) {
  for (const name of secretBackedEnvNames) {
    const fileName = `${name}_FILE`;
    const filePath = env[fileName]?.trim();
    if (!filePath || env[name]) {
      continue;
    }

    const value = readFileSync(filePath, "utf8").trim();
    if (!value) {
      throw new Error(`${fileName} must not point to an empty secret file`);
    }
    env[name] = value;
  }
}

export function validateProductionRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "production") {
    return;
  }

  const requiredValues: Array<readonly [string, string]> = [
    ["ROOM_STORE", "postgres"],
    ["AUTH_REQUIRED", "true"]
  ];
  for (const [name, expectedValue] of requiredValues) {
    if (env[name] !== expectedValue) {
      throw new Error(`${name} must be ${expectedValue} in production`);
    }
  }

  for (const requiredName of ["POSTGRES_URL", "REDIS_URL"]) {
    if (!env[requiredName]) {
      throw new Error(`${requiredName} is required in production`);
    }
  }

  validateProductionRedisUrl(env.REDIS_URL);
}

function validateProductionRedisUrl(redisUrl: string | undefined) {
  if (!redisUrl) {
    throw new Error("REDIS_URL is required in production");
  }

  let parsed: URL;
  try {
    parsed = new URL(redisUrl);
  } catch {
    throw new Error("REDIS_URL must be a valid redis:// or rediss:// URL in production");
  }

  if (!["redis:", "rediss:"].includes(parsed.protocol)) {
    throw new Error("REDIS_URL must use redis:// or rediss:// in production");
  }

  if (!parsed.password) {
    throw new Error("REDIS_URL must include a Redis password in production");
  }
}
