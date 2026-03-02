import { notFound } from "next/navigation";

const mockBattles = [
  {
    slug: "arsenal-vs-spurs",
    title: "Arsenal vs Spurs Chant Battle",
    description:
      "North London rivalry ignites before matchday. Two of England's most passionate supporter bases go head-to-head in this legendary fixture.",
    stats: {
      chants: 1842,
      voters: 5234,
      peakDb: 118,
    },
  },
  {
    slug: "man-utd-vs-liverpool",
    title: "Man United vs Liverpool Chant Battle",
    description:
      "England's biggest rivalry goes head-to-head. The Reds and the Red Devils clash in one of football's most historic matchups.",
    stats: {
      chants: 3241,
      voters: 9804,
      peakDb: 116,
    },
  },
  {
    slug: "england-vs-brazil",
    title: "England vs Brazil Chant Battle",
    description:
      "World Cup rivalry begins. Two footballing giants battle it out for supremacy on the world stage.",
    stats: {
      chants: 2156,
      voters: 6782,
      peakDb: 120,
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

