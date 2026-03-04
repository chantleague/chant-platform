import { supabase, ChantPack } from "@/app/lib/supabase";

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

  if (!packs || packs.length === 0) {
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
        {packs.map((pack: ChantPack) => (
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
                <h3 className="font-semibold text-zinc-50">{pack.title}</h3>
                {pack.description && (
                  <p className="mt-1 text-sm text-zinc-400">{pack.description}</p>
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
          </div>
        ))}
      </div>
    </section>
  );
}
