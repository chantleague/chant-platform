export type BattleLifecycleStatus = "upcoming" | "open" | "closed";

const BATTLE_OPEN_WINDOW_HOURS = 24;
const BATTLE_OPEN_WINDOW_MS = BATTLE_OPEN_WINDOW_HOURS * 60 * 60 * 1000;

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

export function getBattleStatus(kickoff: string | Date | null | undefined): BattleLifecycleStatus {
  const kickoffMs = toKickoffMs(kickoff);
  if (kickoffMs === null) {
    return "upcoming";
  }

  const now = Date.now();
  const opensAtMs = kickoffMs - BATTLE_OPEN_WINDOW_MS;

  if (now < opensAtMs) {
    return "upcoming";
  }

  if (now < kickoffMs) {
    return "open";
  }

  return "closed";
}

export function getBattleOpensAt(kickoff: string | Date | null | undefined): string | null {
  const kickoffMs = toKickoffMs(kickoff);
  if (kickoffMs === null) {
    return null;
  }

  return new Date(kickoffMs - BATTLE_OPEN_WINDOW_MS).toISOString();
}

export function resolveBattleStatus(
  kickoff: string | Date | null | undefined,
  storedStatus?: string | null,
): BattleLifecycleStatus {
  const kickoffMs = toKickoffMs(kickoff);
  if (kickoffMs === null) {
    return normalizeBattleStatus(storedStatus);
  }

  return getBattleStatus(kickoff);
}
