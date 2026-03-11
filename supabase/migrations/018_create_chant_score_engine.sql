-- Universal chant engagement score engine.
CREATE TABLE IF NOT EXISTS chant_score_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chant_id UUID NOT NULL REFERENCES chants(id) ON DELETE CASCADE,
  battle_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (
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
      'boost'
    )
  ),
  points INTEGER NOT NULL CHECK (points >= 0),
  source TEXT NOT NULL DEFAULT 'web',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chant_scores (
  chant_id UUID PRIMARY KEY REFERENCES chants(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  vote_points INTEGER NOT NULL DEFAULT 0,
  share_points INTEGER NOT NULL DEFAULT 0,
  comment_points INTEGER NOT NULL DEFAULT 0,
  remix_points INTEGER NOT NULL DEFAULT 0,
  invite_points INTEGER NOT NULL DEFAULT 0,
  stream_points INTEGER NOT NULL DEFAULT 0,
  download_points INTEGER NOT NULL DEFAULT 0,
  boost_points INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE matches
ADD COLUMN IF NOT EXISTS engagement_score INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS chant_score_events_battle_id_chant_id_event_type_idx
  ON chant_score_events(battle_id, chant_id, event_type);
CREATE INDEX IF NOT EXISTS chant_score_events_chant_id_idx ON chant_score_events(chant_id);
CREATE INDEX IF NOT EXISTS chant_score_events_created_at_idx ON chant_score_events(created_at);
CREATE INDEX IF NOT EXISTS chant_scores_total_points_idx ON chant_scores(total_points DESC);
CREATE INDEX IF NOT EXISTS matches_engagement_score_idx ON matches(engagement_score DESC);

CREATE OR REPLACE FUNCTION apply_chant_score_event()
RETURNS TRIGGER AS $$
DECLARE
  vote_delta INTEGER := 0;
  share_delta INTEGER := 0;
  comment_delta INTEGER := 0;
  remix_delta INTEGER := 0;
  invite_delta INTEGER := 0;
  stream_delta INTEGER := 0;
  download_delta INTEGER := 0;
  boost_delta INTEGER := 0;
BEGIN
  CASE NEW.event_type
    WHEN 'vote' THEN
      vote_delta := NEW.points;
    WHEN 'share' THEN
      share_delta := NEW.points;
    WHEN 'comment' THEN
      comment_delta := NEW.points;
    WHEN 'remix' THEN
      remix_delta := NEW.points;
    WHEN 'invite' THEN
      invite_delta := NEW.points;
    WHEN 'spotify_stream' THEN
      stream_delta := NEW.points;
    WHEN 'youtube_play' THEN
      stream_delta := NEW.points;
    WHEN 'download' THEN
      download_delta := NEW.points;
    WHEN 'boost' THEN
      boost_delta := NEW.points;
  END CASE;

  INSERT INTO chant_scores (
    chant_id,
    total_points,
    vote_points,
    share_points,
    comment_points,
    remix_points,
    invite_points,
    stream_points,
    download_points,
    boost_points,
    last_updated
  )
  VALUES (
    NEW.chant_id,
    NEW.points,
    vote_delta,
    share_delta,
    comment_delta,
    remix_delta,
    invite_delta,
    stream_delta,
    download_delta,
    boost_delta,
    NOW()
  )
  ON CONFLICT (chant_id)
  DO UPDATE SET
    total_points = chant_scores.total_points + EXCLUDED.total_points,
    vote_points = chant_scores.vote_points + EXCLUDED.vote_points,
    share_points = chant_scores.share_points + EXCLUDED.share_points,
    comment_points = chant_scores.comment_points + EXCLUDED.comment_points,
    remix_points = chant_scores.remix_points + EXCLUDED.remix_points,
    invite_points = chant_scores.invite_points + EXCLUDED.invite_points,
    stream_points = chant_scores.stream_points + EXCLUDED.stream_points,
    download_points = chant_scores.download_points + EXCLUDED.download_points,
    boost_points = chant_scores.boost_points + EXCLUDED.boost_points,
    last_updated = NOW();

  UPDATE matches
  SET engagement_score = COALESCE(
    (
      SELECT SUM(cs.total_points)::INTEGER
      FROM chant_scores AS cs
      INNER JOIN chants AS c ON c.id = cs.chant_id
      WHERE COALESCE(c.match_id, c.battle_id) = NEW.battle_id
    ),
    0
  )
  WHERE id = NEW.battle_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chant_score_events_apply_trigger ON chant_score_events;
CREATE TRIGGER chant_score_events_apply_trigger
AFTER INSERT ON chant_score_events
FOR EACH ROW
EXECUTE FUNCTION apply_chant_score_event();

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE chant_score_events;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END;
$$;
