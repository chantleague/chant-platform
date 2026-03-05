-- Add voter_hash column for MVP voting throttling
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS voter_hash TEXT;

CREATE INDEX IF NOT EXISTS votes_voter_hash_idx ON votes(voter_hash);
