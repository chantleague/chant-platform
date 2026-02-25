import { getBrand } from "./lib/getBrand";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default function Home() {
  const brand = getBrand();

  const isFootball = brand.theme === "football";

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{brand.name}</h1>

      <p className="text-white/70">
        Domain-based routing is ON. (No query params needed.)
      </p>

      {isFootball ? (
        <p>Show Chant League football UI here.</p>
      ) : (
        <p>Show Battle League pro/career UI here.</p>
      )}
    </div>
  );
}