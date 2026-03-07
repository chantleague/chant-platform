-- Link chants to matches via match_id and backfill from legacy battle_id.
ALTER TABLE chants
ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES matches(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chants'
      AND column_name = 'battle_id'
  ) THEN
    UPDATE chants
    SET match_id = battle_id
    WHERE match_id IS NULL
      AND battle_id IS NOT NULL;

    -- battle_id is legacy; keep it nullable for backward compatibility.
    ALTER TABLE chants ALTER COLUMN battle_id DROP NOT NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS chants_match_id_idx ON chants(match_id);

-- Keep the DB submission cap aligned to match_id-based linking.
CREATE OR REPLACE FUNCTION enforce_chant_submission_limit()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO existing_count
  FROM chants
  WHERE match_id = NEW.match_id
    AND submitted_by = NEW.submitted_by;

  IF existing_count >= 2 THEN
    RAISE EXCEPTION 'submission_limit_reached';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
