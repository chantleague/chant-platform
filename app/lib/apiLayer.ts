import { CANONICAL_CLUB_REGISTRY, League } from "@/app/lib/canonicalClubRegistry";
import { mockBattles } from "@/app/lib/mockBattles";
import { supabase } from "@/app/lib/supabase";
import { supabaseServer } from "@/app/lib/supabaseServer";

type RawRow = Record<string, unknown>;

type ApiClub = {
  id: string;
  name: string;
  slug: string;
  short_name: string;
  league: string;
  crest_url: string | null;
};

type GroupedClubs = Record<string, ApiClub[]>;

type ApiBattle = {
  id: string;
  slug: string;
  home_club: string;
  away_club: string;
  match_date: string | null;
  state: string;
};

type ApiChant = {
  chant_id: string;
  chant_row_id: string | null;
  match_id: string | null;
  chant_text: string;
  votes: number;
  audio_url: string | null;
  created_at: string | null;
};

type ApiWeeklyOrAllTimeRow = {
  chant_id: string;
  chant_text: string;
  votes: number;
};

type ApiClubLeaderboardRow = {
  club_slug: string;
  club_name: string;
  votes: number;
};

interface SubmitVoteResult {
  success: boolean;
  status: number;
  message: string;
  voteCount?: number;
}

interface SubmitChantVoteInput {
  chantRowId?: string;
  chantPackId?: string;
  matchId?: string;
  battleSlug?: string;
  userIdentifier: string;
}

interface VoteTarget {
  column: "chant_id" | "chant_pack_id";
  value: string;
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

function isDuplicateKeyError(errorCode?: string, errorMessage?: string) {
  if (errorCode === "23505") {
    return true;
  }

  return /duplicate|unique/i.test(errorMessage || "");
}

function toSafeErrorLog(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error || "unknown") };
  }

  const maybeError = error as { message?: string; code?: string; details?: string; hint?: string };
  return {
    message: maybeError.message || "unknown",
    code: maybeError.code,
    details: maybeError.details,
    hint: maybeError.hint,
  };
}

function deriveShortName(name: string) {
  return name
    .replace(/\b(FC|CF|AFC|SC)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mapLeagueLabel(leagueValue?: string) {
  const normalized = (leagueValue || "").toUpperCase();
  if (normalized === League.PREMIER_LEAGUE) {
    return "Premier League";
  }
  if (normalized === League.CHAMPIONSHIP) {
    return "Championship";
  }
  if (normalized === League.INTERNATIONAL) {
    return "International";
  }
  if (normalized === League.EUROPEAN) {
    return "European";
  }
  if (normalized) {
    return leagueValue as string;
  }
  return "Unknown";
}

function splitBattleSlug(slug: string) {
  const [homePart, awayAndDate] = slug.split("-vs-");
  if (!awayAndDate) {
    return {
      home: homePart.replace(/-/g, " "),
      away: "Unknown",
    };
  }

  const awayPart = awayAndDate.split(/-\d{4}-\d{2}-\d{2}$/)[0];

  return {
    home: homePart.replace(/-/g, " "),
    away: awayPart.replace(/-/g, " "),
  };
}

function tallyByKey(rows: Array<{ key: string }>) {
  const map: Record<string, number> = {};
  rows.forEach((row) => {
    map[row.key] = (map[row.key] || 0) + 1;
  });

  return map;
}

export async function getClubsGroupedByLeague(): Promise<GroupedClubs> {
  const fallbackGrouped: GroupedClubs = {};

  CANONICAL_CLUB_REGISTRY.forEach((club) => {
    const leagueLabel = mapLeagueLabel(club.league);
    if (!fallbackGrouped[leagueLabel]) {
      fallbackGrouped[leagueLabel] = [];
    }

    fallbackGrouped[leagueLabel].push({
      id: club.slug,
      name: club.displayName,
      slug: club.slug,
      short_name: deriveShortName(club.displayName),
      league: leagueLabel,
      crest_url: null,
    });
  });

  try {
    const { data, error } = await supabase.from("clubs").select("*");
    if (error || !data) {
      if (error) {
        console.error("api/clubs: failed to fetch clubs", error);
      }
      return fallbackGrouped;
    }

    const canonicalBySlug = new Map(CANONICAL_CLUB_REGISTRY.map((club) => [club.slug, club]));
    const grouped: GroupedClubs = {};

    (data as RawRow[]).forEach((row) => {
      const slug = String(row.slug || "").trim();
      if (!slug) {
        return;
      }

      const canonical = canonicalBySlug.get(slug);
      const name = String(row.name || canonical?.displayName || slug);
      const leagueLabel = mapLeagueLabel(
        (row.league as string | undefined) || canonical?.league,
      );

      if (!grouped[leagueLabel]) {
        grouped[leagueLabel] = [];
      }

      grouped[leagueLabel].push({
        id: String(row.id || slug),
        name,
        slug,
        short_name: String(row.short_name || deriveShortName(name)),
        league: leagueLabel,
        crest_url: row.crest_url ? String(row.crest_url) : null,
      });
    });

    return Object.keys(grouped).length > 0 ? grouped : fallbackGrouped;
  } catch (error) {
    console.error("api/clubs: unexpected error", error);
    return fallbackGrouped;
  }
}

export async function getActiveBattles(): Promise<ApiBattle[]> {
  const fallback: ApiBattle[] = mockBattles.map((battle) => {
    const split = splitBattleSlug(battle.slug);
    return {
      id: battle.slug,
      slug: battle.slug,
      home_club: split.home,
      away_club: split.away,
      match_date: null,
      state: "upcoming",
    };
  });

  try {
    const [{ data: battlesData, error: battlesError }, { data: clubsData, error: clubsError }] =
      await Promise.all([
        supabase
          .from("matches")
          .select("id, slug, home_team, away_team, starts_at, status")
          .not("status", "in", "(completed,finished)"),
        supabase.from("clubs").select("slug, name"),
      ]);

    if (battlesError || !battlesData) {
      if (battlesError) {
        console.error("api/battles: failed to fetch matches", battlesError);
      }
      return fallback;
    }

    if (clubsError) {
      console.error("api/battles: failed to fetch clubs", clubsError);
    }

    const clubMap: Record<string, string> = {};
    (((clubsData as RawRow[] | null) || [])).forEach((club) => {
      const clubSlug = String(club.slug || "");
      if (clubSlug) {
        clubMap[clubSlug] = String(club.name || clubSlug);
      }
    });

    return (battlesData as RawRow[]).map((battle) => {
      const battleSlug = String(battle.slug || "");
      const split = splitBattleSlug(battleSlug);
      const homeSlug = String(battle.home_team || "");
      const awaySlug = String(battle.away_team || "");

      return {
        id: String(battle.id || battleSlug),
        slug: battleSlug,
        home_club: clubMap[homeSlug] || homeSlug || split.home,
        away_club: clubMap[awaySlug] || awaySlug || split.away,
        match_date: battle.starts_at ? String(battle.starts_at) : null,
        state: String(battle.status || "upcoming"),
      };
    });
  } catch (error) {
    console.error("api/battles: unexpected error", error);
    return fallback;
  }
}

export async function getChantsForBattleSlug(
  battleSlug?: string,
): Promise<{ battle_slug: string | null; chants: ApiChant[] }> {
  if (!battleSlug) {
    return { battle_slug: null, chants: [] };
  }

  try {
    const { data: battleData, error: battleError } = await supabase
      .from("matches")
      .select("id")
      .eq("slug", battleSlug)
      .single();

    if (battleError || !battleData?.id) {
      return { battle_slug: battleSlug, chants: [] };
    }

    const battleId = String(battleData.id);

    const fanChantsByMatch = await supabase
      .from("chants")
      .select("id, match_id, chant_pack_id, lyrics")
      .eq("match_id", battleId);

    let fanChantsData = fanChantsByMatch.data as RawRow[] | null;
    let fanChantsError = fanChantsByMatch.error;

    if (fanChantsError && /column .*match_id.* does not exist/i.test(fanChantsError.message || "")) {
      const legacyByBattleId = await supabase
        .from("chants")
        .select("id, battle_id, chant_pack_id, lyrics")
        .eq("battle_id", battleId);

      fanChantsData = legacyByBattleId.data as RawRow[] | null;
      fanChantsError = legacyByBattleId.error;
    }

    const packsByMatch = await supabase
      .from("chant_packs")
      .select("id, title, description, audio_url, created_at")
      .eq("match_id", battleId)
      .eq("official", false)
      .order("created_at", { ascending: false });

    let packsData = packsByMatch.data;
    let packsError = packsByMatch.error;

    if (packsError && /column .*official.* does not exist/i.test(packsError.message || "")) {
      const legacyPacksByMatch = await supabase
        .from("chant_packs")
        .select("id, title, description, audio_url, created_at")
        .eq("match_id", battleId)
        .order("created_at", { ascending: false });

      packsData = legacyPacksByMatch.data;
      packsError = legacyPacksByMatch.error;
    }

    if (packsError || !packsData) {
      if (packsError) {
        console.error("api/chants: failed to fetch chant packs", packsError);
      }
      return { battle_slug: battleSlug, chants: [] };
    }

    if (fanChantsError) {
      console.error("api/chants: failed to fetch fan chants", fanChantsError);
    }

    const lyricsByPackId: Record<string, string> = {};
    const chantMetaByPackId: Record<
      string,
      {
        chantRowId: string | null;
        matchId: string | null;
      }
    > = {};

    (((fanChantsData as RawRow[] | null) || [])).forEach((chant) => {
      const chantPackId = String(chant.chant_pack_id || "");
      if (chantPackId) {
        lyricsByPackId[chantPackId] = String(chant.lyrics || "").trim();
        chantMetaByPackId[chantPackId] = {
          chantRowId: chant.id ? String(chant.id) : null,
          matchId: chant.match_id
            ? String(chant.match_id)
            : chant.battle_id
              ? String(chant.battle_id)
              : battleId,
        };
      }
    });

    const chantPackIds = (packsData as RawRow[])
      .map((pack) => String(pack.id || ""))
      .filter((id) => Boolean(id));

    const voteCountByPackId: Record<string, number> = {};
    const voteCountByChantId: Record<string, number> = {};

    if (chantPackIds.length > 0) {
      const chantIds = Object.values(chantMetaByPackId)
        .map((meta) => String(meta.chantRowId || ""))
        .filter((id) => Boolean(id));

      let fetchedByChantId = false;

      if (chantIds.length > 0) {
        const byChantIdResult = await supabase
          .from("chant_votes")
          .select("chant_id")
          .in("chant_id", chantIds);

        if (byChantIdResult.error) {
          if (!isMissingColumnError(byChantIdResult.error.message || "", "chant_id")) {
            console.error("api/chants: failed to fetch chant votes by chant_id", byChantIdResult.error);
          }
        } else {
          fetchedByChantId = true;
          ((byChantIdResult.data as RawRow[] | null) || []).forEach((voteRow) => {
            const chantId = String(voteRow.chant_id || "");
            if (chantId) {
              voteCountByChantId[chantId] = (voteCountByChantId[chantId] || 0) + 1;
            }
          });
        }
      }

      if (!fetchedByChantId) {
        const byPackIdResult = await supabase
          .from("chant_votes")
          .select("chant_pack_id")
          .in("chant_pack_id", chantPackIds);

        if (byPackIdResult.error) {
          console.error("api/chants: failed to fetch chant votes by chant_pack_id", byPackIdResult.error);
        } else {
          ((byPackIdResult.data as RawRow[] | null) || []).forEach((voteRow) => {
            const packId = String(voteRow.chant_pack_id || "");
            if (packId) {
              voteCountByPackId[packId] = (voteCountByPackId[packId] || 0) + 1;
            }
          });
        }
      }
    }

    const chants: ApiChant[] = (packsData as RawRow[]).map((pack) => {
      const packId = String(pack.id || "");
      const chantMeta = chantMetaByPackId[packId];
      const chantRowId = chantMeta?.chantRowId || null;
      const chantText =
        lyricsByPackId[packId] ||
        String(pack.description || pack.title || "").trim();

      return {
        chant_id: packId,
        chant_row_id: chantRowId,
        match_id: chantMeta?.matchId || battleId,
        chant_text: chantText,
        votes:
          (chantRowId && typeof voteCountByChantId[chantRowId] === "number"
            ? voteCountByChantId[chantRowId]
            : voteCountByPackId[packId]) || 0,
        audio_url: pack.audio_url ? String(pack.audio_url) : null,
        created_at: pack.created_at ? String(pack.created_at) : null,
      };
    });

    return { battle_slug: battleSlug, chants };
  } catch (error) {
    console.error("api/chants: unexpected error", error);
    return { battle_slug: battleSlug, chants: [] };
  }
}

export async function submitChantVote(input: SubmitChantVoteInput): Promise<SubmitVoteResult> {
  const normalizedUser = String(input.userIdentifier || "").trim();
  const normalizedChantRowId = String(input.chantRowId || "").trim();
  const normalizedChantPackId = String(input.chantPackId || "").trim();
  const normalizedBattleSlug = String(input.battleSlug || "").trim().toLowerCase();
  const normalizedMatchId = String(input.matchId || "").trim();

  if (!normalizedUser || (!normalizedChantRowId && !normalizedChantPackId)) {
    return {
      success: false,
      status: 400,
      message: "user_identifier and chant identifier are required.",
    };
  }

  let resolvedChantRowId = normalizedChantRowId || null;
  let resolvedChantPackId = normalizedChantPackId || null;
  let resolvedMatchId = normalizedMatchId || null;

  try {
    if (resolvedChantRowId) {
      const chantRowResult = await supabaseServer
        .from("chants")
        .select("id, match_id, battle_id, chant_pack_id, submitted_by")
        .eq("id", resolvedChantRowId)
        .maybeSingle();

      if (chantRowResult.error) {
        console.error("api/votes: chant row lookup failed", {
          chantRowId: resolvedChantRowId,
          error: toSafeErrorLog(chantRowResult.error),
        });

        return {
          success: false,
          status: 500,
          message: "Could not validate chant.",
        };
      }

      if (!chantRowResult.data?.id) {
        return {
          success: false,
          status: 404,
          message: "Chant not found.",
        };
      }

      const ownerId = chantRowResult.data.submitted_by
        ? String(chantRowResult.data.submitted_by)
        : null;
      if (ownerId && ownerId === normalizedUser) {
        return {
          success: false,
          status: 403,
          message: "Users cannot vote on their own chants.",
        };
      }

      resolvedChantPackId = chantRowResult.data.chant_pack_id
        ? String(chantRowResult.data.chant_pack_id)
        : resolvedChantPackId;

      resolvedMatchId = chantRowResult.data.match_id
        ? String(chantRowResult.data.match_id)
        : chantRowResult.data.battle_id
          ? String(chantRowResult.data.battle_id)
          : resolvedMatchId;
    }

    if (!resolvedChantRowId && resolvedChantPackId) {
      const chantByPackResult = await supabaseServer
        .from("chants")
        .select("id, match_id, battle_id, submitted_by")
        .eq("chant_pack_id", resolvedChantPackId)
        .maybeSingle();

      if (chantByPackResult.error) {
        console.error("api/votes: chant pack lookup failed", {
          chantPackId: resolvedChantPackId,
          error: toSafeErrorLog(chantByPackResult.error),
        });
      } else if (chantByPackResult.data?.id) {
        resolvedChantRowId = String(chantByPackResult.data.id);

        const ownerId = chantByPackResult.data.submitted_by
          ? String(chantByPackResult.data.submitted_by)
          : null;
        if (ownerId && ownerId === normalizedUser) {
          return {
            success: false,
            status: 403,
            message: "Users cannot vote on their own chants.",
          };
        }

        if (!resolvedMatchId) {
          resolvedMatchId = chantByPackResult.data.match_id
            ? String(chantByPackResult.data.match_id)
            : chantByPackResult.data.battle_id
              ? String(chantByPackResult.data.battle_id)
              : null;
        }
      }
    }

    if (normalizedBattleSlug) {
      const matchBySlugResult = await supabaseServer
        .from("matches")
        .select("id")
        .eq("slug", normalizedBattleSlug)
        .maybeSingle();

      if (matchBySlugResult.error) {
        console.error("api/votes: battle slug lookup failed", {
          battleSlug: normalizedBattleSlug,
          error: toSafeErrorLog(matchBySlugResult.error),
        });

        return {
          success: false,
          status: 500,
          message: "Could not validate battle.",
        };
      }

      if (!matchBySlugResult.data?.id) {
        return {
          success: false,
          status: 404,
          message: "Battle not found.",
        };
      }

      const slugMatchId = String(matchBySlugResult.data.id);
      if (resolvedMatchId && resolvedMatchId !== slugMatchId) {
        console.error("api/votes: chant vote blocked due to match mismatch", {
          battleSlug: normalizedBattleSlug,
          expectedMatchId: slugMatchId,
          receivedMatchId: resolvedMatchId,
          chantRowId: resolvedChantRowId,
          chantPackId: resolvedChantPackId,
        });

        return {
          success: false,
          status: 409,
          message: "Chant does not belong to this battle.",
        };
      }

      resolvedMatchId = slugMatchId;
    }

    if (normalizedMatchId && resolvedMatchId && normalizedMatchId !== resolvedMatchId) {
      console.error("api/votes: chant vote blocked due to provided match mismatch", {
        providedMatchId: normalizedMatchId,
        resolvedMatchId,
        chantRowId: resolvedChantRowId,
        chantPackId: resolvedChantPackId,
      });

      return {
        success: false,
        status: 409,
        message: "Chant does not belong to this match.",
      };
    }

    const voteTargets: VoteTarget[] = [];
    if (resolvedChantRowId) {
      voteTargets.push({
        column: "chant_id",
        value: resolvedChantRowId,
      });
    }

    if (resolvedChantPackId) {
      voteTargets.push({
        column: "chant_pack_id",
        value: resolvedChantPackId,
      });
    }

    if (voteTargets.length === 0) {
      return {
        success: false,
        status: 400,
        message: "Could not determine chant vote target.",
      };
    }

    const skippedColumns: string[] = [];
    let lastSchemaError: string | null = null;

    for (const target of voteTargets) {
      const duplicateCheck = await supabaseServer
        .from("chant_votes")
        .select("id")
        .eq(target.column, target.value)
        .eq("user_id", normalizedUser)
        .limit(1);

      if (duplicateCheck.error) {
        const duplicateCheckMessage = duplicateCheck.error.message || "";
        if (isMissingColumnError(duplicateCheckMessage, target.column)) {
          skippedColumns.push(`duplicate-check:${target.column}`);
          lastSchemaError = duplicateCheckMessage;
          continue;
        }

        console.error("api/votes: duplicate check failed", {
          target,
          userIdentifier: normalizedUser,
          error: toSafeErrorLog(duplicateCheck.error),
        });

        return {
          success: false,
          status: 500,
          message: "Could not validate vote.",
        };
      }

      if ((duplicateCheck.data || []).length > 0) {
        return {
          success: false,
          status: 409,
          message: "User has already voted for this chant.",
        };
      }

      const votePayload: Record<string, string> = {
        user_id: normalizedUser,
        [target.column]: target.value,
      };

      const insertResult = await supabaseServer.from("chant_votes").insert([votePayload]);
      if (insertResult.error) {
        const insertMessage = insertResult.error.message || "";
        if (isMissingColumnError(insertMessage, target.column)) {
          skippedColumns.push(`insert:${target.column}`);
          lastSchemaError = insertMessage;
          continue;
        }

        if (isDuplicateKeyError(insertResult.error.code, insertMessage)) {
          return {
            success: false,
            status: 409,
            message: "User has already voted for this chant.",
          };
        }

        console.error("api/votes: insert failed", {
          target,
          userIdentifier: normalizedUser,
          battleSlug: normalizedBattleSlug || null,
          matchId: resolvedMatchId,
          error: toSafeErrorLog(insertResult.error),
        });

        return {
          success: false,
          status: 500,
          message: "Could not record vote.",
        };
      }

      const countResult = await supabaseServer
        .from("chant_votes")
        .select("id", { count: "exact", head: true })
        .eq(target.column, target.value);

      let voteCount: number | undefined;
      if (countResult.error) {
        console.error("api/votes: vote count query failed", {
          target,
          error: toSafeErrorLog(countResult.error),
        });
      } else if (typeof countResult.count === "number") {
        voteCount = countResult.count;
      }

      if (resolvedChantRowId && typeof voteCount === "number") {
        const syncVoteCountResult = await supabaseServer
          .from("chants")
          .update({ vote_count: voteCount })
          .eq("id", resolvedChantRowId);

        if (syncVoteCountResult.error) {
          const syncErrorMessage = syncVoteCountResult.error.message || "";
          if (!isMissingColumnError(syncErrorMessage, "vote_count")) {
            console.error("api/votes: chants.vote_count sync failed", {
              chantRowId: resolvedChantRowId,
              voteCount,
              error: toSafeErrorLog(syncVoteCountResult.error),
            });
          }
        }
      }

      return {
        success: true,
        status: 200,
        message: "Vote recorded.",
        voteCount,
      };
    }

    console.error("api/votes: no compatible vote target columns detected", {
      chantRowId: resolvedChantRowId,
      chantPackId: resolvedChantPackId,
      skippedColumns,
      lastSchemaError,
    });

    return {
      success: false,
      status: 500,
      message: "Could not record vote due to vote schema mismatch.",
    };
  } catch (error) {
    console.error("api/votes: unexpected error", {
      input: {
        chantRowId: resolvedChantRowId,
        chantPackId: resolvedChantPackId,
        matchId: resolvedMatchId,
        battleSlug: normalizedBattleSlug || null,
      },
      error: toSafeErrorLog(error),
    });

    return {
      success: false,
      status: 500,
      message: "Could not record vote.",
    };
  }
}

export async function getLeaderboardsPayload(): Promise<{
  weekly: ApiWeeklyOrAllTimeRow[];
  all_time: ApiWeeklyOrAllTimeRow[];
  club: ApiClubLeaderboardRow[];
}> {
  try {
    const [packsResult, weeklyVotesResult, allVotesResult, clubVotesResult, clubsResult] =
      await Promise.all([
        supabase.from("chant_packs").select("id, title"),
        supabase
          .from("chant_votes")
          .select("chant_pack_id")
          .gte(
            "created_at",
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          ),
        supabase.from("chant_votes").select("chant_pack_id"),
        supabase.from("votes").select("club_slug"),
        supabase.from("clubs").select("slug, name"),
      ]);

    const packById: Record<string, string> = {};
    if (packsResult.error) {
      console.error("api/leaderboards: packs fetch error", packsResult.error);
    }
    (((packsResult.data as RawRow[] | null) || [])).forEach((pack) => {
      const packId = String(pack.id || "");
      if (packId) {
        packById[packId] = String(pack.title || packId);
      }
    });

    if (weeklyVotesResult.error) {
      console.error("api/leaderboards: weekly votes fetch error", weeklyVotesResult.error);
    }
    if (allVotesResult.error) {
      console.error("api/leaderboards: all votes fetch error", allVotesResult.error);
    }
    if (clubVotesResult.error) {
      console.error("api/leaderboards: club votes fetch error", clubVotesResult.error);
    }
    if (clubsResult.error) {
      console.error("api/leaderboards: clubs fetch error", clubsResult.error);
    }

    const weeklyMap = tallyByKey(
      (((weeklyVotesResult.data as RawRow[] | null) || []).map((vote) => ({
        key: String(vote.chant_pack_id || ""),
      }))).filter((row) => Boolean(row.key)),
    );

    const allTimeMap = tallyByKey(
      (((allVotesResult.data as RawRow[] | null) || []).map((vote) => ({
        key: String(vote.chant_pack_id || ""),
      }))).filter((row) => Boolean(row.key)),
    );

    const clubMap = tallyByKey(
      (((clubVotesResult.data as RawRow[] | null) || []).map((vote) => ({
        key: String(vote.club_slug || ""),
      }))).filter((row) => Boolean(row.key)),
    );

    const weekly = Object.entries(weeklyMap)
      .map(([chantId, votes]) => ({
        chant_id: chantId,
        chant_text: packById[chantId] || chantId,
        votes,
      }))
      .sort((a, b) => b.votes - a.votes);

    const all_time = Object.entries(allTimeMap)
      .map(([chantId, votes]) => ({
        chant_id: chantId,
        chant_text: packById[chantId] || chantId,
        votes,
      }))
      .sort((a, b) => b.votes - a.votes);

    const clubNameBySlug: Record<string, string> = {};
    (((clubsResult.data as RawRow[] | null) || [])).forEach((club) => {
      const slug = String(club.slug || "");
      if (slug) {
        clubNameBySlug[slug] = String(club.name || slug);
      }
    });

    const club = Object.entries(clubMap)
      .map(([clubSlug, votes]) => ({
        club_slug: clubSlug,
        club_name: clubNameBySlug[clubSlug] || clubSlug,
        votes,
      }))
      .sort((a, b) => b.votes - a.votes);

    return { weekly, all_time, club };
  } catch (error) {
    console.error("api/leaderboards: unexpected error", error);
    return {
      weekly: [],
      all_time: [],
      club: [],
    };
  }
}
