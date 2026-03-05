import { notFound } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { BattleCard } from "../../components/BattleCard";

interface Club {
  id: string;
  slug: string;
  name: string;
  description?: string;
  fans?: number;
  [key: string]: unknown;
}

interface Match {
  id: string;
  slug: string;
  description?: string;
  stats?: { fansJoined?: number };
  [key: string]: unknown;
}

export default async function ClubPage({ params }: { params: { slug: string | string[] } }) {
  const { slug: rawSlug } = params;
  const maybeSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const slug = (maybeSlug ?? "").toString().trim().toLowerCase();

  const { data: club, error: clubError } = await supabase
    .from<Club>("clubs")
    .select("*")
    .eq("slug", slug)
    .single();

  if (clubError || !club) {
    console.error("Club fetch error", clubError);
    return notFound();
  }

  const { data: relatedBattles = [], error: battlesError } = await supabase
    .from("matches")
    .select("*")
    .ilike("slug", `%${slug}%`);

  if (battlesError) {
    console.error("Error fetching related battles:", battlesError);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">{club.name}</h1>
        {club.description && <p className="text-sm text-zinc-400">{club.description}</p>}
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Total fans: {(club.fans || 0).toLocaleString()}
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-50">Active battles</h2>
        {relatedBattles.length === 0 ? (
          <p className="text-sm text-zinc-400">No battles found for this club.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedBattles.map((b: Match) => {
              const slugVal = b.slug || "";
              const [clubA, clubB] = slugVal.split("-vs-");
              const clubDisplay = `${clubA.replace(/-/g, " ")} vs ${clubB.replace(/-/g, " ")}`;
              return (
                <BattleCard
                  key={slugVal}
                  slug={slugVal}
                  title={clubDisplay}
                  subtitle={(b.description as string) || ""}
                  status="upcoming"
                  tag="battle"
                  metricLabel="Fans Joined"
                  metricValue={
                    b.stats?.fansJoined?.toLocaleString() || "0"
                  }
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
