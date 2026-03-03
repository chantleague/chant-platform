import { BattleCard } from "../components/BattleCard";
import { mockBattles } from "../lib/mockBattles";

export default function BattlesPage() {
  return (
    <div className="p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">Battles</h1>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {mockBattles.map((battle) => {
          const [clubA, clubB] = battle.slug.split("-vs-");
          const clubDisplay = `${clubA.replace(/-/g, " ")} vs ${clubB.replace(/-/g, " ")}`;
          return (
            <BattleCard
              key={battle.slug}
              slug={battle.slug}
              title={clubDisplay}
              subtitle={battle.description}
              status="upcoming"
              tag="battle"
              metricLabel="Fans Joined"
              metricValue={battle.stats.fansJoined.toLocaleString()}
            />
          );
        })}
      </div>
    </div>
  );
}

