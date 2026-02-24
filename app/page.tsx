import { brands } from "./brand-config";

type HomeProps = {
  searchParams?: {
    brand?: string;
  };
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
const brandKey =
  params?.brand === "battleleague" ? "battleleague" : "chantleague";
  const brand = brands[brandKey];
  const isFootball = brand.theme === "football";

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-black to-zinc-950 px-6 py-8 shadow-[0_32px_80px_rgba(0,0,0,0.9)] lg:px-10 lg:py-10">
        <div className="max-w-3xl space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {brand.name} · {isFootball ? "Football Arena" : "Career Arena"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            {isFootball
              ? "Chants, fixtures, and club anthems in one matchday feed."
              : "Battles, cohorts, and professional showdowns in one live stream."}
          </h1>
          <p className="text-sm text-zinc-400">
            {isFootball
              ? "You are viewing the Chant League experience. Switch to the Battle League view with the brand query parameter while staying on the same codebase."
              : "You are viewing the Battle League experience. Switch to the Chant League view with the brand query parameter while staying on the same codebase."}
          </p>
        </div>
        <div className="mt-6 grid gap-4 text-xs text-zinc-300 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              Chant League View
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-50">
              Use{" "}
              <span className="font-mono text-emerald-400">
                ?brand=chantleague
              </span>{" "}
              to force football mode locally on{" "}
              <span className="font-mono text-zinc-300">
                localhost:3000
              </span>
              .
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              Battle League View
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-50">
              Use{" "}
              <span className="font-mono text-sky-400">
                ?brand=battleleague
              </span>{" "}
              to force professional mode locally on{" "}
              <span className="font-mono text-zinc-300">
                localhost:3000
              </span>
              .
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              Shared Engine
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-50">
              One codebase, brand-aware experience, mocked data for now.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
