CREATE TABLE IF NOT EXISTS room_reports (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  reporter_participant_id TEXT NOT NULL,
  target_participant_id TEXT NOT NULL,
  reason TEXT NOT NULL CONSTRAINT room_reports_reason_allowed CHECK (
    reason IN ('harassment', 'spam', 'impersonation', 'unsafe_behavior', 'other')
  ),
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT room_reports_distinct_participants CHECK (
    reporter_participant_id <> target_participant_id
  ),
  CONSTRAINT room_reports_details_length CHECK (details IS NULL OR char_length(details) <= 500)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'room_reports_details_length'
      AND conrelid = 'room_reports'::regclass
  ) THEN
    ALTER TABLE room_reports
      ADD CONSTRAINT room_reports_details_length CHECK (
        details IS NULL OR char_length(details) <= 500
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_room_reports_room_created_at ON room_reports (room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_room_reports_target ON room_reports (target_participant_id);
