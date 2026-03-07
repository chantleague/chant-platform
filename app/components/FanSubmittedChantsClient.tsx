"use client";

import { useMemo, useState } from "react";
import VoteButton from "@/app/components/VoteButton";
import type { FanChant } from "@/app/lib/types";

interface FanChantWithVotes extends FanChant {
  voteCount: number;
}

interface FanSubmittedChantsClientProps {
  initialChants: FanChantWithVotes[];
  battleSlug?: string;
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

export default function FanSubmittedChantsClient({
  initialChants,
  battleSlug,
}: FanSubmittedChantsClientProps) {
  const [chants, setChants] = useState<FanChantWithVotes[]>(initialChants);
  const [votedByChantId, setVotedByChantId] = useState<Record<string, boolean>>({});

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
    setChants((previous) =>
      previous.map((chant) =>
        chant.id === chantId
          ? {
              ...chant,
              voteCount: newCount,
            }
          : chant,
      ),
    );

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

    return (
      <article
        key={chant.id}
        className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-50">{chant.title}</h3>
            <p className="text-sm whitespace-pre-wrap text-zinc-300">{chantText}</p>
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

          <div className="flex shrink-0 items-center">
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
        {topChants.map((chant) => renderChantCard(chant))}
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-zinc-50">New Chants</h3>
        {newestChants.map((chant) => renderChantCard(chant))}
      </section>
    </div>
  );
}
