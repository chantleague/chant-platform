-- Create fan-submitted chants table linked to battles and chant packs
CREATE TABLE IF NOT EXISTS chants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  chant_pack_id UUID NOT NULL UNIQUE REFERENCES chant_packs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  lyrics TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chants_battle_id_idx ON chants(battle_id);
CREATE INDEX IF NOT EXISTS chants_submitted_by_idx ON chants(submitted_by);
CREATE INDEX IF NOT EXISTS chants_created_at_idx ON chants(created_at);

-- Enforce max two chant submissions per user for each battle.
CREATE OR REPLACE FUNCTION enforce_chant_submission_limit()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO existing_count
  FROM chants
  WHERE battle_id = NEW.battle_id
    AND submitted_by = NEW.submitted_by;

  IF existing_count >= 2 THEN
    RAISE EXCEPTION 'submission_limit_reached';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chants_submission_limit_trigger ON chants;
CREATE TRIGGER chants_submission_limit_trigger
BEFORE INSERT ON chants
FOR EACH ROW
EXECUTE FUNCTION enforce_chant_submission_limit();
