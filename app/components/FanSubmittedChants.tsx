import { supabase } from "@/app/lib/supabase";
import type { FanChant } from "@/app/lib/types";
import VoteButton from "@/app/components/VoteButton";

interface FanSubmittedChantsProps {
  battleId: string;
}

interface FanChantWithVotes extends FanChant {
  voteCount: number;
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
    return null;
  }

  let data: FanChant[] | null = null;
  let error: { message?: string } | null = null;

  const withAudio = await supabase
    .from("chants")
    .select("id, battle_id, chant_pack_id, title, lyrics, audio_url, submitted_by, created_at")
    .eq("battle_id", battleId)
    .order("created_at", { ascending: false });

  if (withAudio.error && (withAudio.error.message || "").toLowerCase().includes("audio_url")) {
    const fallback = await supabase
      .from("chants")
      .select("id, battle_id, chant_pack_id, title, lyrics, submitted_by, created_at")
      .eq("battle_id", battleId)
      .order("created_at", { ascending: false });

    data =
      ((fallback.data as FanChant[] | null) || []).map((chant) => ({
        ...chant,
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
      <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">
        Could not load fan chants right now.
      </div>
    );
  }

  const chants = (data as FanChant[] | null) || [];
  if (chants.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
        No fan chants submitted yet. Be the first to drop one.
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

  return (
    <div className="space-y-3">
      {chantsWithVotes.map((chant) => (
        <article
          key={chant.id}
          className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-zinc-50">{chant.title}</h3>
              <p className="text-sm whitespace-pre-wrap text-zinc-300">{chant.lyrics}</p>
              {chant.audio_url && (
                <audio controls preload="metadata" className="w-full max-w-md" src={chant.audio_url}>
                  Your browser does not support the audio element.
                </audio>
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
      ))}
    </div>
  );
}
