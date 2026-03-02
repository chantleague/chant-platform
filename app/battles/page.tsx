import { BattleCard } from "../components/BattleCard";

import { mockBattles } from "../lib/mockBattles";


export default function BattlesPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
          Battles
        </h1>
        <p className="text-sm text-zinc-400">
          Active and upcoming chant and career battles across Chant League and Battle League.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {mockBattles.map((battle) => (
          <BattleCard
            key={battle.slug}
            slug={battle.slug}
            title={battle.title}
            subtitle={battle.description.split(".")[0]}
            status="upcoming"
            tag="Premier League"
            metricLabel="Fans joined"
            metricValue="0"
          />
        ))}
      </div>
    </div>
  );
}

