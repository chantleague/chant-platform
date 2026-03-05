import { BattleCard } from "../components/BattleCard";
import { supabase } from "../lib/supabase";

interface Match {
  id: string;
  slug: string;
  title?: string;
  description?: string;
  home_team?: string;
  away_team?: string;
  status?: string;
  starts_at?: string | null;
  [key: string]: unknown;
}

export default async function BattlesPage() {
  const { data: battles, error } = await supabase
    .from("matches")
    .select("*")
    .order("starts_at", { ascending: false });

  if (error) {
    console.error("Error fetching battles:", error);
    return (
      <div className="p-6">
        <p className="text-red-500 text-sm">Failed to load battles</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">Battles</h1>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(battles || []).map((battle: Match) => {
          const slugVal = (battle.slug as string) || "";
          const [clubA, clubB] = slugVal.split("-vs-");
          const clubDisplay = `${clubA.replace(/-/g, " ")} vs ${clubB.replace(/-/g, " ")}`;
          return (
            <BattleCard
              key={slugVal}
              slug={slugVal}
              title={clubDisplay}
              subtitle={(battle.description as string) || ""}
              status={(battle.status as string) || "upcoming"}
              tag="battle"
              metricLabel="Fans Joined"
              metricValue={battle.stats?.fansJoined?.toLocaleString() || "0"}
            />
          );
        })}
      </div>
    </div>
  );
}

