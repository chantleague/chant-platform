import { supabase } from "@/app/lib/supabase";
import { mockClubs } from "../lib/mockClubs";
import { ClubCard } from "../components/ClubCard";
import type { Club } from "../lib/types";

type ClubCardModel = {
  slug: string;
  name: string;
  fans: number;
};

export default async function ClubsPage() {
  const fallbackClubs: ClubCardModel[] = (mockClubs as Club[]).map((club) => ({
    slug: String(club.slug || "").trim(),
    name: String(club.name || "Unknown Club"),
    fans: Number.isFinite(Number(club.fans)) ? Number(club.fans) : 0,
  })).filter((club) => Boolean(club.slug));

  let clubs: ClubCardModel[] = fallbackClubs;

  try {
    const { data: clubsData, error } = await supabase
      .from("clubs")
      .select("id, slug, name, fans");

    if (error) {
      console.error("Error fetching clubs:", error);
    } else {
      const normalized = (((clubsData as Array<Record<string, unknown>> | null) || [])
        .map((row) => {
          const slug = String(row.slug || row.id || "").trim();
          if (!slug) {
            return null;
          }

          return {
            slug,
            name: String(row.name || slug),
            fans: Number.isFinite(Number(row.fans)) ? Number(row.fans) : 0,
          } as ClubCardModel;
        })
        .filter((club): club is ClubCardModel => Boolean(club)));

      if (normalized.length > 0) {
        clubs = normalized;
      }
    }
  } catch (queryError) {
    console.error("Error loading clubs page:", queryError);
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-zinc-50">Clubs</h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(clubs || []).map((club) => (
          <ClubCard
            key={club.slug}
            slug={club.slug}
            name={club.name}
            fans={club.fans}
          />
        ))}
      </div>
    </div>
  );
}
