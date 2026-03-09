import { supabase } from "@/app/lib/supabase";
import { toRenderableChantText } from "@/app/lib/chantContent";
import VoteButton from "./VoteButton";
import type { ChantPack } from "@/app/lib/types";

interface ChantPackWithVotes extends ChantPack {
  voteCount: number;
}

export default async function OfficialChantPacks({ matchId }: { matchId: string }) {
  const { data: packs, error } = await supabase
    .from("chant_packs")
    .select("*")
    .eq("match_id", matchId)
    .eq("official", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching chant packs:", error);
    return <div className="text-red-500 text-sm">Failed to load official chant packs</div>;
  }

  const visiblePacks = ((packs as ChantPack[] | null) || []).filter((pack) =>
    Boolean(toRenderableChantText(pack.description, pack.title)),
  );

  // Fetch vote counts for all packs
  const packsWithVotes: ChantPackWithVotes[] = [];

  if (visiblePacks.length > 0) {
    for (const pack of visiblePacks) {
      const { count } = await supabase
        .from("chant_votes")
        .select("*", { count: "exact" })
        .eq("chant_pack_id", pack.id);

      packsWithVotes.push({
        ...pack,
        voteCount: count || 0,
      });
    }
  }

  // Sort by vote count (descending)
  packsWithVotes.sort((a, b) => b.voteCount - a.voteCount);

  if (!packsWithVotes || packsWithVotes.length === 0) {
    return (
      <section className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Official Chant Packs
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-50 mt-2">
            No official chants yet
          </h2>
          <p className="text-sm text-zinc-400">
            Official chant packs will appear here when released by the club.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Official Chant Packs
        </p>
        <h2 className="text-lg font-semibold tracking-tight text-zinc-50 mt-2">
          Club-approved Chants
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
        {packsWithVotes.map((pack: ChantPackWithVotes) => {
          const safeTitle = toRenderableChantText(pack.title) || "Official Chant";
          const safeDescription = toRenderableChantText(pack.description || "");

          return (
            <div
              key={pack.id}
              className="rounded-2xl border border-emerald-900/50 bg-emerald-950/30 p-4 hover:border-emerald-700/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-emerald-400">
                      Official
                    </p>
                  </div>
                  <h3 className="font-semibold text-zinc-50">{safeTitle}</h3>
                  {safeDescription && (
                    <p className="mt-1 text-sm text-zinc-400">{safeDescription}</p>
                  )}
                </div>
              </div>
              {pack.audio_url && (
                <div className="mt-4">
                  <audio
                    controls
                    className="w-full rounded"
                    src={pack.audio_url}
                    preload="metadata"
                  >
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-zinc-400">Votes</p>
                <VoteButton chantPackId={pack.id} voteCount={pack.voteCount} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
