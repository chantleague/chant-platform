import { supabaseServer } from "../../app/lib/supabaseServer";
import { deriveBattleRouteSlug } from "../../app/lib/battleRoutes";
import { calculateTrendingScore } from "./calculateTrendingScore";
import type { SupabaseClient } from "@supabase/supabase-js";

type RawRow = Record<string, unknown>;

type ScoreEventRow = {
  chant_id?: string;
  event_type?: string;
};

const MAX_TRENDING_AGE_DAYS = 30;
const MIN_TOTAL_SCORE = 10;
const DEFAULT_LIMIT = 20;
const DEFAULT_CACHE_SIZE = 50;

export interface TrendingChant {
  chantId: string;
  chantText: string;
  clubId: string | null;
  clubName: string;
  totalScore: number;
  shares: number;
  videoPlays: number;
  trendingScore: number;
  createdAt: string | null;
  battleId: string | null;
  battleSlug: string;
  battleLabel: string;
  rank: number;
}

export interface GetTrendingChantsOptions {
  limit?: number;
  excludeBattleId?: string;
  excludeClubIds?: string[];
  clubId?: string;
  withinDays?: number;
  useCache?: boolean;
}

export interface UpdateTrendingCacheResult {
  success: boolean;
  updated: number;
  message: string;
}

const SCORE_EVENT_TYPES_FOR_TRENDING = [
  "share",
  "play",
  "video_play",
  "youtube_play",
  "spotify_play",
] as const;

function toInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeId(value: unknown): string {
  return String(value || "").trim();
}

function normalizeMaybeId(value: unknown): string | null {
  const normalized = normalizeId(value);
  return normalized || null;
}

function toTimestamp(value?: string | null): number {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return 0;
  }

  const timestamp = new Date(normalized).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function toDisplayName(value: unknown) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "Unknown Club";
  }

  return normalized
    .replace(/_/g, "-")
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function toChantText(row: RawRow): string {
  const chantText = String(row.chant_text || "").trim();
  if (chantText) {
    return chantText;
  }

  const lyrics = String(row.lyrics || "").trim();
  if (lyrics) {
    return lyrics;
  }

  const title = String(row.title || "").trim();
  if (title) {
    return title;
  }

  return "Fan Chant";
}

function countByEventType(rows: ScoreEventRow[]) {
  const sharesByChant = new Map<string, number>();
  const videoPlaysByChant = new Map<string, number>();

  rows.forEach((row) => {
    const chantId = normalizeId(row.chant_id);
    const eventType = String(row.event_type || "").trim().toLowerCase();

    if (!chantId) {
      return;
    }

    if (eventType === "share") {
      sharesByChant.set(chantId, (sharesByChant.get(chantId) || 0) + 1);
      return;
    }

    if (eventType === "play" || eventType === "video_play" || eventType === "youtube_play") {
      videoPlaysByChant.set(chantId, (videoPlaysByChant.get(chantId) || 0) + 1);
    }
  });

  return {
    sharesByChant,
    videoPlaysByChant,
  };
}

async function fetchChantsForTrending(supabaseClient: SupabaseClient, maxAgeDays: number) {
  const cutoffIso = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();

  const result = await supabaseClient
    .from("chants")
    .select("id, chant_text, lyrics, title, club_id, total_score, created_at, match_id, battle_id")
    .gte("created_at", cutoffIso)
    .gt("total_score", MIN_TOTAL_SCORE)
    .order("total_score", { ascending: false })
    .limit(1500);

  if (result.error) {
    console.error("trending/getTrendingChants: failed to fetch chants", result.error);
    return [] as RawRow[];
  }

  return (result.data as RawRow[] | null) || [];
}

async function buildTrendingFromSource(
  supabaseClient: SupabaseClient,
  options?: { withinDays?: number },
): Promise<TrendingChant[]> {
  const maxAgeDays = Math.max(
    1,
    Math.min(MAX_TRENDING_AGE_DAYS, toInt(options?.withinDays || MAX_TRENDING_AGE_DAYS)),
  );

  const chants = await fetchChantsForTrending(supabaseClient, maxAgeDays);
  if (chants.length === 0) {
    return [];
  }

  const chantIds = chants
    .map((row) => normalizeId(row.id))
    .filter((chantId) => Boolean(chantId));

  const scoreEventsResult = await supabaseClient
    .from("chant_score_events")
    .select("chant_id, event_type")
    .in("chant_id", chantIds)
    .in("event_type", [...SCORE_EVENT_TYPES_FOR_TRENDING]);

  if (scoreEventsResult.error) {
    console.error("trending/getTrendingChants: failed to fetch score events", scoreEventsResult.error);
  }

  const scoreEvents = (scoreEventsResult.data as ScoreEventRow[] | null) || [];
  const { sharesByChant, videoPlaysByChant } = countByEventType(scoreEvents);

  const battleIds = Array.from(
    new Set(
      chants
        .map((chant) => normalizeId(chant.match_id || chant.battle_id))
        .filter((battleId) => Boolean(battleId)),
    ),
  );

  const clubIds = Array.from(
    new Set(
      chants
        .map((chant) => normalizeId(chant.club_id))
        .filter((clubId) => Boolean(clubId)),
    ),
  );

  const [matchesResult, clubsResult] = await Promise.all([
    battleIds.length > 0
      ? supabaseClient
          .from("matches")
          .select("id, slug, home_team, away_team")
          .in("id", battleIds)
      : Promise.resolve({ data: [], error: null }),
    clubIds.length > 0
      ? supabaseClient
          .from("clubs")
          .select("id, name")
          .in("id", clubIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (matchesResult.error) {
    console.error("trending/getTrendingChants: failed to fetch matches", matchesResult.error);
  }

  if (clubsResult.error) {
    console.error("trending/getTrendingChants: failed to fetch clubs", clubsResult.error);
  }

  const matchesById = new Map<string, RawRow>();
  (((matchesResult.data as RawRow[] | null) || [])).forEach((match) => {
    const id = normalizeId(match.id);
    if (id) {
      matchesById.set(id, match);
    }
  });

  const clubsById = new Map<string, RawRow>();
  (((clubsResult.data as RawRow[] | null) || [])).forEach((club) => {
    const id = normalizeId(club.id);
    if (id) {
      clubsById.set(id, club);
    }
  });

  const nowMs = Date.now();

  return chants
    .map((chant) => {
      const chantId = normalizeId(chant.id);
      if (!chantId) {
        return null;
      }

      const totalScore = toInt(chant.total_score);
      if (totalScore <= MIN_TOTAL_SCORE) {
        return null;
      }

      const createdAt = String(chant.created_at || "").trim() || null;
      const maxAgeCutoffMs = nowMs - MAX_TRENDING_AGE_DAYS * 24 * 60 * 60 * 1000;
      if (createdAt && toTimestamp(createdAt) < maxAgeCutoffMs) {
        return null;
      }

      const shares = sharesByChant.get(chantId) || 0;
      const videoPlays = videoPlaysByChant.get(chantId) || 0;
      const battleId = normalizeMaybeId(chant.match_id || chant.battle_id);
      const battle = battleId ? matchesById.get(battleId) : undefined;
      const battleSlug = battle
        ? deriveBattleRouteSlug({
            slug: battle.slug,
            homeTeam: battle.home_team,
            awayTeam: battle.away_team,
          })
        : "";

      const homeName = battle ? toDisplayName(battle.home_team) : "Home Club";
      const awayName = battle ? toDisplayName(battle.away_team) : "Away Club";

      const clubId = normalizeMaybeId(chant.club_id);
      const clubRow = clubId ? clubsById.get(clubId) : undefined;

      const trendingScore = calculateTrendingScore({
        totalScore,
        shares,
        videoPlays,
        createdAt,
      });

      return {
        chantId,
        chantText: toChantText(chant),
        clubId,
        clubName: clubRow ? String(clubRow.name || "Unknown Club") : "Unknown Club",
        totalScore,
        shares,
        videoPlays,
        trendingScore,
        createdAt,
        battleId,
        battleSlug,
        battleLabel: `${homeName} vs ${awayName}`,
        rank: 0,
      } satisfies TrendingChant;
    })
    .filter((chant): chant is TrendingChant => Boolean(chant))
    .sort((left, right) => {
      if (right.trendingScore !== left.trendingScore) {
        return right.trendingScore - left.trendingScore;
      }

      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
      }

      return toTimestamp(right.createdAt) - toTimestamp(left.createdAt);
    })
    .map((chant, index) => ({
      ...chant,
      rank: index + 1,
    }));
}

function applyTrendingFilters(
  chants: TrendingChant[],
  options: GetTrendingChantsOptions,
): TrendingChant[] {
  const excludeBattleId = normalizeId(options.excludeBattleId);
  const excludeClubIds = new Set(
    (options.excludeClubIds || []).map((clubId) => normalizeId(clubId)).filter((clubId) => Boolean(clubId)),
  );
  const onlyClubId = normalizeId(options.clubId);
  const withinDays = Math.max(0, toInt(options.withinDays));
  const withinDaysCutoff =
    withinDays > 0 ? Date.now() - withinDays * 24 * 60 * 60 * 1000 : 0;

  return chants.filter((chant) => {
    if (excludeBattleId && normalizeId(chant.battleId) === excludeBattleId) {
      return false;
    }

    if (chant.clubId && excludeClubIds.has(chant.clubId)) {
      return false;
    }

    if (onlyClubId && chant.clubId !== onlyClubId) {
      return false;
    }

    if (withinDaysCutoff > 0 && toTimestamp(chant.createdAt) < withinDaysCutoff) {
      return false;
    }

    return true;
  });
}

export async function getTrendingChantsFromCache(
  options: GetTrendingChantsOptions = {},
  supabaseClient: SupabaseClient = supabaseServer,
): Promise<TrendingChant[]> {
  try {
    const fetchLimit = Math.max(DEFAULT_LIMIT, toInt(options.limit) || DEFAULT_LIMIT);

    const cacheResult = await supabaseClient
      .from("trending_chants_cache")
      .select("chant_id, score, rank")
      .order("rank", { ascending: true })
      .limit(Math.max(fetchLimit * 3, 60));

    if (cacheResult.error) {
      console.error("trending/getTrendingChants: failed to fetch cache rows", cacheResult.error);
      return [];
    }

    const cacheRows = (((cacheResult.data as RawRow[] | null) || [])).filter((row) => normalizeId(row.chant_id));
    if (cacheRows.length === 0) {
      return [];
    }

    const cacheByChantId = new Map<string, { score: number; rank: number }>();
    const chantIds: string[] = [];

    cacheRows.forEach((row) => {
      const chantId = normalizeId(row.chant_id);
      if (!chantId || cacheByChantId.has(chantId)) {
        return;
      }

      cacheByChantId.set(chantId, {
        score: Number(row.score || 0),
        rank: toInt(row.rank),
      });
      chantIds.push(chantId);
    });

    const maxAgeCutoffIso = new Date(Date.now() - MAX_TRENDING_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const chantsResult = await supabaseClient
      .from("chants")
      .select("id, chant_text, lyrics, title, club_id, total_score, created_at, match_id, battle_id")
      .in("id", chantIds)
      .gte("created_at", maxAgeCutoffIso)
      .gt("total_score", MIN_TOTAL_SCORE);

    if (chantsResult.error) {
      console.error("trending/getTrendingChants: failed to hydrate cached chants", chantsResult.error);
      return [];
    }

    const chants = (chantsResult.data as RawRow[] | null) || [];
    if (chants.length === 0) {
      return [];
    }

    const scoreEventsResult = await supabaseClient
      .from("chant_score_events")
      .select("chant_id, event_type")
      .in("chant_id", chantIds)
      .in("event_type", [...SCORE_EVENT_TYPES_FOR_TRENDING]);

    if (scoreEventsResult.error) {
      console.error("trending/getTrendingChants: failed to hydrate cached event counts", scoreEventsResult.error);
    }

    const { sharesByChant, videoPlaysByChant } = countByEventType(
      (scoreEventsResult.data as ScoreEventRow[] | null) || [],
    );

    const battleIds = Array.from(
      new Set(
        chants
          .map((chant) => normalizeId(chant.match_id || chant.battle_id))
          .filter((battleId) => Boolean(battleId)),
      ),
    );

    const clubIds = Array.from(
      new Set(
        chants
          .map((chant) => normalizeId(chant.club_id))
          .filter((clubId) => Boolean(clubId)),
      ),
    );

    const [matchesResult, clubsResult] = await Promise.all([
      battleIds.length > 0
        ? supabaseClient
            .from("matches")
            .select("id, slug, home_team, away_team")
            .in("id", battleIds)
        : Promise.resolve({ data: [], error: null }),
      clubIds.length > 0
        ? supabaseClient
            .from("clubs")
            .select("id, name")
            .in("id", clubIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const matchesById = new Map<string, RawRow>();
    (((matchesResult.data as RawRow[] | null) || [])).forEach((match) => {
      const id = normalizeId(match.id);
      if (id) {
        matchesById.set(id, match);
      }
    });

    const clubsById = new Map<string, RawRow>();
    (((clubsResult.data as RawRow[] | null) || [])).forEach((club) => {
      const id = normalizeId(club.id);
      if (id) {
        clubsById.set(id, club);
      }
    });

    const ranked = chants
      .map((chant) => {
        const chantId = normalizeId(chant.id);
        if (!chantId) {
          return null;
        }

        const cache = cacheByChantId.get(chantId);
        if (!cache) {
          return null;
        }

        const totalScore = toInt(chant.total_score);
        if (totalScore <= MIN_TOTAL_SCORE) {
          return null;
        }

        const battleId = normalizeMaybeId(chant.match_id || chant.battle_id);
        const battle = battleId ? matchesById.get(battleId) : undefined;
        const battleSlug = battle
          ? deriveBattleRouteSlug({
              slug: battle.slug,
              homeTeam: battle.home_team,
              awayTeam: battle.away_team,
            })
          : "";
        const homeName = battle ? toDisplayName(battle.home_team) : "Home Club";
        const awayName = battle ? toDisplayName(battle.away_team) : "Away Club";

        const clubId = normalizeMaybeId(chant.club_id);
        const club = clubId ? clubsById.get(clubId) : undefined;

        return {
          chantId,
          chantText: toChantText(chant),
          clubId,
          clubName: String(club?.name || "Unknown Club"),
          totalScore,
          shares: sharesByChant.get(chantId) || 0,
          videoPlays: videoPlaysByChant.get(chantId) || 0,
          trendingScore: cache.score,
          createdAt: String(chant.created_at || "").trim() || null,
          battleId,
          battleSlug,
          battleLabel: `${homeName} vs ${awayName}`,
          rank: cache.rank,
        } satisfies TrendingChant;
      })
      .filter((chant): chant is TrendingChant => Boolean(chant))
      .sort((left, right) => {
        if (left.rank !== right.rank) {
          return left.rank - right.rank;
        }

        return right.trendingScore - left.trendingScore;
      });

    const filtered = applyTrendingFilters(ranked, options);
    const limit = Math.max(1, toInt(options.limit) || DEFAULT_LIMIT);

    return filtered.slice(0, limit);
  } catch (error) {
    console.error("trending/getTrendingChants: unexpected cache read error", error);
    return [];
  }
}

export async function getTrendingChants(
  options: GetTrendingChantsOptions = {},
  supabaseClient: SupabaseClient = supabaseServer,
): Promise<TrendingChant[]> {
  const useCache = options.useCache !== false;

  if (useCache) {
    const cached = await getTrendingChantsFromCache(options, supabaseClient);
    if (cached.length > 0) {
      return cached;
    }
  }

  const sourceRows = await buildTrendingFromSource(supabaseClient, {
    withinDays: options.withinDays,
  });
  const filtered = applyTrendingFilters(sourceRows, options);
  const limit = Math.max(1, toInt(options.limit) || DEFAULT_LIMIT);

  return filtered.slice(0, limit);
}

export async function updateTrendingChantsCache(
  options?: {
    cacheSize?: number;
  },
  supabaseClient: SupabaseClient = supabaseServer,
): Promise<UpdateTrendingCacheResult> {
  try {
    const cacheSize = Math.max(1, toInt(options?.cacheSize) || DEFAULT_CACHE_SIZE);
    const ranked = await buildTrendingFromSource(supabaseClient);
    const topRows = ranked.slice(0, cacheSize);

    if (topRows.length === 0) {
      const clearResult = await supabaseClient.from("trending_chants_cache").delete().gt("rank", 0);
      if (clearResult.error) {
        console.error("trending/updateCache: failed to clear stale cache", clearResult.error);
        return {
          success: false,
          updated: 0,
          message: "Could not clear stale trending cache.",
        };
      }

      return {
        success: true,
        updated: 0,
        message: "Trending cache cleared; no eligible chants.",
      };
    }

    const nowIso = new Date().toISOString();
    const payload = topRows.map((row, index) => ({
      chant_id: row.chantId,
      score: row.trendingScore,
      rank: index + 1,
      updated_at: nowIso,
    }));

    const upsertResult = await supabaseClient
      .from("trending_chants_cache")
      .upsert(payload, { onConflict: "chant_id" });

    if (upsertResult.error) {
      console.error("trending/updateCache: failed to upsert cache rows", upsertResult.error);
      return {
        success: false,
        updated: 0,
        message: "Could not update trending cache.",
      };
    }

    const existingRows = await supabaseClient
      .from("trending_chants_cache")
      .select("chant_id");

    if (existingRows.error) {
      console.error("trending/updateCache: failed to read existing cache rows", existingRows.error);
      return {
        success: true,
        updated: payload.length,
        message: "Trending cache updated.",
      };
    }

    const keepIds = new Set(payload.map((row) => String(row.chant_id)));
    const staleIds = (((existingRows.data as RawRow[] | null) || [])
      .map((row) => normalizeId(row.chant_id))
      .filter((chantId) => Boolean(chantId) && !keepIds.has(chantId)));

    if (staleIds.length > 0) {
      const deleteStale = await supabaseClient
        .from("trending_chants_cache")
        .delete()
        .in("chant_id", staleIds);

      if (deleteStale.error) {
        console.error("trending/updateCache: failed to delete stale cache rows", deleteStale.error);
      }
    }

    return {
      success: true,
      updated: payload.length,
      message: "Trending cache updated.",
    };
  } catch (error) {
    console.error("trending/updateCache: unexpected error", error);
    return {
      success: false,
      updated: 0,
      message: "Could not update trending cache.",
    };
  }
}
