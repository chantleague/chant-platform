import { BattleCard } from "../components/BattleCard";
import { supabase } from "@/app/lib/supabase";
import { deriveBattleRouteSlug } from "@/app/lib/battleRoutes";
import type { Battle, Club } from "../lib/types";
import { getBattleLifecycleFromRow, getBattleStatus } from "@/lib/battleLifecycle";

function getRenderNowMs() {
  return Date.now();
}

function formatKickoff(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "TBD";
  }

  const timestamp = new Date(normalized);
  if (Number.isNaN(timestamp.getTime())) {
    return "TBD";
  }

  return timestamp.toLocaleString();
}

function formatTimeUntil(value?: string | null, nowMs = getRenderNowMs()) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "TBD";
  }

  const targetMs = new Date(normalized).getTime();
  if (Number.isNaN(targetMs)) {
    return "TBD";
  }

  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) {
    return "Closed";
  }

  const totalHours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  return `${hours}h`;
}

function toPhaseLabel(value: string) {
  return value.replace(/_/g, " ");
}

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
            const lifecycle = getBattleLifecycleFromRow({
              kickoff_at:
                (typeof battle.kickoff_at === "string" && battle.kickoff_at) ||
                (typeof battle.kickoff === "string" && battle.kickoff) ||
                (typeof battle.kickoff_time === "string" && battle.kickoff_time) ||
                (typeof battle.starts_at === "string" && battle.starts_at) ||
                null,
              battle_opens_at: typeof battle.battle_opens_at === "string" ? battle.battle_opens_at : null,
              submission_opens_at:
                typeof battle.submission_opens_at === "string" ? battle.submission_opens_at : null,
              voting_opens_at: typeof battle.voting_opens_at === "string" ? battle.voting_opens_at : null,
              submission_closes_at:
                typeof battle.submission_closes_at === "string" ? battle.submission_closes_at : null,
              voting_closes_at:
                typeof battle.voting_closes_at === "string" ? battle.voting_closes_at : null,
              winner_reveal_at:
                typeof battle.winner_reveal_at === "string" ? battle.winner_reveal_at : null,
            });
            const renderNowMs = getRenderNowMs();
            const phase = getBattleStatus(renderNowMs, lifecycle);
            const cardStatus: "live" | "upcoming" | "finished" =
              phase === "upcoming"
                ? "upcoming"
                : phase === "discussion" ||
                    phase === "submission_open" ||
                    phase === "voting_open" ||
                    phase === "final_scoring" ||
                    normalizedStatus === "open" ||
                    normalizedStatus === "live"
                  ? "live"
                  : "finished";

            const phaseBadge = phase === "winner_reveal" ? "WINNER SOON" : phase === "final_scoring" ? "FINAL PUSH" : null;

            return (
              <BattleCard
                key={battle.id || slugVal}
                slug={slugVal}
                title={clubDisplay}
                subtitle={battle.description || ""}
                status={cardStatus}
                phaseLabel={toPhaseLabel(phase)}
                phaseBadge={phaseBadge}
                votingClosesIn={formatTimeUntil(lifecycle.voting_closes_at, renderNowMs)}
                kickoffTime={formatKickoff(lifecycle.kickoff_at)}
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

