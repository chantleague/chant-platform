-- Create clubs table
CREATE TABLE IF NOT EXISTS clubs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  fans INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clubs_slug_idx ON clubs(slug);

-- Create votes table for fan voting between clubs
CREATE TABLE IF NOT EXISTS votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  club_slug TEXT NOT NULL REFERENCES clubs(slug) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS votes_battle_id_idx ON votes(battle_id);
CREATE INDEX IF NOT EXISTS votes_club_slug_idx ON votes(club_slug);
CREATE INDEX IF NOT EXISTS votes_user_id_idx ON votes(user_id);

-- unique constraint to prevent duplicate vote per user per club per battle
CREATE UNIQUE INDEX IF NOT EXISTS votes_unique_idx ON votes(battle_id, club_slug, user_id);
