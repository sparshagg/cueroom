import { describe, expect, it, vi } from "vitest";
import type { AccountSession } from "./api";
import {
  accountSessionStorageKey,
  clearAccountSession,
  readAccountSession,
  storeAccountSession
} from "./account-session";

describe("account session storage", () => {
  it("stores valid account sessions and removes them on sign out", () => {
    const storage = createMemoryStorage();
    const session = createAccountSession();

    storeAccountSession(session, storage);
    expect(readAccountSession(storage)).toEqual(session);

    clearAccountSession(storage);
    expect(readAccountSession(storage)).toBeNull();
  });

  it("removes expired or malformed sessions", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      accountSessionStorageKey,
      JSON.stringify(createAccountSession({ expiresAt: "2000-01-01T00:00:00.000Z" }))
    );

    expect(readAccountSession(storage)).toBeNull();
    expect(storage.getItem(accountSessionStorageKey)).toBeNull();

    storage.setItem(accountSessionStorageKey, JSON.stringify({ accountSessionToken: "cas_bad" }));
    expect(readAccountSession(storage)).toBeNull();
    expect(storage.getItem(accountSessionStorageKey)).toBeNull();
  });
});

function createAccountSession(overrides: Partial<AccountSession> = {}): AccountSession {
  return {
    account: {
      id: "acct_12345678",
      email: "host@example.com",
      displayName: "Host",
      webauthnUserId: "webauthn_12345678",
      createdAt: "2099-05-29T12:00:00.000Z",
      lastLoginAt: "2099-05-29T12:00:00.000Z"
    },
    accountSessionToken: "cas_123456789012345678901234",
    expiresAt: "2099-06-29T12:00:00.000Z",
    authMethod: "magic_link",
    ...overrides
  };
}

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    })
  };
}
