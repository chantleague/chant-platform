-- Add moderation status for fan chant submissions.
ALTER TABLE chants
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Preserve visibility of existing historical chants created before moderation.
UPDATE chants
SET status = 'approved'
WHERE status = 'pending';

ALTER TABLE chants
ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE chants
ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chants_status_check'
  ) THEN
    ALTER TABLE chants
    ADD CONSTRAINT chants_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS chants_status_idx ON chants(status);
