// Shared domain types used throughout the Chant Platform

export interface Battle {
  id: string;
  slug: string;
  title: string;
  description?: string;
  // foreign keys to clubs (if schema has been updated)
  home_club_id?: string;
  away_club_id?: string;
  // legacy string slugs for team names
  home_team?: string;
  away_team?: string;
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
  // legacy user_id field (previously used for anon identifier)
  user_id?: string;
  // new hash used to rate‑limit MVP votes
  voter_hash?: string;
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

export interface FanChant {
  id: string;
  battle_id: string;
  chant_pack_id: string;
  club_id?: string | null;
  title: string;
  chant_text?: string | null;
  lyrics: string;
  audio_url?: string | null;
  submitted_by: string;
  created_at: string;
}

export interface Fixture {
  id: string;
  home_club_id: string;
  away_club_id: string;
  match_date: string;
  league: string;
  created_at?: string;
}

// helper for leaderboard rows (not exported widely)
export interface FanRow {
  position: number;
  name: string;
  metric: string;
  value: number;
}
