CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  webauthn_user_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  auth_method TEXT NOT NULL CHECK (auth_method IN ('magic_link', 'passkey'))
);

CREATE TABLE IF NOT EXISTS magic_links (
  token_hash TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS passkey_credentials (
  credential_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  public_key BYTEA NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  device_type TEXT NOT NULL,
  backed_up BOOLEAN NOT NULL DEFAULT FALSE,
  aaguid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  email_normalized TEXT,
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('registration', 'authentication')),
  challenge TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  CHECK (account_id IS NOT NULL OR email_normalized IS NOT NULL)
);

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS host_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_account_id ON auth_sessions (account_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links (email_normalized);
CREATE INDEX IF NOT EXISTS idx_magic_links_expires_at ON magic_links (expires_at);
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_account_id ON passkey_credentials (account_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_account_type ON webauthn_challenges (
  account_id,
  challenge_type,
  expires_at
);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_email_type ON webauthn_challenges (
  email_normalized,
  challenge_type,
  expires_at
);
