import { BattleCard } from "../components/BattleCard";

const mockBattles = [
  {
    slug: "arsenal-vs-spurs",
    title: "Arsenal vs Spurs Chant Battle",
    subtitle: "North London rivalry ignites before matchday",
    status: "upcoming" as const,
    tag: "Premier League",
    metricLabel: "Fans joined",
    metricValue: "0",
  },
  {
    slug: "man-utd-vs-liverpool",
    title: "Man United vs Liverpool Chant Battle",
    subtitle: "England’s biggest rivalry goes head-to-head",
    status: "upcoming" as const,
    tag: "Premier League",
    metricLabel: "Fans joined",
    metricValue: "0",
  },
  {
    slug: "england-vs-brazil",
    title: "England vs Brazil Chant Battle",
    subtitle: "World Cup rivalry begins",
    status: "upcoming" as const,
    tag: "World Cup",
    metricLabel: "Fans joined",
    metricValue: "0",
  }
];
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
            subtitle={battle.subtitle}
            status={battle.status}
            tag={battle.tag}
            metricLabel={battle.metricLabel}
            metricValue={battle.metricValue}
          />
        ))}
      </div>
    </div>
  );
}

