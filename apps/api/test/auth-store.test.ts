import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createAuthStore, validateAuthConfig } from "../src/auth-store";
import { createPostgresAuthStore } from "../src/postgres-auth-store";
import { createPostgresPool, runPostgresMigrations, type PostgresPool } from "../src/postgres";

describe("memory auth store", () => {
  it("creates single-use magic-link account sessions", async () => {
    const previousDevMagicLinks = process.env.AUTH_DEV_MAGIC_LINKS;
    process.env.AUTH_DEV_MAGIC_LINKS = "true";
    const store = createAuthStore();
    try {
      const requested = await store.requestMagicLink({
        email: "Host@Example.com",
        displayName: "Host"
      });

      expect(requested.devToken).toMatch(/^cml_/);
      expect(requested.devLink).toContain("#token=cml_");

      const session = await store.verifyMagicLink(requested.devToken ?? "");
      expect("error" in session).toBe(false);
      if ("error" in session) {
        throw new Error(session.error);
      }
      expect(session.account.email).toBe("host@example.com");
      expect(session.sessionToken).toMatch(/^cas_/);
      expect(session.authMethod).toBe("magic_link");

      await expect(store.verifyMagicLink(requested.devToken ?? "")).resolves.toEqual({
        error: "Invalid or expired magic link"
      });
      await expect(store.requireSession(session.sessionToken)).resolves.toMatchObject({
        id: session.account.id
      });
    } finally {
      restoreEnv("AUTH_DEV_MAGIC_LINKS", previousDevMagicLinks);
    }
  });

  it("does not expose magic-link tokens unless explicitly enabled", async () => {
    const previousDevMagicLinks = process.env.AUTH_DEV_MAGIC_LINKS;
    delete process.env.AUTH_DEV_MAGIC_LINKS;
    const store = createAuthStore();
    try {
      const requested = await store.requestMagicLink({
        email: "host@example.com"
      });

      expect(requested.accepted).toBe(true);
      expect(requested.devToken).toBeUndefined();
      expect(requested.devLink).toBeUndefined();
    } finally {
      restoreEnv("AUTH_DEV_MAGIC_LINKS", previousDevMagicLinks);
    }
  });

  it("fails closed for invalid WebAuthn relying party config", () => {
    const previousRpId = process.env.AUTH_RP_ID;
    try {
      process.env.AUTH_RP_ID = "https://cueroom.example";
      expect(() => validateAuthConfig()).toThrow(/AUTH_RP_ID/);
    } finally {
      if (previousRpId === undefined) {
        delete process.env.AUTH_RP_ID;
      } else {
        process.env.AUTH_RP_ID = previousRpId;
      }
    }
  });

  it("rejects dev magic-link token disclosure in production config", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousDevMagicLinks = process.env.AUTH_DEV_MAGIC_LINKS;
    try {
      process.env.NODE_ENV = "production";
      process.env.AUTH_DEV_MAGIC_LINKS = "true";
      expect(() => validateAuthConfig()).toThrow(/AUTH_DEV_MAGIC_LINKS/);
    } finally {
      restoreEnv("NODE_ENV", previousNodeEnv);
      restoreEnv("AUTH_DEV_MAGIC_LINKS", previousDevMagicLinks);
    }
  });
});

const describePostgres = process.env.POSTGRES_TEST_URL ? describe : describe.skip;

describePostgres("Postgres auth store", () => {
  let pool: PostgresPool;

  beforeAll(async () => {
    pool = createPostgresPool(process.env.POSTGRES_TEST_URL);
    await runPostgresMigrations(pool);
  });

  afterEach(async () => {
    await pool.query("DELETE FROM magic_links");
    await pool.query("DELETE FROM webauthn_challenges");
    await pool.query("DELETE FROM accounts");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("stores only hashed auth and magic-link tokens", async () => {
    const previousDevMagicLinks = process.env.AUTH_DEV_MAGIC_LINKS;
    process.env.AUTH_DEV_MAGIC_LINKS = "true";
    const store = createPostgresAuthStore(pool);
    try {
      const requested = await store.requestMagicLink({
        email: `host-${process.pid}@example.com`,
        displayName: "Host"
      });
      const tokenRows = await pool.query<{ token_hash: string }>(
        "SELECT token_hash FROM magic_links"
      );
      expect(tokenRows.rows[0]?.token_hash).not.toBe(requested.devToken);
      expect(tokenRows.rows[0]?.token_hash).not.toContain("cml_");

      const session = await store.verifyMagicLink(requested.devToken ?? "");
      expect("error" in session).toBe(false);
      if ("error" in session) {
        throw new Error(session.error);
      }

      const sessionRows = await pool.query<{ token_hash: string }>(
        "SELECT token_hash FROM auth_sessions"
      );
      expect(sessionRows.rows[0]?.token_hash).not.toBe(session.sessionToken);
      expect(sessionRows.rows[0]?.token_hash).not.toContain("cas_");

      await expect(store.verifyMagicLink(requested.devToken ?? "")).resolves.toEqual({
        error: "Invalid or expired magic link"
      });
    } finally {
      restoreEnv("AUTH_DEV_MAGIC_LINKS", previousDevMagicLinks);
    }
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
