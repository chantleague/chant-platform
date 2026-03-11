-- Add fixture_id for provider-level dedupe and club activity tracking for league sync.
ALTER TABLE fixtures
  ADD COLUMN IF NOT EXISTS fixture_id TEXT;

UPDATE fixtures
SET fixture_id = COALESCE(NULLIF(fixture_id, ''), fixture_api_id)
WHERE fixture_id IS NULL OR fixture_id = '';

CREATE UNIQUE INDEX IF NOT EXISTS fixtures_fixture_id_idx ON fixtures(fixture_id);

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

UPDATE clubs
SET is_active = TRUE
WHERE is_active IS NULL;

ALTER TABLE clubs
  ALTER COLUMN is_active SET DEFAULT TRUE;

ALTER TABLE clubs
  ALTER COLUMN is_active SET NOT NULL;

CREATE INDEX IF NOT EXISTS clubs_is_active_idx ON clubs(is_active);
