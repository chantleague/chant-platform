-- Create chant_packs table
CREATE TABLE IF NOT EXISTS chant_packs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  audio_url TEXT,
  official BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS chant_packs_match_id_idx ON chant_packs(match_id);
CREATE INDEX IF NOT EXISTS chant_packs_official_idx ON chant_packs(official);
