import crypto from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential
} from "@simplewebauthn/server";
import type { StoreError } from "./room-store.js";

export type Account = {
  id: string;
  email: string;
  displayName: string;
  webauthnUserId: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AuthSession = {
  account: Account;
  sessionToken: string;
  expiresAt: string;
  authMethod: AuthMethod;
};

export type AuthMethod = "magic_link" | "passkey";

export type MagicLinkRequest = {
  email: string;
  displayName?: string;
};

export type MagicLinkRequestResult = {
  accepted: true;
  expiresAt: string;
  devToken?: string;
  devLink?: string;
};

export type PasskeyRecord = {
  credentialId: string;
  accountId: string;
  publicKey: WebAuthnCredential["publicKey"];
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  deviceType: string;
  backedUp: boolean;
};

export type AuthStore = {
  requestMagicLink(input: MagicLinkRequest): Promise<MagicLinkRequestResult>;
  verifyMagicLink(token: string): Promise<AuthSession | StoreError>;
  requireSession(sessionToken: string): Promise<Account | null>;
  createPasskeyRegistrationOptions(
    sessionToken: string
  ): Promise<PublicKeyCredentialCreationOptionsJSON | StoreError>;
  verifyPasskeyRegistration(
    sessionToken: string,
    response: RegistrationResponseJSON
  ): Promise<{ verified: true; credentialId: string } | StoreError>;
  createPasskeyAuthenticationOptions(email: string): Promise<PublicKeyCredentialRequestOptionsJSON>;
  verifyPasskeyAuthentication(
    email: string,
    response: AuthenticationResponseJSON
  ): Promise<AuthSession | StoreError>;
};

type MagicLinkRecord = {
  tokenHash: string;
  emailNormalized: string;
  displayName?: string;
  expiresAt: number;
  consumedAt?: number;
};

type SessionRecord = {
  tokenHash: string;
  accountId: string;
  expiresAt: number;
};

type WebAuthnChallengeRecord = {
  id: string;
  accountId?: string;
  emailNormalized?: string;
  type: "registration" | "authentication";
  challenge: string;
  expiresAt: number;
  consumedAt?: number;
};

export const authSessionTtlMs = 30 * 24 * 60 * 60 * 1000;
export const magicLinkTtlMs = 15 * 60 * 1000;
export const webauthnChallengeTtlMs = 5 * 60 * 1000;

export function createAuthStore(): AuthStore {
  const accountsById = new Map<string, Account>();
  const accountIdByEmail = new Map<string, string>();
  const magicLinksByHash = new Map<string, MagicLinkRecord>();
  const sessionsByHash = new Map<string, SessionRecord>();
  const challengesById = new Map<string, WebAuthnChallengeRecord>();
  const passkeysByCredentialId = new Map<string, PasskeyRecord>();

  function findAccountByEmail(email: string) {
    const accountId = accountIdByEmail.get(normalizeEmail(email));
    return accountId ? accountsById.get(accountId) : undefined;
  }

  function upsertAccount(email: string, displayName?: string) {
    const emailNormalized = normalizeEmail(email);
    const existing = findAccountByEmail(emailNormalized);
    const now = new Date().toISOString();
    if (existing) {
      const updated = {
        ...existing,
        displayName: displayName ?? existing.displayName,
        lastLoginAt: now
      };
      accountsById.set(updated.id, updated);
      return updated;
    }

    const account: Account = {
      id: createAccountId(),
      email: emailNormalized,
      displayName: displayName ?? emailNormalized.split("@")[0] ?? "Host",
      webauthnUserId: createWebAuthnUserId(),
      createdAt: now,
      lastLoginAt: now
    };
    accountsById.set(account.id, account);
    accountIdByEmail.set(emailNormalized, account.id);
    return account;
  }

  function createSession(account: Account, authMethod: AuthMethod): AuthSession {
    const sessionToken = createAuthSessionToken();
    const tokenHash = hashSecret(sessionToken);
    const expiresAt = Date.now() + authSessionTtlMs;
    sessionsByHash.set(tokenHash, {
      tokenHash,
      accountId: account.id,
      expiresAt
    });
    return {
      account,
      sessionToken,
      expiresAt: new Date(expiresAt).toISOString(),
      authMethod
    };
  }

  function consumeChallenge(
    type: "registration" | "authentication",
    matcher: (challenge: WebAuthnChallengeRecord) => boolean
  ) {
    const challenge = [...challengesById.values()]
      .filter(
        (entry) =>
          entry.type === type &&
          !entry.consumedAt &&
          entry.expiresAt >= Date.now() &&
          matcher(entry)
      )
      .sort((left, right) => right.expiresAt - left.expiresAt)[0];
    if (!challenge) {
      return undefined;
    }
    challenge.consumedAt = Date.now();
    return challenge;
  }

  const store: AuthStore = {
    async requestMagicLink(input) {
      const token = createMagicLinkToken();
      const tokenHash = hashSecret(token);
      const expiresAt = Date.now() + magicLinkTtlMs;
      const record: MagicLinkRecord = {
        tokenHash,
        emailNormalized: normalizeEmail(input.email),
        expiresAt
      };
      if (input.displayName) {
        record.displayName = input.displayName;
      }
      magicLinksByHash.set(tokenHash, record);
      return createMagicLinkResult(token, expiresAt);
    },

    async verifyMagicLink(token) {
      const record = magicLinksByHash.get(hashSecret(token));
      if (!record || record.consumedAt || record.expiresAt < Date.now()) {
        return { error: "Invalid or expired magic link" };
      }
      record.consumedAt = Date.now();
      return createSession(upsertAccount(record.emailNormalized, record.displayName), "magic_link");
    },

    async requireSession(sessionToken) {
      const session = sessionsByHash.get(hashSecret(sessionToken));
      if (!session || session.expiresAt < Date.now()) {
        return null;
      }
      return accountsById.get(session.accountId) ?? null;
    },

    async createPasskeyRegistrationOptions(sessionToken) {
      const account = await this.requireSession(sessionToken);
      if (!account) {
        return { error: "Forbidden" };
      }
      const passkeys = [...passkeysByCredentialId.values()].filter(
        (passkey) => passkey.accountId === account.id
      );
      const config = getWebAuthnConfig();
      const options = await generateRegistrationOptions({
        rpName: config.rpName,
        rpID: config.rpID,
        userName: account.email,
        userID: Buffer.from(account.webauthnUserId, "base64url"),
        userDisplayName: account.displayName,
        attestationType: "none",
        excludeCredentials: passkeys.map(toCredentialDescriptor),
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required"
        },
        supportedAlgorithmIDs: [-7, -257]
      });
      const challengeId = createChallengeId();
      challengesById.set(challengeId, {
        id: challengeId,
        accountId: account.id,
        type: "registration",
        challenge: options.challenge,
        expiresAt: Date.now() + webauthnChallengeTtlMs
      });
      return options;
    },

    async verifyPasskeyRegistration(sessionToken, response) {
      const account = await this.requireSession(sessionToken);
      if (!account) {
        return { error: "Forbidden" };
      }
      const challenge = consumeChallenge("registration", (entry) => entry.accountId === account.id);
      if (!challenge) {
        return { error: "Invalid or expired passkey challenge" };
      }

      const config = getWebAuthnConfig();
      const verification = await toStoreError(() =>
        verifyRegistrationResponse({
          response,
          expectedChallenge: challenge.challenge,
          expectedOrigin: config.origin,
          expectedRPID: config.rpID,
          requireUserVerification: true,
          supportedAlgorithmIDs: [-7, -257]
        })
      );
      if ("error" in verification) {
        return verification;
      }
      if (!verification.verified) {
        return { error: "Passkey registration failed" };
      }
      const { credential, credentialDeviceType, credentialBackedUp } =
        verification.registrationInfo;
      if (passkeysByCredentialId.has(credential.id)) {
        return { error: "Passkey already registered" };
      }
      const passkey: PasskeyRecord = {
        credentialId: credential.id,
        accountId: account.id,
        publicKey: new Uint8Array(credential.publicKey).slice(),
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp
      };
      if (credential.transports) {
        passkey.transports = credential.transports;
      }
      passkeysByCredentialId.set(credential.id, passkey);
      return { verified: true, credentialId: credential.id };
    },

    async createPasskeyAuthenticationOptions(email) {
      const emailNormalized = normalizeEmail(email);
      const account = findAccountByEmail(emailNormalized);
      const options = await generateAuthenticationOptions({
        rpID: getWebAuthnConfig().rpID,
        userVerification: "required"
      });
      const challengeId = createChallengeId();
      const challenge: WebAuthnChallengeRecord = {
        id: challengeId,
        emailNormalized,
        type: "authentication",
        challenge: options.challenge,
        expiresAt: Date.now() + webauthnChallengeTtlMs
      };
      if (account) {
        challenge.accountId = account.id;
      }
      challengesById.set(challengeId, challenge);
      return options;
    },

    async verifyPasskeyAuthentication(email, response) {
      const emailNormalized = normalizeEmail(email);
      const account = findAccountByEmail(emailNormalized);
      const challenge = consumeChallenge(
        "authentication",
        (entry) =>
          entry.emailNormalized === emailNormalized && (!account || entry.accountId === account.id)
      );
      const passkey = response.id ? passkeysByCredentialId.get(response.id) : undefined;
      if (!account || !challenge || !passkey || passkey.accountId !== account.id) {
        return { error: "Invalid authentication" };
      }

      const credential = toWebAuthnCredential(passkey);
      const config = getWebAuthnConfig();
      const verification = await toStoreError(() =>
        verifyAuthenticationResponse({
          response,
          expectedChallenge: challenge.challenge,
          expectedOrigin: config.origin,
          expectedRPID: config.rpID,
          credential,
          requireUserVerification: true
        })
      );
      if ("error" in verification) {
        return verification;
      }
      if (!verification.verified) {
        return { error: "Invalid authentication" };
      }
      passkey.counter = verification.authenticationInfo.newCounter;
      return createSession(account, "passkey");
    }
  };

  return store;
}

export function createAccountId() {
  return `acct_${crypto.randomUUID()}`;
}

export function createAuthSessionToken() {
  return `cas_${crypto.randomBytes(32).toString("base64url")}`;
}

export function createMagicLinkToken() {
  return `cml_${crypto.randomBytes(32).toString("base64url")}`;
}

export function createWebAuthnUserId() {
  return crypto.randomBytes(32).toString("base64url");
}

export function createChallengeId() {
  return `wch_${crypto.randomUUID()}`;
}

export function hashSecret(secret: string) {
  return crypto.createHash("sha256").update(secret).digest("base64url");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getWebAuthnConfig() {
  return {
    rpName: process.env.AUTH_RP_NAME ?? "CueRoom",
    rpID: process.env.AUTH_RP_ID ?? "localhost",
    origin: process.env.AUTH_ORIGIN ?? "http://localhost:3000"
  };
}

export function validateAuthConfig() {
  const config = getWebAuthnConfig();
  if (config.rpID.includes("://") || !/^[a-z0-9.-]+$/i.test(config.rpID)) {
    throw new Error("AUTH_RP_ID must be a domain name, not a URL");
  }

  const origin = new URL(config.origin);
  const isLocalhost = origin.hostname === "localhost" || origin.hostname === "127.0.0.1";
  if (origin.protocol !== "https:" && !isLocalhost) {
    throw new Error("AUTH_ORIGIN must use https outside localhost");
  }

  if (process.env.AUTH_REQUIRED === "true" && process.env.NODE_ENV === "production") {
    if (!process.env.AUTH_RP_ID || !process.env.AUTH_ORIGIN) {
      throw new Error(
        "AUTH_RP_ID and AUTH_ORIGIN are required when auth is required in production"
      );
    }
  }
}

export function createMagicLinkResult(token: string, expiresAt: number): MagicLinkRequestResult {
  const result: MagicLinkRequestResult = {
    accepted: true,
    expiresAt: new Date(expiresAt).toISOString()
  };
  if (process.env.AUTH_DEV_MAGIC_LINKS === "false" || process.env.NODE_ENV === "production") {
    return result;
  }

  const origin = process.env.AUTH_ORIGIN ?? "http://localhost:3000";
  const devLink = new URL("/auth/magic-link", origin);
  devLink.hash = `token=${token}`;
  return {
    ...result,
    devToken: token,
    devLink: devLink.toString()
  };
}

async function toStoreError<T>(callback: () => Promise<T>): Promise<T | StoreError> {
  try {
    return await callback();
  } catch {
    return { error: "Invalid authentication" };
  }
}

function toCredentialDescriptor(passkey: PasskeyRecord) {
  const descriptor: { id: string; transports?: AuthenticatorTransportFuture[] } = {
    id: passkey.credentialId
  };
  if (passkey.transports) {
    descriptor.transports = passkey.transports;
  }
  return descriptor;
}

function toWebAuthnCredential(passkey: PasskeyRecord): WebAuthnCredential {
  const credential: WebAuthnCredential = {
    id: passkey.credentialId,
    publicKey: passkey.publicKey,
    counter: passkey.counter
  };
  if (passkey.transports) {
    credential.transports = passkey.transports;
  }
  return credential;
}
