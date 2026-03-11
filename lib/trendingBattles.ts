import "server-only";

import { deriveBattleRouteSlug } from "@/app/lib/battleRoutes";
import { mockBattles } from "@/app/lib/mockBattles";
import { supabaseServer } from "@/app/lib/supabaseServer";
import {
  getBattleLifecycleFromRow,
  getBattleStatus,
  type BattlePhaseStatus,
} from "@/lib/battleLifecycle";

type RawRow = Record<string, unknown>;

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

type LegacyStatus = "open" | "upcoming" | "closed";

const PHASE_WEIGHT: Record<BattlePhaseStatus, number> = {
  upcoming: 1,
  discussion: 1.1,
  submission_open: 1.2,
  voting_open: 1.5,
  final_scoring: 1.8,
  voting_closed: 0.9,
  winner_reveal: 0.8,
  live: 1.2,
  closed: 0.6,
};

export interface TrendingBattle {
  id: string;
  slug: string;
  homeName: string;
  awayName: string;
  votes: number;
  recentSubmissions: number;
  recentVotes: number;
  status: LegacyStatus;
  phase: BattlePhaseStatus;
  kickoffAt: string | null;
  votingClosesAt: string | null;
  phaseBadge: "FINAL PUSH" | "WINNER SOON" | null;
  score: number;
}

function isMissingColumnError(errorMessage: string, columnName: string) {
  if (!errorMessage) {
    return false;
  }

  const escapedColumn = columnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(column .*${escapedColumn}.* does not exist|Could not find the '${escapedColumn}' column)`, "i").test(
    errorMessage,
  );
}

function toDisplayName(value?: unknown): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return normalized
    .replace(/_/g, "-")
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function parseTeamsFromTitle(title: string): { homeName: string; awayName: string } | null {
  const match = title.match(/(.+?)\s+vs\s+(.+)/i);
  if (!match) {
    return null;
  }

  const cleanName = (value: string) => value.replace(/\s+chant\s+battle$/i, "").trim();

  return {
    homeName: cleanName(match[1]),
    awayName: cleanName(match[2]),
  };
}

function toVotes(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toLegacyStatus(phase: BattlePhaseStatus): LegacyStatus {
  if (phase === "upcoming") {
    return "upcoming";
  }

  if (
    phase === "discussion" ||
    phase === "submission_open" ||
    phase === "voting_open" ||
    phase === "final_scoring"
  ) {
    return "open";
  }

  return "closed";
}

function toPhaseBadge(phase: BattlePhaseStatus): "FINAL PUSH" | "WINNER SOON" | null {
  if (phase === "winner_reveal") {
    return "WINNER SOON";
  }

  if (phase === "final_scoring") {
    return "FINAL PUSH";
  }

  return null;
}

function buildFallbackTrendingBattles(): TrendingBattle[] {
  return mockBattles.slice(0, 10).map((battle, index) => {
    const teams = parseTeamsFromTitle(battle.title);
    const votes = battle.stats.voters;
    const recentSubmissions = Math.max(1, Math.round(battle.stats.chants / 100));
    const recentVotes = Math.max(1, Math.round(votes / 200));
    const phase: BattlePhaseStatus = index % 3 === 0 ? "voting_open" : "upcoming";
    const status = toLegacyStatus(phase);
    const baseScore = votes * 3 + recentSubmissions * 5 + recentVotes * 2;

    return {
      id: battle.slug,
      slug: battle.slug,
      homeName: teams?.homeName || "Home Club",
      awayName: teams?.awayName || "Away Club",
      votes,
      recentSubmissions,
      recentVotes,
      phase,
      status,
      kickoffAt: null,
      votingClosesAt: null,
      phaseBadge: toPhaseBadge(phase),
      score: Number((baseScore * PHASE_WEIGHT[phase]).toFixed(2)),
    };
  });
}

async function getRecentSubmissionCounts(cutoffIso: string) {
  const initialQuery = await supabaseServer
    .from("chants")
    .select("match_id, battle_id, created_at")
    .gte("created_at", cutoffIso);

  let queryData = (initialQuery.data as RawRow[] | null) || [];
  let queryError = initialQuery.error;

  if (queryError && isMissingColumnError(queryError.message || "", "match_id")) {
    const fallbackQuery = await supabaseServer
      .from("chants")
      .select("battle_id, created_at")
      .gte("created_at", cutoffIso);

    queryData = (fallbackQuery.data as RawRow[] | null) || [];
    queryError = fallbackQuery.error;
  }

  if (queryError) {
    console.error("trending-battles: failed to fetch recent submissions", queryError);
    return new Map<string, number>();
  }

  const counts = new Map<string, number>();
  queryData.forEach((row) => {
    const battleId = String(row.match_id || row.battle_id || "").trim();
    if (!battleId) {
      return;
    }

    counts.set(battleId, (counts.get(battleId) || 0) + 1);
  });

  return counts;
}

async function getRecentVoteCounts(cutoffIso: string) {
  const recentVotesQuery = await supabaseServer
    .from("votes")
    .select("battle_id, created_at")
    .gte("created_at", cutoffIso);

  if (recentVotesQuery.error) {
    console.error("trending-battles: failed to fetch recent votes", recentVotesQuery.error);
    return new Map<string, number>();
  }

  const counts = new Map<string, number>();
  (((recentVotesQuery.data as RawRow[] | null) || [])).forEach((row) => {
    const battleId = String(row.battle_id || "").trim();
    if (!battleId) {
      return;
    }

    counts.set(battleId, (counts.get(battleId) || 0) + 1);
  });

  return counts;
}

async function getAllVoteCounts() {
  const voteCountsQuery = await supabaseServer.from("votes").select("battle_id");

  if (voteCountsQuery.error) {
    console.error("trending-battles: failed to fetch vote counts", voteCountsQuery.error);
    return new Map<string, number>();
  }

  const counts = new Map<string, number>();
  (((voteCountsQuery.data as RawRow[] | null) || [])).forEach((row) => {
    const battleId = String(row.battle_id || "").trim();
    if (!battleId) {
      return;
    }

    counts.set(battleId, (counts.get(battleId) || 0) + 1);
  });

  return counts;
}

export async function getTrendingBattles(): Promise<TrendingBattle[]> {
  const fallback = buildFallbackTrendingBattles();

  try {
    const { data: battlesData, error: battlesError } = await supabaseServer
      .from("matches")
      .select("*")
      .limit(250);

    if (battlesError) {
      console.error("trending-battles: failed to fetch battles", battlesError);
      return fallback;
    }

    const battles = ((battlesData as RawRow[] | null) || []).filter((row) => String(row.id || "").trim());
    if (battles.length === 0) {
      return fallback;
    }

    const cutoffIso = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();

    const [recentSubmissionCounts, recentVoteCounts, allVoteCounts] = await Promise.all([
      getRecentSubmissionCounts(cutoffIso),
      getRecentVoteCounts(cutoffIso),
      getAllVoteCounts(),
    ]);

    const ranked = battles
      .map((row) => {
        const id = String(row.id || "").trim();
        const slug = deriveBattleRouteSlug({
          slug: row.slug,
          homeTeam: row.home_team,
          awayTeam: row.away_team,
        });

        if (!id || !slug) {
          return null;
        }

        const title = String(row.title || "").trim();
        const titleTeams = parseTeamsFromTitle(title);

        const homeName = toDisplayName(row.home_team) || titleTeams?.homeName || "Home Club";
        const awayName = toDisplayName(row.away_team) || titleTeams?.awayName || "Away Club";

        const votes = Math.max(toVotes(row.vote_count), allVoteCounts.get(id) || 0);
        const recentSubmissions = recentSubmissionCounts.get(id) || 0;
        const recentVotes = recentVoteCounts.get(id) || 0;
        const lifecycle = getBattleLifecycleFromRow(row);
        const phase = getBattleStatus(Date.now(), lifecycle);
        const status = toLegacyStatus(phase);

        const baseScore = votes * 3 + recentSubmissions * 5 + recentVotes * 2;
        const score = Number((baseScore * PHASE_WEIGHT[phase]).toFixed(2));

        return {
          id,
          slug,
          homeName,
          awayName,
          votes,
          recentSubmissions,
          recentVotes,
          phase,
          status,
          kickoffAt: lifecycle.kickoff_at,
          votingClosesAt: lifecycle.voting_closes_at,
          phaseBadge: toPhaseBadge(phase),
          score,
        } satisfies TrendingBattle;
      })
      .filter((battle): battle is TrendingBattle => Boolean(battle))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (right.votes !== left.votes) {
          return right.votes - left.votes;
        }

        return left.slug.localeCompare(right.slug);
      });

    return ranked.slice(0, 10);
  } catch (error) {
    console.error("trending-battles: unexpected ranking error", error);
    return fallback;
  }
}
