import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadSecretEnvFiles, validateProductionRuntimeConfig } from "../src/env";

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("loadSecretEnvFiles", () => {
  it("loads supported environment values from Docker secret files", () => {
    const filePath = writeSecretFile("postgres://cueroom:secret@postgres:5432/cueroom\n");
    const env: NodeJS.ProcessEnv = {
      POSTGRES_URL_FILE: filePath
    };

    loadSecretEnvFiles(env);

    expect(env.POSTGRES_URL).toBe("postgres://cueroom:secret@postgres:5432/cueroom");
  });

  it("keeps an explicit environment value when both value and file are present", () => {
    const filePath = writeSecretFile("from-file");
    const env: NodeJS.ProcessEnv = {
      LIVEKIT_API_SECRET: "from-env",
      LIVEKIT_API_SECRET_FILE: filePath
    };

    loadSecretEnvFiles(env);

    expect(env.LIVEKIT_API_SECRET).toBe("from-env");
  });

  it("rejects empty secret files", () => {
    const filePath = writeSecretFile("\n");
    const env: NodeJS.ProcessEnv = {
      SMTP_PASSWORD_FILE: filePath
    };

    expect(() => loadSecretEnvFiles(env)).toThrow(/SMTP_PASSWORD_FILE/);
  });
});

describe("validateProductionRuntimeConfig", () => {
  it("requires Postgres-backed auth-gated production runtime state", () => {
    expect(() =>
      validateProductionRuntimeConfig({
        NODE_ENV: "production",
        ROOM_STORE: "memory",
        AUTH_REQUIRED: "true",
        POSTGRES_URL: "postgres://cueroom:secret@postgres:5432/cueroom",
        REDIS_URL: "redis://:secret@redis:6379"
      })
    ).toThrow(/ROOM_STORE/);
  });

  it("requires Redis and Postgres URLs in production", () => {
    expect(() =>
      validateProductionRuntimeConfig({
        NODE_ENV: "production",
        ROOM_STORE: "postgres",
        AUTH_REQUIRED: "true",
        POSTGRES_URL: "postgres://cueroom:secret@postgres:5432/cueroom"
      })
    ).toThrow(/REDIS_URL/);
  });

  it("requires authenticated Redis URLs in production", () => {
    expect(() =>
      validateProductionRuntimeConfig({
        NODE_ENV: "production",
        ROOM_STORE: "postgres",
        AUTH_REQUIRED: "true",
        POSTGRES_URL: "postgres://cueroom:secret@postgres:5432/cueroom",
        REDIS_URL: "redis://redis:6379"
      })
    ).toThrow(/Redis password/);
  });

  it("accepts the production compose runtime boundary", () => {
    expect(() =>
      validateProductionRuntimeConfig({
        NODE_ENV: "production",
        ROOM_STORE: "postgres",
        AUTH_REQUIRED: "true",
        POSTGRES_URL: "postgres://cueroom:secret@postgres:5432/cueroom",
        REDIS_URL: "redis://:secret@redis:6379"
      })
    ).not.toThrow();
  });
});

function writeSecretFile(content: string) {
  const tempDir = mkdtempSync(path.join(tmpdir(), "cueroom-env-"));
  tempDirs.push(tempDir);
  const filePath = path.join(tempDir, "secret");
  writeFileSync(filePath, content, "utf8");
  return filePath;
}
