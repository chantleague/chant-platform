import { notFound } from "next/navigation";
import { mockClubs } from "../../lib/mockClubs";
import { mockBattles } from "../../lib/mockBattles";
import { BattleCard } from "../../components/BattleCard";

export default async function ClubPage({ params }: { params: { slug: string | string[] } }) {
  const { slug: rawSlug } = await params;
  const maybeSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const slug = (maybeSlug ?? "").toString().trim().toLowerCase();

  console.log("ClubPage hit with slug:", slug);
  const club = mockClubs.find((c) => c.slug === slug);
  if (!club) {
    console.log("Club not found for slug", slug);
    // render simple not-found message instead of throwing generic 404
    return (
      <div className="p-6 text-center">
        <h1 className="text-xl font-bold text-zinc-50">Club not found</h1>
        <p className="text-sm text-zinc-400">
          We couldn't find a club for &quot;{slug}&quot;.
        </p>
      </div>
    );
  }

  const relatedBattles = mockBattles.filter((b) => b.slug.includes(slug));

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">{club.name}</h1>
        <p className="text-sm text-zinc-400">{club.description}</p>
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Total fans: {club.fans.toLocaleString()}
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-50">Active battles</h2>
        {relatedBattles.length === 0 ? (
          <p className="text-sm text-zinc-400">No battles found for this club.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedBattles.map((b) => {
              const [clubA, clubB] = b.slug.split("-vs-");
              const clubDisplay = `${clubA.replace(/-/g, " ")} vs ${clubB.replace(/-/g, " ")}`;
              return (
                <BattleCard
                  key={b.slug}
                  slug={b.slug}
                  title={clubDisplay}
                  subtitle={b.description}
                  status="upcoming"
                  tag="battle"
                  metricLabel="Fans Joined"
                  metricValue={b.stats.fansJoined.toLocaleString()}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
