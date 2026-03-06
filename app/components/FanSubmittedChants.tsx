import { supabase } from "@/app/lib/supabase";
import type { FanChant } from "@/app/lib/types";
import VoteButton from "@/app/components/VoteButton";

interface FanSubmittedChantsProps {
  battleId: string;
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

export default async function FanSubmittedChants({
  battleId,
}: FanSubmittedChantsProps) {
  if (!battleId) {
    return (
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-zinc-50">Top Chants</h3>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
            No chants available yet.
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-zinc-50">New Chants</h3>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
            No chants available yet.
          </div>
        </section>
      </div>
    );
  }

  let data: FanChant[] | null = null;
  let error: { message?: string } | null = null;

  const withAudio = await supabase
    .from("chants")
    .select("id, battle_id, chant_pack_id, club_id, title, chant_text, lyrics, audio_url, submitted_by, created_at")
    .eq("battle_id", battleId)
    .order("created_at", { ascending: false });

  if (
    withAudio.error &&
    /(audio_url|chant_text|club_id)/i.test(withAudio.error.message || "")
  ) {
    const fallback = await supabase
      .from("chants")
      .select("id, battle_id, chant_pack_id, title, lyrics, submitted_by, created_at")
      .eq("battle_id", battleId)
      .order("created_at", { ascending: false });

    data =
      ((fallback.data as FanChant[] | null) || []).map((chant) => ({
        ...chant,
        club_id: null,
        chant_text: chant.lyrics,
        audio_url: null,
      })) || null;
    error = fallback.error ? { message: fallback.error.message } : null;
  } else {
    data = withAudio.data as FanChant[] | null;
    error = withAudio.error ? { message: withAudio.error.message } : null;
  }

  if (error) {
    console.error("Error fetching fan chants", error);
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

  const chants = (data as FanChant[] | null) || [];
  if (chants.length === 0) {
    return (
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-zinc-50">Top Chants</h3>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
            No fan chants submitted yet. Be the first to drop one.
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-zinc-50">New Chants</h3>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
            New fan chants will appear here.
          </div>
        </section>
      </div>
    );
  }

  const chantsWithVotes: FanChantWithVotes[] = [];

  for (const chant of chants) {
    const { count } = await supabase
      .from("chant_votes")
      .select("*", { count: "exact" })
      .eq("chant_pack_id", chant.chant_pack_id);

    chantsWithVotes.push({
      ...chant,
      voteCount: count || 0,
    });
  }

  const topChants = [...chantsWithVotes]
    .sort((a, b) => {
      if (b.voteCount !== a.voteCount) {
        return b.voteCount - a.voteCount;
      }

      return toTimestamp(b.created_at) - toTimestamp(a.created_at);
    })
    .slice(0, 5);

  const topIds = new Set(topChants.map((chant) => chant.id));
  const newestChants = [...chantsWithVotes]
    .filter((chant) => !topIds.has(chant.id))
    .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at));

  const fallbackNewest = newestChants.length > 0
    ? newestChants
    : [...chantsWithVotes].sort(
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
              Submitted by {maskSubmitter(chant.submitted_by)}
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
        {fallbackNewest.map((chant) => renderChantCard(chant))}
      </section>
    </div>
  );
}
