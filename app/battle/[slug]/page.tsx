import { notFound } from "next/navigation";
import { mockBattles } from "../../lib/mockBattles";

export default async function Page({ params }: { params: { slug: string | string[] } }) {
  // unwrap promise per Next.js requirement
  const { slug: rawSlug } = await params;

  // support optional array param (catch edge cases) and normalize
  const maybeSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const slug = decodeURIComponent((maybeSlug ?? "").toString()).trim().toLowerCase();

  // strict, case-insensitive comparison against canonical list
  const battle = mockBattles.find((b) => (b.slug ?? "").toLowerCase() === slug);
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

