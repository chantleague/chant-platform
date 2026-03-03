"use client";

import { useState } from "react";

export default function JoinBattleButton() {
  const [fansJoined, setFansJoined] = useState(1);

  const handleJoinBattle = () => {
    setFansJoined((prev) => prev + 1);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
          Fans Joined
        </p>
        <p className="mt-2 text-3xl font-semibold text-purple-400">
          {fansJoined.toLocaleString()}
        </p>
      </div>
      <button
        onClick={handleJoinBattle}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-purple-500 active:bg-purple-700"
      >
        Join Battle
      </button>
    </div>
  );
}
