import { supabase } from "@/app/lib/supabase";
import { LeaderboardTable } from "@/app/components/LeaderboardTable";
import type { LeaderboardRow } from "@/app/components/LeaderboardTable";
import type { ChantPack, ChantWithMatch } from "@/app/lib/types";

// helper for grouping vote counts by club
function tallyVotes(votes: Array<{ club_slug: string }>) {
  const map: Record<string, number> = {};
  votes.forEach((v) => {
    map[v.club_slug] = (map[v.club_slug] || 0) + 1;
  });
  return Object.entries(map)
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count);
}

export default async function LeaderboardsPage() {
  // fetch votes from last 7 days and all time
  let recentVotes: Array<{ club_slug: string }> = [];
  let allVotes: Array<{ club_slug: string }> = [];
  let fanRows: LeaderboardRow[] = [];
  const packsWithVotes: ChantWithMatch[] = [];

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rv, error: err1 } = await supabase
      .from("votes")
      .select("club_slug")
      .gte("created_at", sevenDaysAgo);
    if (err1) {
      console.error("Error fetching recent votes", err1);
    } else if (rv) {
      recentVotes = rv as Array<{ club_slug: string }>;
    }

    const { data: av, error: err2 } = await supabase
      .from("votes")
      .select("club_slug");
    if (err2) {
      console.error("Error fetching all-time votes", err2);
    } else if (av) {
      allVotes = av as Array<{ club_slug: string }>;
    }

    const { data: fanVoteData, error: fanErr } = await supabase
      .from("votes")
      .select("user_id");
    if (fanErr) {
      console.error("Error fetching fan votes", fanErr);
    } else {
      const fanMap: Record<string, number> = {};
      (fanVoteData as Array<{ user_id?: string | null }> | null)?.forEach((vote) => {
        const userId = vote.user_id;
        if (!userId) {
          return;
        }
        fanMap[userId] = (fanMap[userId] || 0) + 1;
      });

      fanRows = Object.entries(fanMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([userId, count], idx) => ({
          position: idx + 1,
          name: userId,
          metric: "votes",
          value: count,
        }));
    }

    const { data: allPacks, error: packErr } = await supabase
      .from("chant_packs")
      .select("*")
      .eq("official", true);
    if (packErr) {
      console.error("Error fetching chant packs", packErr);
    } else {
      for (const rawPack of (allPacks as ChantPack[] | null) || []) {
        const { count: voteCount } = await supabase
          .from("chant_votes")
          .select("*", { count: "exact" })
          .eq("chant_pack_id", rawPack.id);

        const { data: matchData } = await supabase
          .from("matches")
          .select("title")
          .eq("id", rawPack.match_id)
          .single();

        packsWithVotes.push({
          ...rawPack,
          voteCount: voteCount || 0,
          match_title: (matchData as { title?: string } | null)?.title || "Unknown Match",
        });
      }

      packsWithVotes.sort((a, b) => b.voteCount - a.voteCount);
    }
  } catch (e) {
    console.error("Leaderboard query failed", e);
  }

  const recentTally = tallyVotes(recentVotes);
  const allTally = tallyVotes(allVotes);

  const recentRows: LeaderboardRow[] = recentTally.map((item, idx) => ({
    position: idx + 1,
    name: item.slug,
    metric: "votes",
    value: item.count,
  }));

  const allRows: LeaderboardRow[] = allTally.map((item, idx) => ({
    position: idx + 1,
    name: item.slug,
    metric: "votes",
    value: item.count,
  }));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Leaderboards
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Top Clubs by MVP Votes
        </h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          See which clubs have the most MVP votes from the crowd. The first table
          reflects the past week, and the second shows all-time results.
        </p>
      </header>

      {/* recent 7-day section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-50">Last 7 Days</h2>
        {recentRows.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 text-center">
            <p className="text-zinc-400">No votes cast in the past week.</p>
          </div>
        ) : (
          <LeaderboardTable rows={recentRows} label="Weekly MVP votes" />
        )}
      </section>

      {/* all-time section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-50">All Time</h2>
        {allRows.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 text-center">
            <p className="text-zinc-400">No votes have been recorded yet.</p>
          </div>
        ) : (
          <LeaderboardTable rows={allRows} label="All-time MVP votes" />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-50">Top Official Chants</h2>
        {packsWithVotes.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 text-center">
            <p className="text-zinc-400">No official chant votes recorded yet.</p>
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
                  <tr key={chant.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-300">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-zinc-50">{chant.title}</p>
                        {chant.description && (
                          <p className="mt-1 text-xs text-zinc-500">{chant.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{chant.match_title}</td>
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
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-50">Most Active Fans</h2>
        {fanRows.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 text-center">
            <p className="text-zinc-400">No fan voting activity yet.</p>
          </div>
        ) : (
          <LeaderboardTable rows={fanRows} label="Fan votes" />
        )}
      </section>
    </div>
  );
}
