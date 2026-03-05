// Shared domain types used throughout the Chant Platform

export interface Battle {
  id: string;
  slug: string;
  title: string;
  description?: string;
  home_team: string;
  away_team: string;
  matchday?: number | null;
  status?: "upcoming" | "live" | "completed" | "finished";
  starts_at?: string | null;
  stats?: {
    chants?: number;
    voters?: number;
    peakDb?: number;
    fansJoined?: number;
  };
  [key: string]: unknown;
}

export interface Club {
  id: string;
  slug: string;
  name: string;
  description?: string;
  fans?: number;
  [key: string]: unknown;
}

export interface Vote {
  id: string;
  battle_id: string;
  club_slug: string;
  user_id: string;
  created_at?: string;
}

export interface ChantPack {
  id: string;
  match_id: string;
  official: boolean;
  created_at: string;
  title: string;
  description?: string;
  audio_url?: string;
  [key: string]: unknown;
}

export interface ChantWithMatch extends ChantPack {
  voteCount: number;
  match_title?: string;
}

// helper for leaderboard rows (not exported widely)
export interface FanRow {
  position: number;
  name: string;
  metric: string;
  value: number;
}
