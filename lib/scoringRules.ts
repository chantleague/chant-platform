export const SCORING_RULES = {
  vote: 1,
  upload: 10,
  share: 5,
  comment: 2,
  like: 1,
  remix: 15,
  invite: 12,
  download: 8,
  spotify_stream: 6,
  youtube_play: 6,
  community_join: 5,
  boost: 20,
} as const;

export type ScoreEventType = keyof typeof SCORING_RULES;

export const SCORE_EVENT_TYPES = Object.keys(SCORING_RULES) as ScoreEventType[];

export function isScoreEventType(value: string): value is ScoreEventType {
  return SCORE_EVENT_TYPES.includes(value as ScoreEventType);
}
