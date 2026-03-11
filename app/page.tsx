import Link from "next/link";
import EmailSignup from "@/components/EmailSignup";
import { getTrendingBattles } from "@/lib/trendingBattles";

export default async function HomePage() {
  const trendingBattles = (await getTrendingBattles()).slice(0, 6);

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

      <section id="trending" className="space-y-5 scroll-mt-24">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">🔥 Trending Battles</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">Most Active Matchups Right Now</h2>
        </div>

        {trendingBattles.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 text-sm text-zinc-400">
            No trending battles available yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trendingBattles.map((battle) => {
              const statusTone =
                battle.status === "open"
                  ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-200"
                  : battle.status === "upcoming"
                    ? "border-amber-700/60 bg-amber-950/30 text-amber-200"
                    : "border-red-700/60 bg-red-950/30 text-red-200";

              return (
                <article
                  key={battle.slug}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 transition hover:border-zinc-600"
                >
                  <h3 className="text-lg font-semibold text-zinc-100">
                    {battle.homeName} vs {battle.awayName}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-400">Votes: {battle.votes.toLocaleString()}</p>
                  <span
                    className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusTone}`}
                  >
                    {battle.status}
                  </span>
                  <div>
                    <Link
                      href={`/battles/${encodeURIComponent(battle.slug)}`}
                      className="mt-4 inline-flex rounded-full border border-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300 transition hover:bg-emerald-500 hover:text-black"
                    >
                      Open Battle
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
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

      <EmailSignup />
    </div>
  );
}
