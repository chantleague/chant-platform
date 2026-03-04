-- Create chant_votes table for tracking votes on chants
CREATE TABLE IF NOT EXISTS chant_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chant_pack_id UUID NOT NULL REFERENCES chant_packs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS chant_votes_chant_pack_id_idx ON chant_votes(chant_pack_id);
CREATE INDEX IF NOT EXISTS chant_votes_user_id_idx ON chant_votes(user_id);

-- Create unique constraint to prevent duplicate votes from same user
CREATE UNIQUE INDEX IF NOT EXISTS chant_votes_unique_idx ON chant_votes(chant_pack_id, user_id);
