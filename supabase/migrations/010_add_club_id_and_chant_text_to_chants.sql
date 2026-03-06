-- Add optional club ownership and explicit chant text fields for fan chants.
ALTER TABLE chants
ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

ALTER TABLE chants
ADD COLUMN IF NOT EXISTS chant_text TEXT;

-- Backfill chant_text for existing rows from legacy lyrics field.
UPDATE chants
SET chant_text = COALESCE(chant_text, lyrics)
WHERE chant_text IS NULL;

CREATE INDEX IF NOT EXISTS chants_club_id_idx ON chants(club_id);
