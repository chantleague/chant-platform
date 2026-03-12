-- Universal Engagement Score Engine.

ALTER TABLE chant_score_events
  ADD COLUMN IF NOT EXISTS value INTEGER;

UPDATE chant_score_events
SET value = points
WHERE value IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chant_score_events_value_non_negative'
  ) THEN
    ALTER TABLE chant_score_events
      ADD CONSTRAINT chant_score_events_value_non_negative
      CHECK (value >= 0);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS score_weights (
  event_type TEXT PRIMARY KEY,
  points INTEGER NOT NULL CHECK (points >= 0)
);

INSERT INTO score_weights (event_type, points)
VALUES
  ('vote', 3),
  ('share', 2),
  ('play', 1),
  ('tiktok_usage', 5),
  ('youtube_play', 4),
  ('spotify_play', 4),
  ('whatsapp_share', 3),
  ('download', 2),
  ('boost_purchase', 10)
ON CONFLICT (event_type)
DO UPDATE SET points = EXCLUDED.points;

ALTER TABLE chants
  ADD COLUMN IF NOT EXISTS total_score INTEGER NOT NULL DEFAULT 0;

UPDATE chants
SET total_score = COALESCE(score_data.total_score, 0)
FROM (
  SELECT
    chant_id,
    SUM(COALESCE(value, points, 0))::INTEGER AS total_score
  FROM chant_score_events
  GROUP BY chant_id
) AS score_data
WHERE chants.id = score_data.chant_id;

UPDATE chants
SET total_score = 0
WHERE total_score IS NULL;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'chant_score_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%event_type%'
  LOOP
    EXECUTE format('ALTER TABLE chant_score_events DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END;
$$;

ALTER TABLE chant_score_events
  ADD CONSTRAINT chant_score_events_event_type_check
  CHECK (
    event_type IN (
      'vote',
      'upload',
      'share',
      'comment',
      'like',
      'remix',
      'invite',
      'download',
      'spotify_stream',
      'youtube_play',
      'community_join',
      'boost',
      'video_play',
      'play',
      'tiktok_usage',
      'spotify_play',
      'whatsapp_share',
      'boost_purchase'
    )
  );

CREATE INDEX IF NOT EXISTS chant_score_events_chant_id_idx
  ON chant_score_events(chant_id);
CREATE INDEX IF NOT EXISTS chant_score_events_battle_id_idx
  ON chant_score_events(battle_id);
CREATE INDEX IF NOT EXISTS chant_score_events_event_type_idx
  ON chant_score_events(event_type);
CREATE INDEX IF NOT EXISTS chant_score_events_created_at_idx
  ON chant_score_events(created_at DESC);
CREATE INDEX IF NOT EXISTS chant_score_events_vote_actor_idx
  ON chant_score_events(chant_id, (COALESCE(user_id::text, metadata->>'fan_id')))
  WHERE event_type = 'vote';

CREATE OR REPLACE FUNCTION sync_chant_score_event_value_points()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.value IS NULL THEN
    NEW.value := COALESCE(NEW.points, 0);
  END IF;

  IF NEW.points IS NULL THEN
    NEW.points := COALESCE(NEW.value, 0);
  END IF;

  IF NEW.value <> NEW.points THEN
    NEW.points := NEW.value;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chant_score_events_sync_value_points_trigger ON chant_score_events;
CREATE TRIGGER chant_score_events_sync_value_points_trigger
BEFORE INSERT OR UPDATE ON chant_score_events
FOR EACH ROW
EXECUTE FUNCTION sync_chant_score_event_value_points();

CREATE OR REPLACE FUNCTION apply_chant_total_score_cache()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chants
  SET total_score = COALESCE(total_score, 0) + COALESCE(NEW.value, NEW.points, 0)
  WHERE id = NEW.chant_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chant_score_events_total_score_cache_trigger ON chant_score_events;
CREATE TRIGGER chant_score_events_total_score_cache_trigger
AFTER INSERT ON chant_score_events
FOR EACH ROW
EXECUTE FUNCTION apply_chant_total_score_cache();
