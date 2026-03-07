import { supabase } from "@/app/lib/supabase";
import type { FanChant } from "@/app/lib/types";
import VoteButton from "@/app/components/VoteButton";

interface FanSubmittedChantsProps {
  battleId?: string;
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

async function resolveBattleId(
  battleId?: string,
  battleSlug?: string,
): Promise<string> {
  const normalizedBattleId = (battleId || "").trim();
  if (normalizedBattleId) {
    return normalizedBattleId;
  }

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
  battleId,
  battleSlug,
}: FanSubmittedChantsProps) {
  const resolvedBattleId = await resolveBattleId(battleId, battleSlug);

  if (!resolvedBattleId) {
    return renderEmptySections("No chants available yet.", "No chants available yet.");
  }

  let chants: FanChant[] = [];
  let fatalErrorMessage: string | null = null;

  const withAudio = await supabase
    .from("chants")
    .select("id, battle_id, chant_pack_id, club_id, title, chant_text, lyrics, audio_url, submitted_by, created_at")
    .eq("battle_id", resolvedBattleId)
    .order("created_at", { ascending: false });

  const withAudioErrorMessage = withAudio.error?.message || "";
  const hasSchemaDriftError =
    Boolean(withAudio.error) &&
    /(column .* does not exist|audio_url|chant_text|club_id|title|submitted_by|created_at)/i.test(
      withAudioErrorMessage,
    );

  if (hasSchemaDriftError) {
    const fallback = await supabase
      .from("chants")
      .select("id, battle_id, chant_pack_id, title, lyrics, submitted_by, created_at")
      .eq("battle_id", resolvedBattleId)
      .order("created_at", { ascending: false });

    if (fallback.error) {
      const fallbackErrorMessage = fallback.error.message || "";
      const needsMinimalLegacyFallback =
        /(column .* does not exist|title|submitted_by|created_at|id)/i.test(fallbackErrorMessage);

      if (needsMinimalLegacyFallback) {
        // Legacy fallback: only require chant_pack_id + lyrics and fill missing UI fields.
        const minimalLegacy = await supabase
          .from("chants")
          .select("chant_pack_id, lyrics")
          .eq("battle_id", resolvedBattleId);

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
                battle_id: resolvedBattleId,
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
        fatalErrorMessage = fallback.error.message || "Unknown fan chant query error";
      }
    } else {
      chants = ((fallback.data as FanChant[] | null) || []).map((chant) =>
        normalizeChant(chant),
      );
    }
  } else if (withAudio.error) {
    fatalErrorMessage = withAudio.error.message || "Unknown fan chant query error";
  } else {
    chants = ((withAudio.data as FanChant[] | null) || []).map((chant) =>
      normalizeChant(chant),
    );
  }

  if (fatalErrorMessage) {
    console.error("Error fetching fan chants", {
      battle_id: resolvedBattleId,
      error: fatalErrorMessage,
    });

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
  const voteCountByPackId: Record<string, number> = {};

  if (chantPackIds.length > 0) {
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

  const chantsWithVotes: FanChantWithVotes[] = chants.map((chant) => ({
    ...chant,
    voteCount: voteCountByPackId[String(chant.chant_pack_id || "")] || 0,
  }));

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
            <VoteButton chantPackId={chant.chant_pack_id} voteCount={chant.voteCount} />
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
