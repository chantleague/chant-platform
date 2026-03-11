import { BattleCard } from "../components/BattleCard";
import { supabase } from "@/app/lib/supabase";
import { deriveBattleRouteSlug } from "@/app/lib/battleRoutes";
import type { Battle, Club } from "../lib/types";

export default async function BattlesPage() {
  const { data: battlesData, error } = await supabase
    .from("matches")
    .select("*")
    .order("starts_at", { ascending: false });

  let battles = (battlesData as Battle[] | null) || [];
  if (error) {
    console.error("Error fetching battles:", error);
    // fall back to empty list when network hiccup occurs
    battles = [];
  }

  // fetch clubs once and map by slug or id
  const { data: clubsData } = await supabase.from("clubs").select("*");
  const clubMap: Record<string, Club> = {};
  (clubsData as Club[] | null || []).forEach((c) => {
    if (c.slug) clubMap[c.slug] = c;
    if (c.id) clubMap[c.id] = c;
  });

  return (
    <div className="p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">Battles</h1>
      </div>
      {battles.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 text-center">
          <p className="text-zinc-400">No battles available.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {battles.map((battle: Battle) => {
            const slugVal = deriveBattleRouteSlug({
              slug: battle.slug,
              homeTeam: battle.home_team,
              awayTeam: battle.away_team,
            });
            if (!slugVal) {
              return null;
            }

            // prefer club names from foreign-key ids or slug fields
            const homeClub =
              (battle.home_club_id && clubMap[battle.home_club_id]) ||
              (battle.home_team && clubMap[battle.home_team]);
            const awayClub =
              (battle.away_club_id && clubMap[battle.away_club_id]) ||
              (battle.away_team && clubMap[battle.away_team]);
            const clubDisplay = homeClub && awayClub
              ? `${homeClub.name} vs ${awayClub.name}`
              : slugVal.replace(/-/g, " ");
            const normalizedStatus = String(battle.status || "").toLowerCase();
            const cardStatus: "live" | "upcoming" | "finished" =
              normalizedStatus === "open" || normalizedStatus === "live"
                ? "live"
                : normalizedStatus === "closed" ||
                    normalizedStatus === "finished" ||
                    normalizedStatus === "completed"
                  ? "finished"
                  : "upcoming";

            return (
              <BattleCard
                key={battle.id || slugVal}
                slug={slugVal}
                title={clubDisplay}
                subtitle={battle.description || ""}
                status={cardStatus}
                tag="battle"
                metricLabel="Fans Joined"
                metricValue={battle.stats?.fansJoined?.toLocaleString() || "0"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

