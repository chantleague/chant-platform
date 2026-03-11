"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { trackAnalyticsEvent } from "@/app/lib/analyticsClient";

interface JoinBattleButtonProps {
  targetId?: string;
  battleSlug?: string;
  battleId?: string;
  defaultChantId?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toValidUuid(value?: string | null): string {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return "";
  }

  return UUID_PATTERN.test(candidate) ? candidate : "";
}

export default function JoinBattleButton({
  targetId,
  battleSlug,
  battleId,
  defaultChantId,
}: JoinBattleButtonProps) {
  const [fansJoined, setFansJoined] = useState(1);
  const searchParams = useSearchParams();

  const postScoreEvent = (
    eventType: "community_join" | "invite",
    chantId: string,
    metadata?: Record<string, unknown>,
  ) => {
    if (!battleId || !chantId) {
      return;
    }

    void fetch("/api/score-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chant_id: chantId,
        battle_id: battleId,
        event_type: eventType,
        source: "web",
        metadata,
      }),
      keepalive: true,
    }).catch((error) => {
      console.error("join-battle: failed to record score event", {
        eventType,
        chantId,
        battleId,
        error,
      });
    });
  };

  const handleJoinBattle = () => {
    setFansJoined((prev) => prev + 1);

    trackAnalyticsEvent("battle_join", {
      battle_slug: battleSlug || undefined,
    });

    const inviteCode = String(searchParams.get("invite") || "").trim();
    const inviteChantId = toValidUuid(searchParams.get("chant"));
    const fallbackChantId = toValidUuid(defaultChantId);
    const resolvedChantId = inviteChantId || fallbackChantId;

    if (resolvedChantId) {
      postScoreEvent("community_join", resolvedChantId, {
        battle_slug: battleSlug || null,
      });
    }

    if (inviteCode && resolvedChantId) {
      const inviteMarkerKey = `invite-score:${battleSlug || "battle"}:${inviteCode}:${resolvedChantId}`;
      const alreadyTracked = localStorage.getItem(inviteMarkerKey) === "1";

      if (!alreadyTracked) {
        postScoreEvent("invite", resolvedChantId, {
          battle_slug: battleSlug || null,
          invite_code: inviteCode,
        });

        localStorage.setItem(inviteMarkerKey, "1");
      }
    }

    if (!targetId) {
      return;
    }

    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
        {targetId ? "Join Battle & Submit Chant" : "Join Battle"}
      </button>
    </div>
  );
}
