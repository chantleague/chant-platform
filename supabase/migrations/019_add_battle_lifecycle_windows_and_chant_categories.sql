-- Add kickoff-driven lifecycle windows and chant categories.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS kickoff_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS battle_opens_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS submission_opens_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS voting_opens_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS submission_closes_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS voting_closes_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS winner_reveal_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'matches'
      AND column_name = 'kickoff_time'
  ) THEN
    EXECUTE '
      UPDATE matches
      SET kickoff_at = COALESCE(kickoff_at, kickoff, kickoff_time, starts_at)
      WHERE kickoff_at IS NULL
    ';
  ELSE
    UPDATE matches
    SET kickoff_at = COALESCE(kickoff_at, kickoff, starts_at)
    WHERE kickoff_at IS NULL;
  END IF;
END;
$$;

UPDATE matches
SET
  battle_opens_at = kickoff_at - INTERVAL '10 days',
  submission_opens_at = kickoff_at - INTERVAL '7 days',
  voting_opens_at = kickoff_at - INTERVAL '5 days',
  submission_closes_at = kickoff_at - INTERVAL '3 days',
  voting_closes_at = kickoff_at - INTERVAL '24 hours',
  winner_reveal_at = kickoff_at - INTERVAL '12 hours'
WHERE kickoff_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS matches_kickoff_at_idx ON matches(kickoff_at);
CREATE INDEX IF NOT EXISTS matches_battle_opens_at_idx ON matches(battle_opens_at);
CREATE INDEX IF NOT EXISTS matches_submission_opens_at_idx ON matches(submission_opens_at);
CREATE INDEX IF NOT EXISTS matches_voting_opens_at_idx ON matches(voting_opens_at);
CREATE INDEX IF NOT EXISTS matches_submission_closes_at_idx ON matches(submission_closes_at);
CREATE INDEX IF NOT EXISTS matches_voting_closes_at_idx ON matches(voting_closes_at);
CREATE INDEX IF NOT EXISTS matches_winner_reveal_at_idx ON matches(winner_reveal_at);

ALTER TABLE chants
  ADD COLUMN IF NOT EXISTS category TEXT;

UPDATE chants
SET category = 'praise'
WHERE category IS NULL OR btrim(category) = '';

ALTER TABLE chants
  ALTER COLUMN category SET DEFAULT 'praise';

ALTER TABLE chants
  ALTER COLUMN category SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chants_category_check'
  ) THEN
    ALTER TABLE chants
      ADD CONSTRAINT chants_category_check
      CHECK (category IN ('praise', 'roast', 'meme', 'player'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS chants_category_idx ON chants(category);

ALTER TABLE chant_packs
  ADD COLUMN IF NOT EXISTS category TEXT;

UPDATE chant_packs
SET category = 'praise'
WHERE category IS NULL OR btrim(category) = '';

ALTER TABLE chant_packs
  ALTER COLUMN category SET DEFAULT 'praise';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chant_packs_category_check'
  ) THEN
    ALTER TABLE chant_packs
      ADD CONSTRAINT chant_packs_category_check
      CHECK (category IN ('praise', 'roast', 'meme', 'player'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS chant_packs_category_idx ON chant_packs(category);
