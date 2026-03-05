import { notFound } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { BattleCard } from "../../components/BattleCard";
import { mockClubs } from "../../lib/mockClubs";
import type { Club, Battle } from "@/app/lib/types";


export default async function ClubPage({ params }: { params: { slug: string | string[] } }) {
  const { slug: rawSlug } = params;
  const maybeSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const slug = (maybeSlug ?? "").toString().trim().toLowerCase();

  const { data, error: clubError } = await supabase
    .from("clubs")
    .select("*")
    .eq("slug", slug)
    .single();
  let club: Club | null = data as Club | null;

  if (clubError || !club) {
    console.error("Club fetch error", clubError);
    // fallback to mock club when network issue occurs
    const mock = mockClubs.find((c) => c.slug === slug);
    if (mock) {
      club = mock as unknown as Club;
    } else {
      return notFound();
    }
  }
  if (!club) {
    return notFound();
  }

  const { data: rawBattles, error: battlesError } = await supabase
    .from("matches")
    .select("*")
    .ilike("slug", `%${slug}%`);
  const normalizedBattles: Battle[] = (rawBattles as Battle[] | null) || [];

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
        {normalizedBattles.length === 0 ? (
          <p className="text-sm text-zinc-400">No battles found for this club.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {normalizedBattles.map((b: Battle) => {
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
