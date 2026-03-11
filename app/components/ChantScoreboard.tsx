"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { trackAnalyticsEvent } from "@/app/lib/analyticsClient";

export interface ChantScoreboardRow {
  chantId: string;
  chantName: string;
  totalPoints: number;
  votePoints: number;
  sharePoints: number;
  commentPoints: number;
  remixPoints: number;
  invitePoints: number;
  streamPoints: number;
  downloadPoints: number;
  boostPoints: number;
}

interface ChantScoreboardProps {
  battleId: string;
  battleSlug: string;
  initialRows: ChantScoreboardRow[];
}

interface ChantScorePayload {
  total_points?: number;
  votes?: number;
  shares?: number;
  comments?: number;
  remixes?: number;
  invites?: number;
  downloads?: number;
  streams?: number;
  boosts?: number;
}

interface RealtimeEventRow {
  chant_id?: string;
  event_type?: string;
  points?: number;
}

function toInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortRows(rows: ChantScoreboardRow[]) {
  return [...rows].sort((left, right) => {
    if (right.totalPoints !== left.totalPoints) {
      return right.totalPoints - left.totalPoints;
    }

    return left.chantName.localeCompare(right.chantName);
  });
}

function applyEventToRow(
  row: ChantScoreboardRow,
  eventType: string,
  points: number,
): ChantScoreboardRow {
  const normalizedEventType = eventType.toLowerCase();

  if (normalizedEventType === "vote") {
    return {
      ...row,
      totalPoints: row.totalPoints + points,
      votePoints: row.votePoints + points,
    };
  }

  if (normalizedEventType === "share") {
    return {
      ...row,
      totalPoints: row.totalPoints + points,
      sharePoints: row.sharePoints + points,
    };
  }

  if (normalizedEventType === "comment") {
    return {
      ...row,
      totalPoints: row.totalPoints + points,
      commentPoints: row.commentPoints + points,
    };
  }

  if (normalizedEventType === "remix") {
    return {
      ...row,
      totalPoints: row.totalPoints + points,
      remixPoints: row.remixPoints + points,
    };
  }

  if (normalizedEventType === "invite") {
    return {
      ...row,
      totalPoints: row.totalPoints + points,
      invitePoints: row.invitePoints + points,
    };
  }

  if (normalizedEventType === "download") {
    return {
      ...row,
      totalPoints: row.totalPoints + points,
      downloadPoints: row.downloadPoints + points,
    };
  }

  if (normalizedEventType === "spotify_stream" || normalizedEventType === "youtube_play") {
    return {
      ...row,
      totalPoints: row.totalPoints + points,
      streamPoints: row.streamPoints + points,
    };
  }

  if (normalizedEventType === "boost") {
    return {
      ...row,
      totalPoints: row.totalPoints + points,
      boostPoints: row.boostPoints + points,
    };
  }

  return {
    ...row,
    totalPoints: row.totalPoints + points,
  };
}

export default function ChantScoreboard({
  battleId,
  battleSlug,
  initialRows,
}: ChantScoreboardProps) {
  const [rows, setRows] = useState<ChantScoreboardRow[]>(() => sortRows(initialRows));
  const [boostingByChantId, setBoostingByChantId] = useState<Record<string, boolean>>({});
  const rowsRef = useRef<ChantScoreboardRow[]>(rows);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    setRows(sortRows(initialRows));
  }, [initialRows]);

  const battleTotalPoints = useMemo(() => {
    return rows.reduce((sum, row) => sum + row.totalPoints, 0);
  }, [rows]);

  const hydrateChantFromApi = async (chantId: string) => {
    try {
      const response = await fetch(`/api/chant-score/${encodeURIComponent(chantId)}`);
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as ChantScorePayload;
      setRows((previous) => {
        const existingIndex = previous.findIndex((row) => row.chantId === chantId);
        const hydratedRow: ChantScoreboardRow = {
          chantId,
          chantName:
            existingIndex >= 0
              ? previous[existingIndex].chantName
              : `Fan Chant ${chantId.slice(0, 8)}`,
          totalPoints: toInt(payload.total_points),
          votePoints: toInt(payload.votes),
          sharePoints: toInt(payload.shares),
          commentPoints: toInt(payload.comments),
          remixPoints: toInt(payload.remixes),
          invitePoints: toInt(payload.invites),
          downloadPoints: toInt(payload.downloads),
          streamPoints: toInt(payload.streams),
          boostPoints: toInt(payload.boosts),
        };

        if (existingIndex >= 0) {
          const next = [...previous];
          next[existingIndex] = hydratedRow;
          return sortRows(next);
        }

        return sortRows([...previous, hydratedRow]);
      });
    } catch (error) {
      console.error("chant-scoreboard: failed to hydrate chant score", {
        chantId,
        error,
      });
    }
  };

  const handleSponsorBoost = async (chantId: string) => {
    if (boostingByChantId[chantId]) {
      return;
    }

    setBoostingByChantId((previous) => ({
      ...previous,
      [chantId]: true,
    }));

    try {
      const response = await fetch("/api/score-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chant_id: chantId,
          battle_id: battleId,
          event_type: "boost",
          source: "app",
          metadata: {
            battle_slug: battleSlug,
            trigger: "scoreboard_boost",
          },
        }),
      });

      if (!response.ok) {
        console.error("chant-scoreboard: boost event failed", {
          battleId,
          chantId,
          status: response.status,
        });
      } else {
        trackAnalyticsEvent("chant_boost", {
          battle_slug: battleSlug,
          chant_id: chantId,
        });
      }
    } catch (error) {
      console.error("chant-scoreboard: boost request failed", {
        chantId,
        error,
      });
    } finally {
      setBoostingByChantId((previous) => {
        if (!previous[chantId]) {
          return previous;
        }

        const next = { ...previous };
        delete next[chantId];
        return next;
      });
    }
  };

  useEffect(() => {
    if (!battleId) {
      return;
    }

    const channel = supabase
      .channel(`chant-score-events-${battleId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chant_score_events",
          filter: `battle_id=eq.${battleId}`,
        },
        (payload) => {
          const nextRow = (payload.new || {}) as RealtimeEventRow;
          const chantId = String(nextRow.chant_id || "").trim();
          const eventType = String(nextRow.event_type || "").trim().toLowerCase();
          const points = toInt(nextRow.points);

          if (!chantId || !eventType || points <= 0) {
            return;
          }

          if (!rowsRef.current.some((row) => row.chantId === chantId)) {
            void hydrateChantFromApi(chantId);
          }

          setRows((previous) => {
            const existingIndex = previous.findIndex((row) => row.chantId === chantId);
            if (existingIndex === -1) {
              return previous;
            }

            const next = [...previous];
            next[existingIndex] = applyEventToRow(next[existingIndex], eventType, points);
            return sortRows(next);
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("chant-scoreboard: realtime subscription error", {
            status,
            battleId,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [battleId]);

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Chant Scoreboard</p>
          <h2 className="text-lg font-semibold text-zinc-50">Live Engagement Points</h2>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Battle Score</p>
          <p className="text-2xl font-semibold text-emerald-400">{battleTotalPoints.toLocaleString()}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">
          No chant score events yet. Scores will update in real time.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.chantId} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">{row.chantName}</h3>
                  <p className="mt-1 text-sm text-zinc-300">
                    Score: <span className="font-semibold text-emerald-300">{row.totalPoints.toLocaleString()}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void handleSponsorBoost(row.chantId);
                  }}
                  disabled={Boolean(boostingByChantId[row.chantId])}
                  className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
                >
                  {boostingByChantId[row.chantId] ? "Boosting..." : "Sponsor Boost (+20)"}
                </button>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-300 sm:grid-cols-4">
                <div>
                  <dt className="text-zinc-500">Votes</dt>
                  <dd>{row.votePoints.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Shares</dt>
                  <dd>{row.sharePoints.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Comments</dt>
                  <dd>{row.commentPoints.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Remixes</dt>
                  <dd>{row.remixPoints.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Invites</dt>
                  <dd>{row.invitePoints.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Downloads</dt>
                  <dd>{row.downloadPoints.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Streams</dt>
                  <dd>{row.streamPoints.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Boosts</dt>
                  <dd>{row.boostPoints.toLocaleString()}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
