import {
  getBattleLifecycle,
  getBattleStatus as getBattlePhaseStatus,
  type BattlePhaseStatus,
} from "@/lib/battleLifecycle";

export type BattleLifecycleStatus = "upcoming" | "open" | "closed";

function toKickoffMs(kickoff: string | Date | null | undefined) {
  if (!kickoff) {
    return null;
  }

  const kickoffDate = kickoff instanceof Date ? kickoff : new Date(kickoff);
  const kickoffMs = kickoffDate.getTime();

  if (Number.isNaN(kickoffMs)) {
    return null;
  }

  return kickoffMs;
}

export function normalizeBattleStatus(status?: string | null): BattleLifecycleStatus {
  const normalizedStatus = String(status || "").trim().toLowerCase();

  if (normalizedStatus === "open" || normalizedStatus === "live") {
    return "open";
  }

  if (
    normalizedStatus === "closed" ||
    normalizedStatus === "completed" ||
    normalizedStatus === "finished"
  ) {
    return "closed";
  }

  return "upcoming";
}

function mapPhaseToLegacyStatus(phase: BattlePhaseStatus): BattleLifecycleStatus {
  if (
    phase === "discussion" ||
    phase === "submission_open" ||
    phase === "voting_open" ||
    phase === "final_scoring"
  ) {
    return "open";
  }

  if (phase === "upcoming") {
    return "upcoming";
  }

  return "closed";
}

export function getBattleStatus(kickoff: string | Date | null | undefined): BattleLifecycleStatus {
  if (toKickoffMs(kickoff) === null) {
    return "upcoming";
  }

  const lifecycle = getBattleLifecycle(kickoff);
  const phase = getBattlePhaseStatus(Date.now(), lifecycle);
  return mapPhaseToLegacyStatus(phase);
}

export function getBattleOpensAt(kickoff: string | Date | null | undefined): string | null {
  return getBattleLifecycle(kickoff).battle_opens_at;
}

export function resolveBattleStatus(
  kickoff: string | Date | null | undefined,
  storedStatus?: string | null,
): BattleLifecycleStatus {
  if (toKickoffMs(kickoff) === null) {
    return normalizeBattleStatus(storedStatus);
  }

  const lifecycle = getBattleLifecycle(kickoff);
  const phase = getBattlePhaseStatus(Date.now(), lifecycle);
  return mapPhaseToLegacyStatus(phase);
}
