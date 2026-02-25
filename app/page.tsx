// app/page.tsx
import { headers } from "next/headers";
import { getBrand } from "./lib/getBrand";
const host = (await headers()).get("host");
export default function Home({
  searchParams,
}: {
  searchParams?: { brand?: string };
}) {
  const brand = getBrand(searchParams?.brand);

  const isFootball = brand.theme === "football";

  return (
    <div className="space-y-8"> <div style={{ position: "fixed", bottom: 10, left: 10, background: "black", color: "white", padding: 8, fontSize: 12, zIndex: 9999 }}>
    Host seen by Vercel: {host}
  </div>
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="text-xs uppercase tracking-widest text-white/50">
          {brand.name} · {isFootball ? "Football Arena" : "Career Arena"}
        </div>

        <h1 className="mt-3 text-3xl font-semibold">
          {isFootball
            ? "Chants, fixtures, and club anthems in one matchday feed."
            : "Battles, cohorts, and professional showdowns in one live stream."}
        </h1>

        <p className="mt-3 max-w-2xl text-white/70">
          You are viewing the {brand.name} experience. Brand is auto-selected by domain.
        </p>
      </section>
    </div>
  );
}