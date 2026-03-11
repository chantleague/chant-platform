-- Expand fixtures schema for automated external fixture sync.
ALTER TABLE fixtures
  ADD COLUMN IF NOT EXISTS home_team TEXT,
  ADD COLUMN IF NOT EXISTS away_team TEXT,
  ADD COLUMN IF NOT EXISTS competition TEXT,
  ADD COLUMN IF NOT EXISTS kickoff TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS season TEXT,
  ADD COLUMN IF NOT EXISTS fixture_api_id TEXT;

-- Keep legacy and new ingestion paths compatible.
ALTER TABLE fixtures ALTER COLUMN home_club_id DROP NOT NULL;
ALTER TABLE fixtures ALTER COLUMN away_club_id DROP NOT NULL;
ALTER TABLE fixtures ALTER COLUMN match_date DROP NOT NULL;
ALTER TABLE fixtures ALTER COLUMN league DROP NOT NULL;

-- Backfill new columns from legacy data where possible.
UPDATE fixtures AS f
SET home_team = c.slug
FROM clubs AS c
WHERE f.home_club_id = c.id
  AND (f.home_team IS NULL OR f.home_team = '');

UPDATE fixtures AS f
SET away_team = c.slug
FROM clubs AS c
WHERE f.away_club_id = c.id
  AND (f.away_team IS NULL OR f.away_team = '');

UPDATE fixtures
SET competition = COALESCE(NULLIF(competition, ''), league)
WHERE competition IS NULL OR competition = '';

UPDATE fixtures
SET kickoff = COALESCE(kickoff, match_date)
WHERE kickoff IS NULL;

UPDATE fixtures
SET season = COALESCE(NULLIF(season, ''), TO_CHAR(COALESCE(kickoff, match_date, NOW()), 'YYYY'))
WHERE season IS NULL OR season = '';

CREATE UNIQUE INDEX IF NOT EXISTS fixtures_fixture_api_id_idx ON fixtures(fixture_api_id);
CREATE INDEX IF NOT EXISTS fixtures_kickoff_idx ON fixtures(kickoff);
CREATE INDEX IF NOT EXISTS fixtures_competition_idx ON fixtures(competition);
CREATE INDEX IF NOT EXISTS fixtures_season_idx ON fixtures(season);
