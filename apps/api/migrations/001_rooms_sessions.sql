CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  invite_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('host', 'cohost', 'guest')),
  joined_at TIMESTAMPTZ NOT NULL,
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  camera_enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS room_sessions (
  token_hash TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms (expires_at);
CREATE INDEX IF NOT EXISTS idx_participants_room_id ON participants (room_id);
CREATE INDEX IF NOT EXISTS idx_room_sessions_room_participant ON room_sessions (room_id, participant_id);
CREATE INDEX IF NOT EXISTS idx_room_sessions_expires_at ON room_sessions (expires_at);
