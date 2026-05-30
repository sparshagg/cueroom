import type { AccountSession, AuthMethod } from "./api";

type AccountSessionStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export const accountSessionChangedEvent = "cueroom:account-session-changed";
export const accountSessionStorageKey = "cueroom.accountSession";

export function storeAccountSession(session: AccountSession, storage = getBrowserStorage()) {
  if (!isValidAccountSession(session)) {
    return;
  }
  storage?.setItem(accountSessionStorageKey, JSON.stringify(session));
  notifyAccountSessionChanged();
}

export function readAccountSession(storage = getBrowserStorage()): AccountSession | null {
  const rawSession = storage?.getItem(accountSessionStorageKey);
  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as unknown;
    if (!isValidAccountSession(parsed) || Date.parse(parsed.expiresAt) <= Date.now()) {
      storage?.removeItem(accountSessionStorageKey);
      return null;
    }
    return parsed;
  } catch {
    storage?.removeItem(accountSessionStorageKey);
    return null;
  }
}

export function clearAccountSession(storage = getBrowserStorage()) {
  storage?.removeItem(accountSessionStorageKey);
  notifyAccountSessionChanged();
}

function notifyAccountSessionChanged() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(accountSessionChangedEvent));
}

function getBrowserStorage(): AccountSessionStorage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.sessionStorage;
}

function isValidAccountSession(value: unknown): value is AccountSession {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isAccountSessionToken(value.accountSessionToken) &&
    isIsoDateString(value.expiresAt) &&
    isAuthMethod(value.authMethod) &&
    isValidAccount(value.account)
  );
}

function isValidAccount(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length >= 8 &&
    typeof value.email === "string" &&
    value.email.length >= 3 &&
    typeof value.displayName === "string" &&
    value.displayName.length >= 1 &&
    typeof value.webauthnUserId === "string" &&
    value.webauthnUserId.length >= 8 &&
    isIsoDateString(value.createdAt) &&
    (value.lastLoginAt === null || isIsoDateString(value.lastLoginAt))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isAuthMethod(value: unknown): value is AuthMethod {
  return value === "magic_link" || value === "passkey";
}

function isAccountSessionToken(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("cas_") && value.length >= 24;
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
