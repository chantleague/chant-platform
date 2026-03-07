import { supabase } from "@/app/lib/supabase";
import type { FanChant } from "@/app/lib/types";
import VoteButton from "@/app/components/VoteButton";
import { getChantsForBattleSlug } from "@/app/lib/apiLayer";

interface FanSubmittedChantsProps {
  battleSlug?: string;
}

interface FanChantWithVotes extends FanChant {
  voteCount: number;
}

function toTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function maskSubmitter(submitter: string) {
  if (submitter.length <= 14) {
    return submitter;
  }

  return `${submitter.slice(0, 10)}...`;
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

async function resolveMatchId(
  battleSlug?: string,
): Promise<string> {
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
}: FanSubmittedChantsProps) {
  const resolvedMatchId = await resolveMatchId(battleSlug);

  if (!resolvedMatchId) {
    return renderEmptySections("No chants available yet.", "No chants available yet.");
  }

  let chants: FanChant[] = [];
  let fatalErrorMessage: string | null = null;
  const precomputedVoteCountByPackId: Record<string, number> = {};

  const byMatchId = await supabase
    .from("chants")
    .select("id, match_id, chant_pack_id, club_id, title, chant_text, lyrics, audio_url, submitted_by, created_at, vote_count")
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

          return normalizeChant({
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
          // Legacy fallback: only require chant_pack_id + lyrics and fill missing UI fields.
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

                return normalizeChant({
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
        chants = ((legacyByBattleId.data as FanChant[] | null) || []).map((chant) =>
          normalizeChant(chant),
        );
      }
    }
  } else if (byMatchId.error) {
    fatalErrorMessage = byMatchId.error.message || "Unknown fan chant query error";
  } else {
    chants = ((byMatchId.data as FanChant[] | null) || []).map((chant) =>
      normalizeChant(chant),
    );
  }

  if (fatalErrorMessage) {
    console.error("Error fetching fan chants directly; trying API fallback", {
      match_id: resolvedMatchId,
      error: fatalErrorMessage,
    });

    try {
      const apiFallback = await getChantsForBattleSlug(battleSlug || undefined);

      chants = (apiFallback.chants || []).map((chant, index) => {
        const chantPackId = String(chant.chant_id || "").trim();
        const chantText = String(chant.chant_text || "").trim();

        precomputedVoteCountByPackId[chantPackId] = Number(chant.votes || 0);

        return normalizeChant({
          id: `${chantPackId || "chant"}-${index}`,
          match_id: resolvedMatchId,
          battle_id: resolvedMatchId,
          chant_pack_id: chantPackId,
          club_id: null,
          title: "Fan Chant",
          chant_text: chantText,
          lyrics: chantText,
          audio_url: chant.audio_url || null,
          submitted_by: "fan",
          created_at: chant.created_at || "",
        } as FanChant);
      });

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

  if (chants.length === 0) {
    return renderEmptySections(
      "No fan chants submitted yet. Be the first to drop one.",
      "New fan chants will appear here.",
    );
  }

  const chantPackIds = chants
    .map((chant) => String(chant.chant_pack_id || ""))
    .filter((chantPackId) => Boolean(chantPackId));
  const voteCountByPackId: Record<string, number> = {
    ...precomputedVoteCountByPackId,
  };

  const needsVoteQuery = chantPackIds.some(
    (chantPackId) => typeof voteCountByPackId[chantPackId] !== "number",
  );

  if (chantPackIds.length > 0 && needsVoteQuery) {
    const { data: voteRows, error: voteError } = await supabase
      .from("chant_votes")
      .select("chant_pack_id")
      .in("chant_pack_id", chantPackIds);

    if (voteError) {
      console.error("Error fetching chant vote counts", voteError);
    } else {
      ((voteRows as Array<{ chant_pack_id: string }> | null) || []).forEach((vote) => {
        const chantPackId = String(vote.chant_pack_id || "");
        if (!chantPackId) {
          return;
        }

        voteCountByPackId[chantPackId] = (voteCountByPackId[chantPackId] || 0) + 1;
      });
    }
  }

  const chantsWithVotes: FanChantWithVotes[] = chants.map((chant) => {
    const chantPackId = String(chant.chant_pack_id || "").trim();
    const storedVoteCount =
      typeof chant.vote_count === "number" ? chant.vote_count : Number(chant.vote_count || 0);

    const voteCount = chantPackId
      ? (voteCountByPackId[chantPackId] ?? storedVoteCount)
      : storedVoteCount;

    return {
      ...chant,
      voteCount,
    };
  });

  const topChants = [...chantsWithVotes]
    .sort((a, b) => {
      if (b.voteCount !== a.voteCount) {
        return b.voteCount - a.voteCount;
      }

      return toTimestamp(b.created_at) - toTimestamp(a.created_at);
    })
    .slice(0, 5);

  const newestChants = [...chantsWithVotes].sort(
    (a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at),
  );

  function renderChantCard(chant: FanChantWithVotes) {
    const chantText = (chant.chant_text || chant.lyrics || "").trim();
    const chantPackId = String(chant.chant_pack_id || "").trim();

    return (
      <article
        key={chant.id}
        className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-50">{chant.title}</h3>
            <p className="text-sm whitespace-pre-wrap text-zinc-300">{chantText}</p>
            {chant.audio_url && (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Fan Recording
                </p>
                <audio controls preload="metadata" className="w-full max-w-md" src={chant.audio_url}>
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
            <p className="text-xs text-zinc-500">
              Submitted by {maskSubmitter(String(chant.submitted_by || "anonymous"))}
            </p>
          </div>

          <div className="flex shrink-0 items-center">
            {chantPackId ? (
              <VoteButton chantPackId={chantPackId} voteCount={chant.voteCount} />
            ) : (
              <div className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
                {chant.voteCount} votes
              </div>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-zinc-50">Top Chants</h3>
        {topChants.map((chant) => renderChantCard(chant))}
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-zinc-50">New Chants</h3>
        {newestChants.map((chant) => renderChantCard(chant))}
      </section>
    </div>
  );
}
