import { BattleCard } from "../components/BattleCard";

const mockBattles = [
  {
    slug: "derby-night-north-v-south",
    title: "Derby Night: North End vs South Side",
    subtitle: "Chants clash under the floodlights.",
    status: "live" as const,
    tag: "Chant Battle",
    metricLabel: "Chants submitted",
    metricValue: "3,241",
  },
  {
    slug: "campus-finals-chant-off",
    title: "Campus Finals Chant-Off",
    subtitle: "Student sections fight for the loudest legacy.",
    status: "upcoming" as const,
    tag: "Student Arena",
    metricLabel: "Squads registered",
    metricValue: "48",
  },
  {
    slug: "career-day-pitch-battle",
    title: "Career Day Pitch Battle",
    subtitle: "Professionals pitch, students roar, mentors vote.",
    status: "finished" as const,
    tag: "Career Battle",
    metricLabel: "Total votes",
    metricValue: "19,084",
  },
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
          <BattleCard key={battle.slug} {...battle} />
        ))}
      </div>
    </div>
  );
}

