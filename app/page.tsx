import { getBrand } from "./lib/getBrand";

export default function Home() {
  const brand = getBrand();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
          {brand.key === "chantleague" ? "CHANT LEAGUE • FOOTBALL ARENA" : "BATTLES LEAGUE • PRO ARENA"}
        </p>

        <h1 className="mt-3 text-3xl font-bold">{brand.key === "chantleague"
          ? "Chants, fixtures, and club anthems in one matchday feed."
          : "Battles, leaderboards, and pro competitions."
        }</h1>

        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Domain-based brand routing is ON. You should see the correct brand automatically depending on which domain you visit.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-black/30 p-5">
          <div className="text-xs font-semibold text-zinc-200">Chant League domain</div>
          <div className="mt-1 text-sm text-zinc-400">Visit chantleague.com / chantleague.co.uk → Chant League UI</div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/30 p-5">
          <div className="text-xs font-semibold text-zinc-200">Battles League domain</div>
          <div className="mt-1 text-sm text-zinc-400">Visit battlesleague.com → Battles League UI</div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/30 p-5">
          <div className="text-xs font-semibold text-zinc-200">Same codebase</div>
          <div className="mt-1 text-sm text-zinc-400">One repo. Two brands. No query parameters.</div>
        </div>
      </div>
    </div>
  );
}