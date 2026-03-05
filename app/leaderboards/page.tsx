import { supabase } from "@/app/lib/supabase";
import { LeaderboardTable } from "@/app/components/LeaderboardTable";
import type { LeaderboardRow } from "@/app/components/LeaderboardTable";

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

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rv, error: err1 } = await supabase
      .from("votes")
      .select("club_slug")
      .gte("created_at", sevenDaysAgo);
    if (err1) {
      console.error("Error fetching recent votes", err1);
    } else if (rv) {
      recentVotes = rv as any;
    }

    const { data: av, error: err2 } = await supabase
      .from("votes")
      .select("club_slug");
    if (err2) {
      console.error("Error fetching all-time votes", err2);
    } else if (av) {
      allVotes = av as any;
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
    </div>
  );
}
