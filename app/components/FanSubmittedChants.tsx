import { supabase } from "@/app/lib/supabase";
import type { FanChant } from "@/app/lib/types";
import { getChantsForBattleSlug } from "@/app/lib/apiLayer";
import { toRenderableChantText } from "@/app/lib/chantContent";
import FanSubmittedChantsClient from "@/app/components/FanSubmittedChantsClient";

interface FanSubmittedChantsProps {
  battleSlug?: string;
  votingClosed?: boolean;
}

interface FanChantWithVotes extends FanChant {
  voteCount: number;
}

function isMissingColumnError(errorMessage: string, columnName: string) {
  if (!errorMessage) {
    return false;
  }

  const escapedColumn = columnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(column .*${escapedColumn}.* does not exist|Could not find the '${escapedColumn}' column)`,
    "i",
  ).test(errorMessage);
}

function normalizeChant(chant: FanChant): FanChant {
  return {
    ...chant,
    match_id: chant.match_id || chant.battle_id || "",
    battle_id: chant.battle_id ?? chant.match_id,
    club_id: chant.club_id ?? null,
    chant_text: chant.chant_text ?? chant.lyrics,
    audio_url: chant.audio_url ?? null,
  };
}

function normalizeAndFilterChant(chant: FanChant): FanChant | null {
  const normalized = normalizeChant(chant);
  const chantText = toRenderableChantText(
    normalized.chant_text,
    normalized.lyrics,
    normalized.title,
  );

  if (!chantText) {
    return null;
  }

  return {
    ...normalized,
    title: normalized.title || "Fan Chant",
    chant_text: chantText,
    lyrics: chantText,
  };
}

function renderEmptySections(topText: string, newText: string) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-zinc-50">Top Chants</h3>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
          {topText}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-zinc-50">New Chants</h3>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
          {newText}
        </div>
      </section>
    </div>
  );
}

async function resolveMatchId(battleSlug?: string): Promise<string> {
  const normalizedBattleSlug = (battleSlug || "").trim().toLowerCase();
  if (!normalizedBattleSlug) {
    return "";
  }

  try {
    const { data, error } = await supabase
      .from("matches")
      .select("id")
      .eq("slug", normalizedBattleSlug)
      .maybeSingle();

    if (error) {
      console.error("fan chants: failed to resolve battle slug", error);
      return "";
    }

    return data?.id ? String(data.id) : "";
  } catch (error) {
    console.error("fan chants: unexpected error resolving battle slug", error);
    return "";
  }
}

export default async function FanSubmittedChants({
  battleSlug,
  votingClosed = false,
}: FanSubmittedChantsProps) {
  const resolvedMatchId = await resolveMatchId(battleSlug);

  if (!resolvedMatchId) {
    return renderEmptySections("No chants available yet.", "No chants available yet.");
  }

  let chants: FanChant[] = [];
  let fatalErrorMessage: string | null = null;
  const precomputedVoteCountByPackId: Record<string, number> = {};
  const precomputedVoteCountByChantId: Record<string, number> = {};

  const mapApiFallbackChants = (
    apiChants: Array<{
      chant_id: string;
      chant_row_id?: string | null;
      match_id?: string | null;
      chant_text: string;
      votes: number;
      audio_url: string | null;
      created_at: string | null;
    }>,
  ): FanChant[] => {
    return apiChants
      .map((chant, index) => {
        const chantPackId = String(chant.chant_id || "").trim();
        const chantRowId = String(chant.chant_row_id || "").trim();
        const chantText = String(chant.chant_text || "").trim();
        const matchId = String(chant.match_id || resolvedMatchId).trim() || resolvedMatchId;

        if (chantPackId) {
          precomputedVoteCountByPackId[chantPackId] = Number(chant.votes || 0);
        }

        if (chantRowId) {
          precomputedVoteCountByChantId[chantRowId] = Number(chant.votes || 0);
        }

        return normalizeAndFilterChant({
          id: chantRowId || `${chantPackId || "chant"}-${index}`,
          match_id: matchId,
          battle_id: matchId,
          chant_pack_id: chantPackId || null,
          club_id: null,
          title: "Fan Chant",
          chant_text: chantText,
          lyrics: chantText,
          audio_url: chant.audio_url || null,
          submitted_by: "fan",
          created_at: chant.created_at || "",
        } as FanChant);
      })
      .filter((chant): chant is FanChant => Boolean(chant));
  };

  const byMatchId = await supabase
    .from("chants")
    .select(
      "id, match_id, chant_pack_id, club_id, title, chant_text, lyrics, audio_url, submitted_by, created_at, vote_count",
    )
    .eq("match_id", resolvedMatchId)
    .order("created_at", { ascending: false });

  const withAudioErrorMessage = byMatchId.error?.message || "";
  const hasSchemaDriftError =
    Boolean(byMatchId.error) &&
    /(column .* does not exist|audio_url|chant_text|club_id|title|submitted_by|created_at|match_id|vote_count)/i.test(
      withAudioErrorMessage,
    );

  if (hasSchemaDriftError) {
    const minimalByMatchId = await supabase
      .from("chants")
      .select("id, match_id, chant_text, vote_count, submitted_by, created_at")
      .eq("match_id", resolvedMatchId)
      .order("created_at", { ascending: false });

    if (!minimalByMatchId.error) {
      chants = (((minimalByMatchId.data as Array<Record<string, unknown>> | null) || [])
        .map((row) => {
          const id = String(row.id || "").trim();
          if (!id) {
            return null;
          }

          const chantText = String(row.chant_text || "").trim();

          return normalizeAndFilterChant({
            id,
            match_id: String(row.match_id || resolvedMatchId),
            chant_pack_id: null,
            club_id: null,
            title: "Fan Chant",
            chant_text: chantText,
            lyrics: chantText,
            audio_url: null,
            vote_count: typeof row.vote_count === "number" ? row.vote_count : 0,
            submitted_by: String(row.submitted_by || "fan"),
            created_at: row.created_at ? String(row.created_at) : "",
          } as FanChant);
        })
        .filter((chant): chant is FanChant => Boolean(chant)));
    } else {
      const legacyByBattleId = await supabase
        .from("chants")
        .select("id, battle_id, chant_pack_id, title, chant_text, lyrics, submitted_by, created_at")
        .eq("battle_id", resolvedMatchId)
        .order("created_at", { ascending: false });

      if (legacyByBattleId.error) {
        const fallbackErrorMessage = legacyByBattleId.error.message || "";
        const needsMinimalLegacyFallback =
          /(column .* does not exist|title|submitted_by|created_at|id)/i.test(fallbackErrorMessage);

        if (needsMinimalLegacyFallback) {
          const minimalLegacy = await supabase
            .from("chants")
            .select("chant_pack_id, lyrics")
            .eq("battle_id", resolvedMatchId);

          if (minimalLegacy.error) {
            fatalErrorMessage = minimalLegacy.error.message || "Unknown fan chant query error";
          } else {
            chants = (((minimalLegacy.data as Array<{ chant_pack_id?: string; lyrics?: string }> | null) || [])
              .map((row, index) => {
                const chantPackId = String(row.chant_pack_id || "").trim();
                if (!chantPackId) {
                  return null;
                }

                const lyrics = String(row.lyrics || "").trim();

                return normalizeAndFilterChant({
                  id: `${chantPackId}-${index}`,
                  match_id: resolvedMatchId,
                  battle_id: resolvedMatchId,
                  chant_pack_id: chantPackId,
                  club_id: null,
                  title: "Fan Chant",
                  chant_text: lyrics,
                  lyrics,
                  audio_url: null,
                  submitted_by: "fan",
                  created_at: "",
                } as FanChant);
              })
              .filter((chant): chant is FanChant => Boolean(chant)));
          }
        } else {
          fatalErrorMessage = legacyByBattleId.error.message || "Unknown fan chant query error";
        }
      } else {
        chants = ((legacyByBattleId.data as FanChant[] | null) || [])
          .map((chant) => normalizeAndFilterChant(chant))
          .filter((chant): chant is FanChant => Boolean(chant));
      }
    }
  } else if (byMatchId.error) {
    fatalErrorMessage = byMatchId.error.message || "Unknown fan chant query error";
  } else {
    chants = ((byMatchId.data as FanChant[] | null) || [])
      .map((chant) => normalizeAndFilterChant(chant))
      .filter((chant): chant is FanChant => Boolean(chant));
  }

  if (fatalErrorMessage) {
    console.error("Error fetching fan chants directly; trying API fallback", {
      match_id: resolvedMatchId,
      error: fatalErrorMessage,
    });

    try {
      const apiFallback = await getChantsForBattleSlug(battleSlug || undefined);
      chants = mapApiFallbackChants(apiFallback.chants || []);
      fatalErrorMessage = null;
    } catch (apiFallbackError) {
      console.error("Error fetching fan chants from API fallback", apiFallbackError);
    }
  }

  if (fatalErrorMessage) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">
          Could not load fan chants right now.
        </div>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-zinc-50">Top Chants</h3>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
            Top chants will appear here once data is available.
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-zinc-50">New Chants</h3>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
            New chants will appear here once data is available.
          </div>
        </section>
      </div>
    );
  }

  if (!fatalErrorMessage && battleSlug) {
    try {
      const apiFallback = await getChantsForBattleSlug(battleSlug || undefined);

      const apiChants = mapApiFallbackChants(apiFallback.chants || []);
      const existingByPackId = new Set(
        chants
          .map((chant) => String(chant.chant_pack_id || "").trim())
          .filter((chantPackId) => Boolean(chantPackId)),
      );
      const existingByText = new Set(
        chants
          .map((chant) => String(chant.chant_text || chant.lyrics || "").trim().toLowerCase())
          .filter((chantText) => Boolean(chantText)),
      );

      apiChants.forEach((chant) => {
        const chantPackId = String(chant.chant_pack_id || "").trim();
        if (chantPackId) {
          if (existingByPackId.has(chantPackId)) {
            return;
          }

          existingByPackId.add(chantPackId);
          chants.push(chant);
          return;
        }

        const chantTextKey = String(chant.chant_text || chant.lyrics || "").trim().toLowerCase();
        if (chantTextKey && existingByText.has(chantTextKey)) {
          return;
        }

        if (chantTextKey) {
          existingByText.add(chantTextKey);
        }

        chants.push(chant);
      });
    } catch (apiFallbackError) {
      console.error("Error merging fan chants from API fallback", apiFallbackError);
    }
  }

  if (chants.length === 0) {
    return (
      <FanSubmittedChantsClient
        initialChants={[]}
        battleSlug={battleSlug}
        matchId={resolvedMatchId}
        votingClosed={votingClosed}
      />
    );
  }

  const chantIds = chants
    .map((chant) => String(chant.id || "").trim())
    .filter((chantId) => Boolean(chantId));
  const chantPackIds = chants
    .map((chant) => String(chant.chant_pack_id || "").trim())
    .filter((chantPackId) => Boolean(chantPackId));

  const voteCountByPackId: Record<string, number> = {
    ...precomputedVoteCountByPackId,
  };
  const voteCountByChantId: Record<string, number> = {
    ...precomputedVoteCountByChantId,
  };

  const unresolvedChantIds = chantIds.filter(
    (chantId) => typeof voteCountByChantId[chantId] !== "number",
  );

  if (unresolvedChantIds.length > 0) {
    const byChantIdResult = await supabase
      .from("chant_votes")
      .select("chant_id")
      .in("chant_id", unresolvedChantIds);

    if (byChantIdResult.error) {
      if (!isMissingColumnError(byChantIdResult.error.message || "", "chant_id")) {
        console.error("Error fetching chant vote counts by chant_id", byChantIdResult.error);
      }
    } else {
      ((byChantIdResult.data as Array<{ chant_id: string }> | null) || []).forEach((vote) => {
        const chantId = String(vote.chant_id || "").trim();
        if (!chantId) {
          return;
        }

        voteCountByChantId[chantId] = (voteCountByChantId[chantId] || 0) + 1;
      });
    }
  }

  const unresolvedPackIds = chantPackIds.filter(
    (chantPackId) => typeof voteCountByPackId[chantPackId] !== "number",
  );

  if (unresolvedPackIds.length > 0) {
    const byPackIdResult = await supabase
      .from("chant_votes")
      .select("chant_pack_id")
      .in("chant_pack_id", unresolvedPackIds);

    if (byPackIdResult.error) {
      if (!isMissingColumnError(byPackIdResult.error.message || "", "chant_pack_id")) {
        console.error("Error fetching chant vote counts by chant_pack_id", byPackIdResult.error);
      }
    } else {
      ((byPackIdResult.data as Array<{ chant_pack_id: string }> | null) || []).forEach((vote) => {
        const chantPackId = String(vote.chant_pack_id || "").trim();
        if (!chantPackId) {
          return;
        }

        voteCountByPackId[chantPackId] = (voteCountByPackId[chantPackId] || 0) + 1;
      });
    }
  }

  const chantsWithVotes: FanChantWithVotes[] = chants.map((chant) => {
    const chantId = String(chant.id || "").trim();
    const chantPackId = String(chant.chant_pack_id || "").trim();
    const storedVoteCount =
      typeof chant.vote_count === "number" ? chant.vote_count : Number(chant.vote_count || 0);

    const voteCount =
      (chantId ? voteCountByChantId[chantId] : undefined) ??
      (chantPackId ? voteCountByPackId[chantPackId] : undefined) ??
      storedVoteCount;

    return {
      ...chant,
      voteCount,
    };
  });

  return (
    <FanSubmittedChantsClient
      initialChants={chantsWithVotes}
      battleSlug={battleSlug}
      matchId={resolvedMatchId}
      votingClosed={votingClosed}
    />
  );
}
