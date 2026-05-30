import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
  type WebAuthnCredential
} from "@simplewebauthn/server";
import {
  authSessionTtlMs,
  createAccountId,
  createAuthSessionToken,
  createChallengeId,
  deliverMagicLink,
  createMagicLinkResult,
  createMagicLinkToken,
  createWebAuthnUserId,
  getWebAuthnConfig,
  hashSecret,
  magicLinkTtlMs,
  normalizeEmail,
  webauthnChallengeTtlMs,
  type Account,
  type AuthMethod,
  type AuthSession,
  type AuthStoreOptions,
  type AuthStore,
  type MagicLinkRequest,
  type MagicLinkRequestResult,
  type PasskeyRecord
} from "./auth-store.js";
import type { PostgresClient, PostgresPool } from "./postgres.js";
import { withTransaction } from "./postgres.js";
import type { StoreError } from "./room-store.js";

type Queryable = Pick<PostgresPool | PostgresClient, "query">;

type AccountRow = {
  id: string;
  email: string;
  display_name: string;
  webauthn_user_id: string;
  created_at: Date | string;
  last_login_at: Date | string | null;
};

type MagicLinkRow = {
  email_normalized: string;
  display_name: string | null;
};

type ChallengeRow = {
  id: string;
  account_id: string | null;
  email_normalized: string | null;
  challenge: string;
};

type PasskeyRow = {
  credential_id: string;
  account_id: string;
  public_key: Buffer;
  counter: string | number;
  transports: AuthenticatorTransportFuture[] | null;
  device_type: string;
  backed_up: boolean;
};

export function createPostgresAuthStore(
  pool: PostgresPool,
  options: AuthStoreOptions = {}
): AuthStore {
  return {
    async requestMagicLink(input: MagicLinkRequest): Promise<MagicLinkRequestResult> {
      const token = createMagicLinkToken();
      const tokenHash = hashSecret(token);
      const expiresAt = Date.now() + magicLinkTtlMs;
      await pool.query(
        `
          INSERT INTO magic_links (token_hash, email_normalized, display_name, expires_at)
          VALUES ($1, $2, $3, $4)
        `,
        [
          tokenHash,
          normalizeEmail(input.email),
          input.displayName ?? null,
          new Date(expiresAt).toISOString()
        ]
      );
      await deliverMagicLink(options, {
        email: normalizeEmail(input.email),
        ...(input.displayName ? { displayName: input.displayName } : {}),
        token,
        expiresAt
      });
      return createMagicLinkResult(token, expiresAt);
    },

    verifyMagicLink(token: string) {
      return withTransaction(pool, async (client) => {
        const consumed = await client.query<MagicLinkRow>(
          `
            UPDATE magic_links
            SET consumed_at = NOW()
            WHERE token_hash = $1
              AND consumed_at IS NULL
              AND expires_at >= NOW()
            RETURNING email_normalized, display_name
          `,
          [hashSecret(token)]
        );
        const magicLink = consumed.rows[0];
        if (!magicLink) {
          return { error: "Invalid or expired magic link" };
        }
        const account = await upsertAccount(
          client,
          magicLink.email_normalized,
          magicLink.display_name ?? undefined
        );
        return createSession(client, account, "magic_link");
      });
    },

    async requireSession(sessionToken: string) {
      const result = await pool.query<AccountRow>(
        `
          UPDATE auth_sessions
          SET last_seen_at = NOW()
          FROM accounts
          WHERE auth_sessions.account_id = accounts.id
            AND auth_sessions.token_hash = $1
            AND auth_sessions.revoked_at IS NULL
            AND auth_sessions.expires_at >= NOW()
          RETURNING
            accounts.id,
            accounts.email,
            accounts.display_name,
            accounts.webauthn_user_id,
            accounts.created_at,
            accounts.last_login_at
        `,
        [hashSecret(sessionToken)]
      );
      const row = result.rows[0];
      return row ? accountFromRow(row) : null;
    },

    async createPasskeyRegistrationOptions(sessionToken: string) {
      const account = await this.requireSession(sessionToken);
      if (!account) {
        return { error: "Forbidden" };
      }
      const passkeys = await loadPasskeysForAccount(pool, account.id);
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
      await insertChallenge(pool, {
        accountId: account.id,
        type: "registration",
        challenge: options.challenge
      });
      return options;
    },

    async verifyPasskeyRegistration(sessionToken: string, response: RegistrationResponseJSON) {
      const account = await this.requireSession(sessionToken);
      if (!account) {
        return { error: "Forbidden" };
      }
      const challenge = await consumeChallenge(pool, "registration", {
        accountId: account.id
      });
      if (!challenge) {
        return { error: "Invalid or expired passkey challenge" };
      }

      const config = getWebAuthnConfig();
      const verification = await verifyToStoreError(() =>
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

      const { credential, credentialDeviceType, credentialBackedUp, aaguid } =
        verification.registrationInfo;
      try {
        await pool.query(
          `
            INSERT INTO passkey_credentials (
              credential_id,
              account_id,
              public_key,
              counter,
              transports,
              device_type,
              backed_up,
              aaguid
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            credential.id,
            account.id,
            Buffer.from(credential.publicKey),
            credential.counter,
            credential.transports ?? [],
            credentialDeviceType,
            credentialBackedUp,
            aaguid
          ]
        );
      } catch (error) {
        if ((error as { code?: string }).code === "23505") {
          return { error: "Passkey already registered" };
        }
        throw error;
      }
      return { verified: true, credentialId: credential.id };
    },

    async createPasskeyAuthenticationOptions(email: string) {
      const emailNormalized = normalizeEmail(email);
      const account = await findAccountByEmail(pool, emailNormalized);
      const options = await generateAuthenticationOptions({
        rpID: getWebAuthnConfig().rpID,
        userVerification: "required"
      });
      await insertChallenge(pool, {
        ...(account ? { accountId: account.id } : {}),
        emailNormalized,
        type: "authentication",
        challenge: options.challenge
      });
      return options;
    },

    async verifyPasskeyAuthentication(email: string, response: AuthenticationResponseJSON) {
      const emailNormalized = normalizeEmail(email);
      const account = await findAccountByEmail(pool, emailNormalized);
      const challenge = await consumeChallenge(pool, "authentication", {
        ...(account ? { accountId: account.id } : {}),
        emailNormalized
      });
      const passkey = response.id ? await findPasskeyByCredentialId(pool, response.id) : undefined;
      if (!account || !challenge || !passkey || passkey.accountId !== account.id) {
        return { error: "Invalid authentication" };
      }

      const credential = toWebAuthnCredential(passkey);
      const config = getWebAuthnConfig();
      const verification = await verifyToStoreError(() =>
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

      await pool.query(
        `
          UPDATE passkey_credentials
          SET counter = $1,
              device_type = $2,
              backed_up = $3,
              last_used_at = NOW()
          WHERE credential_id = $4
        `,
        [
          verification.authenticationInfo.newCounter,
          verification.authenticationInfo.credentialDeviceType,
          verification.authenticationInfo.credentialBackedUp,
          passkey.credentialId
        ]
      );
      return createSession(pool, account, "passkey");
    }
  };
}

async function upsertAccount(queryable: Queryable, emailNormalized: string, displayName?: string) {
  const result = await queryable.query<AccountRow>(
    `
      INSERT INTO accounts (
        id,
        email,
        email_normalized,
        display_name,
        webauthn_user_id,
        last_login_at
      )
      VALUES ($1, $2, $3, COALESCE($4, split_part($2, '@', 1)), $5, NOW())
      ON CONFLICT (email_normalized) DO UPDATE
      SET display_name = COALESCE($4, accounts.display_name),
          last_login_at = NOW()
      RETURNING id, email, display_name, webauthn_user_id, created_at, last_login_at
    `,
    [
      createAccountId(),
      emailNormalized,
      emailNormalized,
      displayName ?? null,
      createWebAuthnUserId()
    ]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Account upsert failed");
  }
  return accountFromRow(row);
}

async function createSession(
  queryable: Queryable,
  account: Account,
  authMethod: AuthMethod
): Promise<AuthSession> {
  const sessionToken = createAuthSessionToken();
  const expiresAt = new Date(Date.now() + authSessionTtlMs).toISOString();
  await queryable.query(
    `
      INSERT INTO auth_sessions (token_hash, account_id, expires_at, auth_method)
      VALUES ($1, $2, $3, $4)
    `,
    [hashSecret(sessionToken), account.id, expiresAt, authMethod]
  );
  return { account, sessionToken, expiresAt, authMethod };
}

async function findAccountByEmail(queryable: Queryable, emailNormalized: string) {
  const result = await queryable.query<AccountRow>(
    `
      SELECT id, email, display_name, webauthn_user_id, created_at, last_login_at
      FROM accounts
      WHERE email_normalized = $1
    `,
    [emailNormalized]
  );
  return result.rows[0] ? accountFromRow(result.rows[0]) : undefined;
}

async function loadPasskeysForAccount(queryable: Queryable, accountId: string) {
  const result = await queryable.query<PasskeyRow>(
    `
      SELECT credential_id, account_id, public_key, counter, transports, device_type, backed_up
      FROM passkey_credentials
      WHERE account_id = $1
    `,
    [accountId]
  );
  return result.rows.map(passkeyFromRow);
}

async function findPasskeyByCredentialId(queryable: Queryable, credentialId: string) {
  const result = await queryable.query<PasskeyRow>(
    `
      SELECT credential_id, account_id, public_key, counter, transports, device_type, backed_up
      FROM passkey_credentials
      WHERE credential_id = $1
    `,
    [credentialId]
  );
  return result.rows[0] ? passkeyFromRow(result.rows[0]) : undefined;
}

async function insertChallenge(
  queryable: Queryable,
  input: {
    accountId?: string;
    emailNormalized?: string;
    type: "registration" | "authentication";
    challenge: string;
  }
) {
  await queryable.query(
    `
      INSERT INTO webauthn_challenges (
        id,
        account_id,
        email_normalized,
        challenge_type,
        challenge,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      createChallengeId(),
      input.accountId ?? null,
      input.emailNormalized ?? null,
      input.type,
      input.challenge,
      new Date(Date.now() + webauthnChallengeTtlMs).toISOString()
    ]
  );
}

async function consumeChallenge(
  queryable: Queryable,
  type: "registration" | "authentication",
  matcher: { accountId?: string; emailNormalized?: string }
) {
  const result = await queryable.query<ChallengeRow>(
    `
      UPDATE webauthn_challenges
      SET consumed_at = NOW()
      WHERE id = (
        SELECT id
        FROM webauthn_challenges
        WHERE challenge_type = $1
          AND consumed_at IS NULL
          AND expires_at >= NOW()
          AND ($2::TEXT IS NULL OR account_id = $2)
          AND ($3::TEXT IS NULL OR email_normalized = $3)
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING id, account_id, email_normalized, challenge
    `,
    [type, matcher.accountId ?? null, matcher.emailNormalized ?? null]
  );
  return result.rows[0];
}

function accountFromRow(row: AccountRow): Account {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    webauthnUserId: row.webauthn_user_id,
    createdAt: toIsoString(row.created_at),
    lastLoginAt: row.last_login_at ? toIsoString(row.last_login_at) : null
  };
}

function passkeyFromRow(row: PasskeyRow): PasskeyRecord {
  const passkey: PasskeyRecord = {
    credentialId: row.credential_id,
    accountId: row.account_id,
    publicKey: new Uint8Array(row.public_key).slice(),
    counter: Number(row.counter),
    deviceType: row.device_type,
    backedUp: row.backed_up
  };
  if (row.transports) {
    passkey.transports = row.transports;
  }
  return passkey;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function verifyToStoreError<T>(callback: () => Promise<T>): Promise<T | StoreError> {
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
