-- Add optional audio URL for generated chant audio tracks.
ALTER TABLE chants
ADD COLUMN IF NOT EXISTS audio_url TEXT;

CREATE INDEX IF NOT EXISTS chants_audio_url_idx ON chants(audio_url);
