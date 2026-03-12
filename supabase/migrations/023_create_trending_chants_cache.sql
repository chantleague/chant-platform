-- Trending chant cache for precomputed viral ranking.

CREATE TABLE IF NOT EXISTS trending_chants_cache (
  chant_id UUID PRIMARY KEY REFERENCES chants(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL CHECK (score >= 0),
  rank INTEGER NOT NULL CHECK (rank > 0),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trending_chants_cache_rank_idx
  ON trending_chants_cache(rank ASC);
CREATE INDEX IF NOT EXISTS trending_chants_cache_score_idx
  ON trending_chants_cache(score DESC);
CREATE INDEX IF NOT EXISTS trending_chants_cache_updated_at_idx
  ON trending_chants_cache(updated_at DESC);
