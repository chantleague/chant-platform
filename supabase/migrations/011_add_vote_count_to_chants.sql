-- Add tracked vote_count for fan chants used by some clients.
ALTER TABLE chants
ADD COLUMN IF NOT EXISTS vote_count INTEGER NOT NULL DEFAULT 0;

-- Backfill any null values in case the column existed without a default.
UPDATE chants
SET vote_count = 0
WHERE vote_count IS NULL;
