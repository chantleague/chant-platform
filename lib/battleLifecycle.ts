export type BattlePhaseStatus =
  | "upcoming"
  | "discussion"
  | "submission_open"
  | "voting_open"
  | "final_scoring"
  | "voting_closed"
  | "winner_reveal"
  | "live"
  | "closed";

export interface BattleLifecycle {
  kickoff_at: string | null;
  battle_opens_at: string | null;
  submission_opens_at: string | null;
  voting_opens_at: string | null;
  submission_closes_at: string | null;
  voting_closes_at: string | null;
  winner_reveal_at: string | null;
  final_scoring_at: string | null;
}

const LIVE_WINDOW_HOURS = 4;
const HOUR_MS = 60 * 60 * 1000;

function toMs(value: string | Date | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return timestamp;
}

function toIso(timestamp: number | null): string | null {
  if (timestamp === null) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function resolveWindow(startValue: string | null | undefined, fallbackMs: number | null) {
  const explicitMs = toMs(startValue || null);
  if (explicitMs !== null) {
    return explicitMs;
  }

  return fallbackMs;
}

export function getBattleLifecycle(kickoffAt: string | Date | null | undefined): BattleLifecycle {
  const kickoffMs = toMs(kickoffAt);

  return {
    kickoff_at: toIso(kickoffMs),
    battle_opens_at: toIso(kickoffMs === null ? null : kickoffMs - 10 * 24 * HOUR_MS),
    submission_opens_at: toIso(kickoffMs === null ? null : kickoffMs - 7 * 24 * HOUR_MS),
    voting_opens_at: toIso(kickoffMs === null ? null : kickoffMs - 5 * 24 * HOUR_MS),
    submission_closes_at: toIso(kickoffMs === null ? null : kickoffMs - 3 * 24 * HOUR_MS),
    voting_closes_at: toIso(kickoffMs === null ? null : kickoffMs - 24 * HOUR_MS),
    winner_reveal_at: toIso(kickoffMs === null ? null : kickoffMs - 12 * HOUR_MS),
    final_scoring_at: toIso(kickoffMs === null ? null : kickoffMs - 48 * HOUR_MS),
  };
}

export function getBattleLifecycleFromRow(row: Record<string, unknown>): BattleLifecycle {
  const kickoffAt =
    (typeof row.kickoff_at === "string" && row.kickoff_at) ||
    (typeof row.kickoff === "string" && row.kickoff) ||
    (typeof row.kickoff_time === "string" && row.kickoff_time) ||
    (typeof row.starts_at === "string" && row.starts_at) ||
    null;

  const baseLifecycle = getBattleLifecycle(kickoffAt);
  const kickoffMs = toMs(baseLifecycle.kickoff_at);

  const battleOpensMs = resolveWindow(
    typeof row.battle_opens_at === "string" ? row.battle_opens_at : null,
    kickoffMs === null ? null : kickoffMs - 10 * 24 * HOUR_MS,
  );
  const submissionOpensMs = resolveWindow(
    typeof row.submission_opens_at === "string" ? row.submission_opens_at : null,
    kickoffMs === null ? null : kickoffMs - 7 * 24 * HOUR_MS,
  );
  const votingOpensMs = resolveWindow(
    typeof row.voting_opens_at === "string" ? row.voting_opens_at : null,
    kickoffMs === null ? null : kickoffMs - 5 * 24 * HOUR_MS,
  );
  const submissionClosesMs = resolveWindow(
    typeof row.submission_closes_at === "string" ? row.submission_closes_at : null,
    kickoffMs === null ? null : kickoffMs - 3 * 24 * HOUR_MS,
  );
  const votingClosesMs = resolveWindow(
    typeof row.voting_closes_at === "string" ? row.voting_closes_at : null,
    kickoffMs === null ? null : kickoffMs - 24 * HOUR_MS,
  );
  const winnerRevealMs = resolveWindow(
    typeof row.winner_reveal_at === "string" ? row.winner_reveal_at : null,
    kickoffMs === null ? null : kickoffMs - 12 * HOUR_MS,
  );
  const finalScoringMs = kickoffMs === null ? null : kickoffMs - 48 * HOUR_MS;

  return {
    kickoff_at: toIso(kickoffMs),
    battle_opens_at: toIso(battleOpensMs),
    submission_opens_at: toIso(submissionOpensMs),
    voting_opens_at: toIso(votingOpensMs),
    submission_closes_at: toIso(submissionClosesMs),
    voting_closes_at: toIso(votingClosesMs),
    winner_reveal_at: toIso(winnerRevealMs),
    final_scoring_at: toIso(finalScoringMs),
  };
}

export function getBattleStatus(now: string | Date | number, lifecycle: BattleLifecycle): BattlePhaseStatus {
  const nowMs = typeof now === "number" ? now : toMs(now);
  if (nowMs === null) {
    return "upcoming";
  }

  const battleOpensMs = toMs(lifecycle.battle_opens_at);
  const submissionOpensMs = toMs(lifecycle.submission_opens_at);
  const votingOpensMs = toMs(lifecycle.voting_opens_at);
  const finalScoringMs = toMs(lifecycle.final_scoring_at);
  const votingClosesMs = toMs(lifecycle.voting_closes_at);
  const winnerRevealMs = toMs(lifecycle.winner_reveal_at);
  const kickoffMs = toMs(lifecycle.kickoff_at);

  if (kickoffMs === null) {
    return "upcoming";
  }

  if (battleOpensMs !== null && nowMs < battleOpensMs) {
    return "upcoming";
  }

  if (submissionOpensMs !== null && nowMs < submissionOpensMs) {
    return "discussion";
  }

  if (votingOpensMs !== null && nowMs < votingOpensMs) {
    return "submission_open";
  }

  if (finalScoringMs !== null && nowMs < finalScoringMs) {
    return "voting_open";
  }

  if (votingClosesMs !== null && nowMs < votingClosesMs) {
    return "final_scoring";
  }

  if (winnerRevealMs !== null && nowMs < winnerRevealMs) {
    return "voting_closed";
  }

  if (nowMs < kickoffMs) {
    return "winner_reveal";
  }

  if (nowMs < kickoffMs + LIVE_WINDOW_HOURS * HOUR_MS) {
    return "live";
  }

  return "closed";
}

export function isSubmissionOpen(now: string | Date | number, lifecycle: BattleLifecycle) {
  const nowMs = typeof now === "number" ? now : toMs(now);
  const opensAtMs = toMs(lifecycle.submission_opens_at);
  const closesAtMs = toMs(lifecycle.submission_closes_at);

  if (nowMs === null || opensAtMs === null || closesAtMs === null) {
    return false;
  }

  return nowMs >= opensAtMs && nowMs < closesAtMs;
}

export function isVotingOpen(now: string | Date | number, lifecycle: BattleLifecycle) {
  const nowMs = typeof now === "number" ? now : toMs(now);
  const opensAtMs = toMs(lifecycle.voting_opens_at);
  const closesAtMs = toMs(lifecycle.voting_closes_at);

  if (nowMs === null || opensAtMs === null || closesAtMs === null) {
    return false;
  }

  return nowMs >= opensAtMs && nowMs < closesAtMs;
}
