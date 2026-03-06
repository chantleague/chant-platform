-- Seed Premier League clubs (20 teams) into clubs table.
INSERT INTO clubs (slug, name, description, fans)
VALUES
  ('arsenal', 'Arsenal FC', 'North London club with a strong tradition and global fanbase.', 9887123),
  ('aston-villa', 'Aston Villa', 'Birmingham club with deep English football history.', 2145321),
  ('bournemouth', 'AFC Bournemouth', 'South coast club known for energetic matchday support.', 845210),
  ('brentford', 'Brentford FC', 'West London club with a modern, data-driven football model.', 932440),
  ('brighton', 'Brighton & Hove Albion', 'Seagulls supporters bring strong home atmosphere.', 1267890),
  ('burnley', 'Burnley FC', 'Lancashire club with a loyal and historic supporter base.', 1032201),
  ('chelsea', 'Chelsea FC', 'West London powerhouse with worldwide supporters.', 7865432),
  ('crystal-palace', 'Crystal Palace', 'South London side famed for vocal home support.', 1874321),
  ('everton', 'Everton FC', 'Merseyside club with one of the oldest top-flight legacies.', 2431100),
  ('fulham', 'Fulham FC', 'Historic London club based at Craven Cottage.', 1112765),
  ('leeds', 'Leeds United', 'Yorkshire club with passionate nationwide support.', 3321987),
  ('liverpool', 'Liverpool FC', 'Merseyside giants known for "You''ll Never Walk Alone".', 12034567),
  ('man-city', 'Manchester City', 'Premier League champions with a growing global fanbase.', 10234567),
  ('man-utd', 'Manchester United', 'One of the most followed football clubs worldwide.', 13458902),
  ('newcastle', 'Newcastle United', 'St James'' Park atmosphere and devoted fan culture.', 3567812),
  ('nottm-forest', 'Nottingham Forest', 'Historic European champions with loyal support.', 1423900),
  ('southampton', 'Southampton FC', 'South coast academy-led club with strong local support.', 1324500),
  ('spurs', 'Tottenham Hotspur', 'North London side with a major domestic and global following.', 6523891),
  ('west-ham', 'West Ham United', 'East London club with a proud working-class fan tradition.', 2784510),
  ('wolves', 'Wolverhampton Wanderers', 'Midlands club with a growing international audience.', 1653200)
ON CONFLICT (slug)
DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  fans = GREATEST(clubs.fans, EXCLUDED.fans);
