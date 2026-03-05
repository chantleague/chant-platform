import { BattleCard } from "../components/BattleCard";
import { supabase } from "@/app/lib/supabase";
import { mockBattles } from "../lib/mockBattles";
import type { Battle } from "../lib/types";

export default async function BattlesPage() {
  const { data: battlesData, error } = await supabase
    .from("matches")
    .select("*")
    .order("starts_at", { ascending: false });

  let battles = (battlesData as Battle[] | null) || [];
  if (error) {
    console.error("Error fetching battles:", error);
    // fall back to mock data so UI still shows something during network issues
    battles = mockBattles as unknown as Battle[];
  }

  return (
    <div className="p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">Battles</h1>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(battles || []).map((battle: Battle) => {
          const slugVal = (battle.slug as string) || "";
          const [clubA, clubB] = slugVal.split("-vs-");
          const clubDisplay = `${clubA.replace(/-/g, " ")} vs ${clubB.replace(/-/g, " ")}`;
          return (
          <BattleCard
              key={slugVal}
              slug={slugVal}
              title={clubDisplay}
              subtitle={(battle.description as string) || ""}
              status={
                (battle.status as "live" | "upcoming" | "finished") ||
                "upcoming"
              }
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

