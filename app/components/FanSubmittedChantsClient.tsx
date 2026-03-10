"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import VoteButton from "@/app/components/VoteButton";
import { supabase } from "@/app/lib/supabase";
import type { FanChant } from "@/app/lib/types";

interface FanChantWithVotes extends FanChant {
  voteCount: number;
}

interface RealtimeChantRow {
  id?: string;
  match_id?: string | null;
  chant_pack_id?: string | null;
  club_id?: string | null;
  title?: string | null;
  chant_text?: string | null;
  lyrics?: string | null;
  audio_url?: string | null;
  submitted_by?: string | null;
  created_at?: string | null;
  vote_count?: number | null;
}

interface FanSubmittedChantsClientProps {
  initialChants: FanChantWithVotes[];
  battleSlug?: string;
  matchId?: string;
}

function toTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function maskSubmitter(submitter: string) {
  if (submitter.length <= 14) {
    return submitter;
  }

  return `${submitter.slice(0, 10)}...`;
}

function toValidUuid(value: string) {
  const candidate = value.trim();
  if (!candidate) {
    return "";
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(candidate) ? candidate : "";
}

function toVoteCount(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseInt(String(value || ""), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

export default function FanSubmittedChantsClient({
  initialChants,
  battleSlug,
  matchId,
}: FanSubmittedChantsClientProps) {
  const [chants, setChants] = useState<FanChantWithVotes[]>(initialChants);
  const [votedByChantId, setVotedByChantId] = useState<Record<string, boolean>>({});
  const [votePulseByChantId, setVotePulseByChantId] = useState<Record<string, boolean>>({});
  const votePulseTimersRef = useRef<Record<string, number>>({});

  const normalizedMatchId = useMemo(() => {
    const explicitMatchId = String(matchId || "").trim();
    if (explicitMatchId) {
      return explicitMatchId;
    }

    return String(initialChants[0]?.match_id || "").trim();
  }, [initialChants, matchId]);

  const triggerVotePulse = (chantId: string) => {
    const normalizedChantId = String(chantId || "").trim();
    if (!normalizedChantId) {
      return;
    }

    const existingTimer = votePulseTimersRef.current[normalizedChantId];
    if (typeof existingTimer === "number") {
      window.clearTimeout(existingTimer);
    }

    setVotePulseByChantId((previous) => ({
      ...previous,
      [normalizedChantId]: true,
    }));

    votePulseTimersRef.current[normalizedChantId] = window.setTimeout(() => {
      setVotePulseByChantId((previous) => {
        if (!previous[normalizedChantId]) {
          return previous;
        }

        const next = { ...previous };
        delete next[normalizedChantId];
        return next;
      });

      delete votePulseTimersRef.current[normalizedChantId];
    }, 700);
  };

  useEffect(() => {
    return () => {
      Object.values(votePulseTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });

      votePulseTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!normalizedMatchId) {
      return;
    }

    const channel = supabase
      .channel(`fan-chants-realtime-${normalizedMatchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chants",
          filter: `match_id=eq.${normalizedMatchId}`,
        },
        (payload) => {
          const nextRow = (payload.new || {}) as RealtimeChantRow;
          const previousRow = (payload.old || {}) as RealtimeChantRow;
          const chantId = String(nextRow.id || previousRow.id || "").trim();

          if (!chantId) {
            return;
          }

          if (payload.eventType === "DELETE") {
            const activeTimer = votePulseTimersRef.current[chantId];
            if (typeof activeTimer === "number") {
              window.clearTimeout(activeTimer);
              delete votePulseTimersRef.current[chantId];
            }

            setVotePulseByChantId((previous) => {
              if (!previous[chantId]) {
                return previous;
              }

              const next = { ...previous };
              delete next[chantId];
              return next;
            });

            setChants((previous) => previous.filter((chant) => String(chant.id || "") !== chantId));
            return;
          }

          let didVoteCountChange = false;

          setChants((previous) => {
            const existingIndex = previous.findIndex(
              (chant) => String(chant.id || "").trim() === chantId,
            );

            if (existingIndex === -1) {
              const chantText = String(nextRow.chant_text || "").trim();
              const lyrics = String(nextRow.lyrics || chantText || "Fan Chant").trim();
              const insertedVoteCount = toVoteCount(nextRow.vote_count, 0);

              if (insertedVoteCount > 0) {
                didVoteCountChange = true;
              }

              const insertedChant: FanChantWithVotes = {
                id: chantId,
                match_id: String(nextRow.match_id || normalizedMatchId),
                battle_id: String(nextRow.match_id || normalizedMatchId),
                chant_pack_id: nextRow.chant_pack_id ? String(nextRow.chant_pack_id) : null,
                club_id: nextRow.club_id ? String(nextRow.club_id) : null,
                title: String(nextRow.title || "Fan Chant"),
                chant_text: chantText || lyrics,
                lyrics,
                audio_url: nextRow.audio_url ? String(nextRow.audio_url) : null,
                vote_count: insertedVoteCount,
                voteCount: insertedVoteCount,
                submitted_by: String(nextRow.submitted_by || "fan"),
                created_at: String(nextRow.created_at || new Date().toISOString()),
              };

              return [insertedChant, ...previous];
            }

            const existing = previous[existingIndex];
            const nextVoteCount = toVoteCount(nextRow.vote_count, existing.voteCount);

            if (existing.voteCount !== nextVoteCount) {
              didVoteCountChange = true;
            }

            const nextChant: FanChantWithVotes = {
              ...existing,
              match_id: nextRow.match_id ? String(nextRow.match_id) : existing.match_id,
              battle_id: nextRow.match_id ? String(nextRow.match_id) : existing.battle_id,
              chant_pack_id: nextRow.chant_pack_id
                ? String(nextRow.chant_pack_id)
                : existing.chant_pack_id || null,
              club_id: nextRow.club_id ? String(nextRow.club_id) : existing.club_id || null,
              title: nextRow.title ? String(nextRow.title) : existing.title,
              chant_text:
                typeof nextRow.chant_text === "string" ? nextRow.chant_text : existing.chant_text,
              lyrics: nextRow.lyrics ? String(nextRow.lyrics) : existing.lyrics,
              audio_url:
                typeof nextRow.audio_url === "string" ? nextRow.audio_url : existing.audio_url,
              submitted_by: nextRow.submitted_by
                ? String(nextRow.submitted_by)
                : existing.submitted_by,
              created_at: nextRow.created_at ? String(nextRow.created_at) : existing.created_at,
              vote_count: nextVoteCount,
              voteCount: nextVoteCount,
            };

            const next = [...previous];
            next[existingIndex] = nextChant;
            return next;
          });

          if (didVoteCountChange) {
            triggerVotePulse(chantId);
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("fan chants realtime subscription error", {
            status,
            matchId: normalizedMatchId,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [normalizedMatchId]);

  const topChants = useMemo(() => {
    return [...chants]
      .sort((a, b) => {
        if (b.voteCount !== a.voteCount) {
          return b.voteCount - a.voteCount;
        }

        return toTimestamp(b.created_at) - toTimestamp(a.created_at);
      })
      .slice(0, 5);
  }, [chants]);

  const newestChants = useMemo(() => {
    return [...chants].sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at));
  }, [chants]);

  const handleVoteChange = (chantId: string, newCount: number, hasVoted: boolean) => {
    let didVoteCountChange = false;

    setChants((previous) => {
      return previous.map((chant) => {
        if (chant.id !== chantId) {
          return chant;
        }

        if (chant.voteCount !== newCount) {
          didVoteCountChange = true;
        }

        return {
          ...chant,
          vote_count: newCount,
          voteCount: newCount,
        };
      });
    });

    if (didVoteCountChange) {
      triggerVotePulse(chantId);
    }

    if (hasVoted) {
      setVotedByChantId((previous) => {
        if (previous[chantId]) {
          return previous;
        }

        return {
          ...previous,
          [chantId]: true,
        };
      });
    }
  };

  const renderChantCard = (chant: FanChantWithVotes) => {
    const chantText = (chant.chant_text || chant.lyrics || "").trim();
    const chantPackId = String(chant.chant_pack_id || "").trim();
    const chantRowId = toValidUuid(String(chant.id || ""));
    const isVotePulsing = Boolean(votePulseByChantId[chant.id]);

    return (
      <article
        key={chant.id}
        className={`rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 transition-all duration-300 ${
          isVotePulsing ? "border-emerald-500/70 shadow-[0_0_0_1px_rgba(16,185,129,0.45)]" : ""
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-50">{chant.title}</h3>
            <p className="text-sm whitespace-pre-wrap text-zinc-300">{chantText}</p>
            <p
              className={`text-xs font-semibold transition-all duration-500 ${
                isVotePulsing ? "text-emerald-300 scale-105" : "text-zinc-400"
              }`}
            >
              Votes: {chant.voteCount.toLocaleString()}
            </p>
            {chant.audio_url && (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Fan Recording
                </p>
                <audio controls preload="metadata" className="w-full max-w-md" src={chant.audio_url}>
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
            <p className="text-xs text-zinc-500">
              Submitted by {maskSubmitter(String(chant.submitted_by || "anonymous"))}
            </p>
          </div>

          <div
            className={`flex shrink-0 items-center transition-transform duration-300 ${
              isVotePulsing ? "scale-105" : "scale-100"
            }`}
          >
            <VoteButton
              chantPackId={chantPackId || undefined}
              chantRowId={chantRowId || undefined}
              matchId={chant.match_id || undefined}
              battleSlug={battleSlug}
              voteCount={chant.voteCount}
              hasVotedOverride={Boolean(votedByChantId[chant.id])}
              onVoteChange={(newCount, hasVoted) => {
                handleVoteChange(chant.id, newCount, hasVoted);
              }}
            />
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-zinc-50">Top Chants</h3>
        {topChants.length > 0 ? (
          topChants.map((chant) => renderChantCard(chant))
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
            Top chants will update live as votes come in.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-zinc-50">New Chants</h3>
        {newestChants.length > 0 ? (
          newestChants.map((chant) => renderChantCard(chant))
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
            New chants will appear here in real time.
          </div>
        )}
      </section>
    </div>
  );
}
