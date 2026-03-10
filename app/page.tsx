import Link from "next/link";
import { deriveBattleRouteSlug } from "@/app/lib/battleRoutes";
import { mockBattles } from "@/app/lib/mockBattles";
import { supabase } from "@/app/lib/supabase";

type TrendingBattle = {
  slug: string;
  homeName: string;
  awayName: string;
  votes: number;
};

function toDisplayName(value?: unknown): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return normalized
    .replace(/_/g, "-")
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function parseTeamsFromTitle(title: string): { homeName: string; awayName: string } | null {
  const match = title.match(/(.+?)\s+vs\s+(.+)/i);
  if (!match) {
    return null;
  }

  return {
    homeName: match[1].trim(),
    awayName: match[2].trim(),
  };
}

function toVotes(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function fallbackTrendingBattles(): TrendingBattle[] {
  return mockBattles.slice(0, 6).map((battle) => {
    const teams = parseTeamsFromTitle(battle.title);
    return {
      slug: battle.slug,
      homeName: teams?.homeName || "Home Club",
      awayName: teams?.awayName || "Away Club",
      votes: battle.stats.voters,
    };
  });
}

async function getTrendingBattles(): Promise<TrendingBattle[]> {
  const fallback = fallbackTrendingBattles();

  try {
    const { data, error } = await supabase
      .from("matches")
      .select("slug, title, home_team, away_team, vote_count")
      .order("vote_count", { ascending: false })
      .limit(6);

    if (error) {
      console.error("home: failed to fetch trending battles", error);
      return fallback;
    }

    const normalized = (((data as Array<Record<string, unknown>> | null) || [])
      .map((row) => {
        const slug = deriveBattleRouteSlug({
          slug: row.slug,
          homeTeam: row.home_team,
          awayTeam: row.away_team,
        });

        if (!slug) {
          return null;
        }

        const title = String(row.title || "").trim();
        const parsedFromTitle = parseTeamsFromTitle(title);

        const homeName =
          toDisplayName(row.home_team) || parsedFromTitle?.homeName || "Home Club";
        const awayName =
          toDisplayName(row.away_team) || parsedFromTitle?.awayName || "Away Club";

        return {
          slug,
          homeName,
          awayName,
          votes: toVotes(row.vote_count),
        } satisfies TrendingBattle;
      })
      .filter((battle): battle is TrendingBattle => Boolean(battle)));

    return normalized.length > 0 ? normalized : fallback;
  } catch (error) {
    console.error("home: unexpected trending battles error", error);
    return fallback;
  }
}

export default async function HomePage() {
  const trendingBattles = await getTrendingBattles();

  return (
    <div className="space-y-14 pb-8">
      <section className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950/30 px-6 py-16 text-center shadow-xl">
        <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight text-white md:text-6xl">
          Football Fans Battle With Chants
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-300 md:text-lg">
          Submit chants. Vote for your club. Win the rivalry.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/battles"
            className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
          >
            View Battles
          </Link>
          <Link
            href="/clubs"
            className="rounded-full border border-zinc-600 px-6 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-400 hover:text-white"
          >
            Browse Clubs
          </Link>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">How It Works</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">Three Steps To Rivalry Glory</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
            <p className="text-2xl">1️⃣</p>
            <h3 className="mt-3 text-lg font-semibold text-zinc-100">Submit Chant</h3>
            <p className="mt-2 text-sm text-zinc-400">Fans submit chants before kickoff.</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
            <p className="text-2xl">2️⃣</p>
            <h3 className="mt-3 text-lg font-semibold text-zinc-100">Vote</h3>
            <p className="mt-2 text-sm text-zinc-400">Fans vote for the best chant.</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
            <p className="text-2xl">3️⃣</p>
            <h3 className="mt-3 text-lg font-semibold text-zinc-100">Win the Battle</h3>
            <p className="mt-2 text-sm text-zinc-400">Top chant wins the rivalry.</p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Trending Battles</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">Most-Voted Matchups Right Now</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trendingBattles.map((battle) => (
            <article
              key={battle.slug}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 transition hover:border-zinc-600"
            >
              <h3 className="text-lg font-semibold text-zinc-100">
                {battle.homeName} vs {battle.awayName}
              </h3>
              <p className="mt-2 text-sm text-zinc-400">Votes: {battle.votes.toLocaleString()}</p>
              <Link
                href={`/battles/${encodeURIComponent(battle.slug)}`}
                className="mt-4 inline-flex rounded-full border border-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300 transition hover:bg-emerald-500 hover:text-black"
              >
                Open Battle
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-950/70 px-6 py-12 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
          Join the biggest football chant battles online.
        </h2>
        <Link
          href="/battles"
          className="mt-6 inline-flex rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
        >
          View Battles
        </Link>
      </section>
    </div>
  );
}
