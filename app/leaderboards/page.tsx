import { supabase } from "@/app/lib/supabase";
import { LeaderboardTable } from "@/app/components/LeaderboardTable";
import type { ChantWithMatch, FanRow } from "@/app/lib/types";


export default async function LeaderboardsPage() {
  // Fetch all chant packs
  const { data: allPacks, error: err } = await supabase
    .from("chant_packs")
    .select("*")
    .eq("official", true);

  if (err) {
    console.error("Error fetching chant packs:", err);
    return <div className="text-red-500 text-sm">Failed to load leaderboards</div>;
  }

  // Fetch vote counts for all packs
  const packsWithVotes: ChantWithMatch[] = [];

  if (allPacks && allPacks.length > 0) {
    for (const pack of allPacks) {
      const { count } = await supabase
        .from("chant_votes")
        .select("*", { count: "exact" })
        .eq("chant_pack_id", pack.id);

      const { data: matchData } = await supabase
        .from("matches")
        .select("title")
        .eq("id", pack.match_id)
        .single();

      packsWithVotes.push({
        ...pack,
        voteCount: count || 0,
        match_title: matchData?.title || "Unknown Match",
      });
    }
  }

  // Sort by vote count (descending)
  packsWithVotes.sort((a, b) => b.voteCount - a.voteCount);

  // Calculate most active fans based on votes table
  const fanRows: FanRow[] = [];

  try {
    const { data: allVotes } = await supabase.from("votes").select("*");
    const fanMap: Record<string, number> = {};
    (allVotes || []).forEach((v: { user_id: string }) => {
      const uid = v.user_id;
      fanMap[uid] = (fanMap[uid] || 0) + 1;
    });
    const sortedFans = Object.entries(fanMap).sort((a, b) => b[1] - a[1]);
    sortedFans.slice(0, 10).forEach(([uid, count], idx) => {
      fanRows.push({ position: idx + 1, name: uid, metric: "votes", value: count });
    });
  } catch (e) {
    console.error("Error fetching fan leaderboard:", e);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Leaderboards
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Top Chants by Votes
        </h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Discover the most voted chants across all battles. Vote for your favorites to see them rise the ranks.
        </p>
      </header>

      {packsWithVotes.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 text-center">
          <p className="text-zinc-400">No chants to display yet. Check back soon!</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 shadow-[0_18px_40px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Top Voted Chants
            </p>
            <p className="text-xs text-zinc-500">Total: {packsWithVotes.length} chants</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                <th className="px-6 py-3 text-left">Rank</th>
                <th className="px-6 py-3 text-left">Chant</th>
                <th className="px-6 py-3 text-left">Battle</th>
                <th className="px-6 py-3 text-right">Votes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {packsWithVotes.map((chant, index) => (
                <tr
                  key={chant.id}
                  className="hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-300">
                        {index + 1}
                      </span>
                      {index === 0 && <span className="text-lg">👑</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-50">{chant.title}</p>
                      {chant.description && (
                        <p className="mt-1 text-xs text-zinc-500">{chant.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {chant.match_title}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-400">
                      {chant.voteCount.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-2xl border border-blue-900/50 bg-blue-950/30 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
          💡 About Leaderboards
        </p>
        <p className="text-sm text-blue-300">
          This leaderboard shows the top-voted official chant packs from all battles. Each user can vote once per chant. The ranking updates in real-time as votes are cast.
        </p>
      </div>

      {/* fan leaderboard section */}
      {fanRows.length > 0 && (
        <div className="space-y-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Fan Leaderboard
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Most Active Fans
          </h2>
          <LeaderboardTable rows={fanRows} label="Fan votes" />
        </div>
      )}
    </div>
  );
}
