import { getBrand } from "./lib/getBrand";

export default function Home() {
  const brand = getBrand();
  const isFootball = brand.theme === "football";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-black/50 p-8">
        <div className="text-xs uppercase tracking-widest text-zinc-400">
          {isFootball ? "Chant League • Football Arena" : "Battle League • Pro Arena"}
        </div>

        <h1 className="mt-3 text-3xl font-bold">
          {isFootball
            ? "Chants, fixtures, and club anthems in one matchday feed."
            : "Battles, leaderboards, and pro challenges in one arena."}
        </h1>

        <p className="mt-3 max-w-2xl text-zinc-300">
          Domain-based routing is ON. You are viewing:{" "}
          <span className="font-semibold" style={{ color: brand.primary }}>
            {brand.name}
          </span>
        </p>
      </div>
    </div>
  );
}