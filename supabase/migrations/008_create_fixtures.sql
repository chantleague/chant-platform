-- Create fixtures table for upcoming league matches.
CREATE TABLE IF NOT EXISTS fixtures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  home_club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  away_club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  match_date TIMESTAMP WITH TIME ZONE NOT NULL,
  league TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fixtures_different_clubs CHECK (home_club_id <> away_club_id)
);

CREATE INDEX IF NOT EXISTS fixtures_home_club_id_idx ON fixtures(home_club_id);
CREATE INDEX IF NOT EXISTS fixtures_away_club_id_idx ON fixtures(away_club_id);
CREATE INDEX IF NOT EXISTS fixtures_match_date_idx ON fixtures(match_date);
CREATE INDEX IF NOT EXISTS fixtures_league_idx ON fixtures(league);

CREATE UNIQUE INDEX IF NOT EXISTS fixtures_unique_idx
ON fixtures(home_club_id, away_club_id, match_date, league);
