-- Align match lifecycle with automated battle states.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS kickoff TIMESTAMP WITH TIME ZONE;

-- Backfill kickoff from existing starts_at values.
UPDATE matches
SET kickoff = COALESCE(kickoff, starts_at)
WHERE kickoff IS NULL;

-- Normalize legacy status values into upcoming/open/closed.
UPDATE matches
SET status = CASE
  WHEN LOWER(COALESCE(status, '')) IN ('completed', 'finished', 'closed') THEN 'closed'
  WHEN LOWER(COALESCE(status, '')) IN ('live', 'open') THEN 'open'
  ELSE 'upcoming'
END;

ALTER TABLE matches
  ALTER COLUMN status SET DEFAULT 'upcoming';

ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_status_check;

ALTER TABLE matches
  ADD CONSTRAINT matches_status_check
  CHECK (status IN ('upcoming', 'open', 'closed'));

CREATE INDEX IF NOT EXISTS matches_kickoff_idx ON matches(kickoff);
