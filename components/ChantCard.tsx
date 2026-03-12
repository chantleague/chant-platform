"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import VoteButton from "@/app/components/VoteButton";
import { trackAnalyticsEvent } from "@/app/lib/analyticsClient";
import { generateTikTokCaption } from "@/lib/tiktokCaption";

interface ChantCardProps {
  chantId: string;
  chantPackId?: string | null;
  matchId?: string;
  battleId?: string;
  battleSlug?: string;
  title: string;
  categoryLabel: string;
  chantText: string;
  voteCount: number;
  votingClosed?: boolean;
  hasVotedOverride?: boolean;
  onVoteChange?: (newCount: number, hasVoted: boolean) => void;
  isVotePulsing?: boolean;
  audioUrl?: string | null;
  submittedByLabel?: string;
  homeClub?: string;
  awayClub?: string;
}

const SITE_URL = "https://chantleague.com";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getOrCreateFanId() {
  if (typeof window === "undefined") {
    return "";
  }

  let id = window.localStorage.getItem("chant-user-id");
  if (!id) {
    id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    window.localStorage.setItem("chant-user-id", id);
  }

  return id;
}

function toSafeClubName(value: string) {
  const normalized = String(value || "").trim();
  return normalized || "Club";
}

function parseClubNamesFromSlug(slug?: string) {
  const normalized = String(slug || "").trim().toLowerCase();
  if (!normalized || !normalized.includes("-vs-")) {
    return {
      homeClub: "Home Club",
      awayClub: "Away Club",
    };
  }

  const [homePart, awayAndDatePart] = normalized.split("-vs-");
  const awayPart = awayAndDatePart.split(/-\d{4}-\d{2}-\d{2}$/)[0];

  const toDisplay = (value: string) =>
    value
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  return {
    homeClub: toDisplay(homePart),
    awayClub: toDisplay(awayPart),
  };
}

function firstLyricLine(chantText: string) {
  const firstLine = chantText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => Boolean(line));

  return firstLine || "Sing it loud from the stands";
}

function toValidUuid(value: string) {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return "";
  }

  return UUID_PATTERN.test(candidate) ? candidate : "";
}

export default function ChantCard({
  chantId,
  chantPackId,
  matchId,
  battleId,
  battleSlug,
  title,
  categoryLabel,
  chantText,
  voteCount,
  votingClosed = false,
  hasVotedOverride,
  onVoteChange,
  isVotePulsing = false,
  audioUrl,
  submittedByLabel,
  homeClub,
  awayClub,
}: ChantCardProps) {
  const [copied, setCopied] = useState(false);
  const [fanId] = useState(() => getOrCreateFanId());

  const resolvedClubs = useMemo(() => {
    const fromSlug = parseClubNamesFromSlug(battleSlug);
    return {
      homeClub: toSafeClubName(homeClub || fromSlug.homeClub),
      awayClub: toSafeClubName(awayClub || fromSlug.awayClub),
    };
  }, [battleSlug, homeClub, awayClub]);

  const tiktokLandingPath = `/chants/${encodeURIComponent(chantId)}?ref=tiktok`;
  const tiktokLandingUrl = `${SITE_URL}${tiktokLandingPath}`;
  const videoPath = `/chants/${encodeURIComponent(chantId)}/video`;
  const validChantId = toValidUuid(chantId);

  const caption = useMemo(() => {
    return generateTikTokCaption({
      clubA: resolvedClubs.homeClub,
      clubB: resolvedClubs.awayClub,
      chantLyricsLine: firstLyricLine(chantText),
    });
  }, [chantText, resolvedClubs.awayClub, resolvedClubs.homeClub]);

  const handleTikTokShare = async () => {
    if (!validChantId) {
      return;
    }

    trackAnalyticsEvent("chant_share", {
      chant_id: validChantId,
      battle_slug: battleSlug || undefined,
      source: "tiktok",
    });

    try {
      await fetch("/api/score-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chantId: validChantId,
          battleId: battleId || matchId || undefined,
          eventType: "tiktok_usage",
          source: "tiktok",
          metadata: {
            fan_id: fanId || null,
            user_id: fanId || null,
            battle_slug: battleSlug || null,
            share_url: tiktokLandingUrl,
            video_url: `${SITE_URL}${videoPath}`,
          },
        }),
        keepalive: true,
      });
    } catch (error) {
      console.error("chant-card: failed to record tiktok share", {
        chantId: validChantId,
        battleId: battleId || matchId,
        error,
      });
    }

    try {
      await navigator.clipboard.writeText(`${caption}\n\n${tiktokLandingUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("chant-card: failed to copy TikTok caption", {
        chantId: validChantId,
        error,
      });
    }

    window.open("https://www.tiktok.com", "_blank", "noopener,noreferrer");
  };

  return (
    <article
      className={`rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 transition-all duration-300 ${
        isVotePulsing ? "border-emerald-500/70 shadow-[0_0_0_1px_rgba(16,185,129,0.45)]" : ""
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-50">{title}</h3>
          <p className="text-[11px] uppercase tracking-[0.14em] text-amber-300">{categoryLabel}</p>
          <p className="text-sm whitespace-pre-wrap text-zinc-300">{chantText}</p>
          <p
            className={`text-xs font-semibold transition-all duration-500 ${
              isVotePulsing ? "text-emerald-300 scale-105" : "text-zinc-400"
            }`}
          >
            Votes: {voteCount.toLocaleString()}
          </p>

          {audioUrl && (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Fan Recording</p>
              <audio controls preload="metadata" className="w-full max-w-md" src={audioUrl}>
                Your browser does not support the audio element.
              </audio>
            </div>
          )}

          {submittedByLabel && <p className="text-xs text-zinc-500">Submitted by {submittedByLabel}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                void handleTikTokShare();
              }}
              disabled={!validChantId}
              className="rounded-lg bg-neutral-800 px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-neutral-700"
            >
              Share to TikTok
            </button>
            <Link
              href={validChantId ? videoPath : "#"}
              aria-disabled={!validChantId}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                validChantId
                  ? "border-zinc-700 text-zinc-100 hover:border-zinc-500"
                  : "border-zinc-800 text-zinc-500 pointer-events-none"
              }`}
            >
              Open Video Page
            </Link>
            {copied && <span className="text-xs text-emerald-300">Caption copied</span>}
          </div>
        </div>

        <div
          className={`flex shrink-0 items-center transition-transform duration-300 ${
            isVotePulsing ? "scale-105" : "scale-100"
          }`}
        >
          <VoteButton
            chantPackId={String(chantPackId || "").trim() || undefined}
            chantRowId={validChantId || undefined}
            matchId={matchId || battleId || undefined}
            battleSlug={battleSlug}
            voteCount={voteCount}
            votingClosed={votingClosed}
            hasVotedOverride={Boolean(hasVotedOverride)}
            onVoteChange={onVoteChange}
          />
        </div>
      </div>
    </article>
  );
}
