"use client";

import { useEffect, useMemo, useState } from "react";
import { getBattleOpensAt, type BattleLifecycleStatus } from "@/lib/battleStatus";

interface BattleCountdownProps {
  kickoff: string | null;
  status: BattleLifecycleStatus;
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

export default function BattleCountdown({ kickoff, status }: BattleCountdownProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const kickoffMs = useMemo(() => toMs(kickoff), [kickoff]);
  const opensAtMs = useMemo(() => toMs(getBattleOpensAt(kickoff)), [kickoff]);

  if (status === "closed") {
    return <p className="font-mono text-sm text-red-300">Voting closed</p>;
  }

  if (kickoffMs === null) {
    return <p className="font-mono text-sm text-zinc-400">Kickoff time TBD</p>;
  }

  if (status === "upcoming") {
    const targetMs = opensAtMs ?? kickoffMs;
    const remainingSeconds = Math.max(0, Math.floor((targetMs - nowMs) / 1000));

    return (
      <div className="space-y-1">
        <p className="text-sm text-amber-200">Battle opens in {formatHhMmSs(remainingSeconds)}</p>
        <p className="font-mono text-lg font-semibold text-amber-100">{formatHhMmSs(remainingSeconds)}</p>
      </div>
    );
  }

  const remainingToKickoff = Math.max(0, Math.floor((kickoffMs - nowMs) / 1000));

  return (
    <div className="space-y-1">
      <p className="text-sm text-emerald-200">Battle closes at kickoff</p>
      <p className="font-mono text-lg font-semibold text-emerald-100">{formatHhMmSs(remainingToKickoff)}</p>
    </div>
  );
}
