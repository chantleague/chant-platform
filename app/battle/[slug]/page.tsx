import { notFound } from "next/navigation";

const mockBattles = [
  {
    slug: "derby-night-north-v-south",
    title: "Derby Night: North End vs South Side",
    description:
      "Rival ends of the city collide in a ninety-minute chant marathon streamed across the stadium and abroad.",
    stats: {
      chants: 3241,
      voters: 9804,
      peakDb: 116,
    },
  },
  {
    slug: "campus-finals-chant-off",
    title: "Campus Finals Chant-Off",
    description:
      "Students from across the region go head to head in curated chant sets for the finals bracket.",
    stats: {
      chants: 782,
      voters: 4120,
      peakDb: 110,
    },
  },
];

type Params = {
  params: {
    slug: string;
  };
};

export default function BattleDetailPage({ params }: Params) {
  const battle = mockBattles.find((b) => b.slug === params.slug);
  if (!battle) return notFound();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Battle Overview
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
          {battle.title}
        </h1>
        <p className="max-w-2xl text-sm text-zinc-400">{battle.description}</p>
      </header>
      <section className="grid gap-4 text-xs text-zinc-300 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Chants Submitted
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">
            {battle.stats.chants.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Total Voters
          </p>
          <p className="mt-1 text-2xl font-semibold text-sky-400">
            {battle.stats.voters.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Peak Volume
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-50">
            {battle.stats.peakDb}
            <span className="ml-1 text-xs text-zinc-500">dB</span>
          </p>
        </div>
      </section>
    </div>
  );
}

