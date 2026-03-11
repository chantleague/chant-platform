"use client";

import { useEffect, useMemo, useState } from "react";
import type { BattleLifecycle, BattlePhaseStatus } from "@/lib/battleLifecycle";

interface BattleCountdownProps {
  lifecycle: BattleLifecycle;
  phase: BattlePhaseStatus;
}

function toMs(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }

  const timestamp = new Date(normalized).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatHhMmSs(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function toPhaseLabel(phase: BattlePhaseStatus) {
  if (phase === "submission_open") {
    return "Submission Open";
  }
  if (phase === "voting_open") {
    return "Voting Open";
  }
  if (phase === "final_scoring") {
    return "Final Scoring";
  }
  if (phase === "voting_closed") {
    return "Voting Closed";
  }
  if (phase === "winner_reveal") {
    return "Winner Reveal";
  }
  if (phase === "discussion") {
    return "Discussion";
  }
  if (phase === "live") {
    return "Live";
  }
  if (phase === "closed") {
    return "Closed";
  }

  return "Upcoming";
}

function toCountdownText(targetMs: number | null, nowMs: number) {
  if (targetMs === null) {
    return "TBD";
  }

  const remainingSeconds = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  return formatHhMmSs(remainingSeconds);
}

export default function BattleCountdown({ lifecycle, phase }: BattleCountdownProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const submissionOpensMs = useMemo(() => toMs(lifecycle.submission_opens_at), [lifecycle.submission_opens_at]);
  const submissionClosesMs = useMemo(() => toMs(lifecycle.submission_closes_at), [lifecycle.submission_closes_at]);
  const votingOpensMs = useMemo(() => toMs(lifecycle.voting_opens_at), [lifecycle.voting_opens_at]);
  const votingClosesMs = useMemo(() => toMs(lifecycle.voting_closes_at), [lifecycle.voting_closes_at]);
  const winnerRevealMs = useMemo(() => toMs(lifecycle.winner_reveal_at), [lifecycle.winner_reveal_at]);

  const submissionTargetMs =
    phase === "upcoming" || phase === "discussion" ? submissionOpensMs : submissionClosesMs;
  const votingTargetMs =
    phase === "upcoming" || phase === "discussion" || phase === "submission_open"
      ? votingOpensMs
      : votingClosesMs;

  const submissionLabel =
    phase === "upcoming" || phase === "discussion" ? "Submission opens in" : "Submission closes in";
  const votingLabel =
    phase === "upcoming" || phase === "discussion" || phase === "submission_open"
      ? "Voting opens in"
      : "Voting closes in";

  const winnerRevealLabel = phase === "winner_reveal" || phase === "live" || phase === "closed"
    ? "Winner reveal"
    : "Winner reveal in";

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-zinc-100">Current Phase: {toPhaseLabel(phase)}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/70 p-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{submissionLabel}</p>
          <p className="font-mono text-sm text-zinc-100">{toCountdownText(submissionTargetMs, nowMs)}</p>
        </div>
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/70 p-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{votingLabel}</p>
          <p className="font-mono text-sm text-zinc-100">{toCountdownText(votingTargetMs, nowMs)}</p>
        </div>
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/70 p-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{winnerRevealLabel}</p>
          <p className="font-mono text-sm text-zinc-100">{toCountdownText(winnerRevealMs, nowMs)}</p>
        </div>
      </div>
    </div>
  );
}
