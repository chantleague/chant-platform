"use client";

import { useState } from "react";
import { trackAnalyticsEvent } from "@/app/lib/analyticsClient";
import { buildChantShareText } from "@/lib/shareText";
import { generateTikTokCaption } from "@/lib/tiktokCaption";

interface BattleShareProps {
  slug: string;
  homeClub: string;
  awayClub: string;
  kickoffAt?: string | null;
  battleId?: string;
  chants?: Array<{
    chantId: string;
    chantText: string;
    category?: string | null;
  }>;
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

function firstLyricLine(value: string) {
  const firstLine = value
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

export default function BattleShare({
  slug,
  homeClub,
  awayClub,
  kickoffAt,
  battleId,
  chants = [],
}: BattleShareProps) {
  const [copiedChantId, setCopiedChantId] = useState<string | null>(null);
  const [fanId] = useState(() => getOrCreateFanId());

  const buttonClass =
    "rounded-lg bg-neutral-800 px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-neutral-700";

  const visibleChants = chants.filter((chant) => Boolean(String(chant.chantId || "").trim()));

  const toShareUrl = (chantId: string, category?: string | null) => {
    const battlePath = `/battles/${encodeURIComponent(slug)}`;
    const search = new URLSearchParams();
    search.set("chant", chantId);
    if (category) {
      search.set("category", String(category));
    }

    return `${SITE_URL}${battlePath}?${search.toString()}`;
  };

  const toTikTokShareUrl = (chantId: string) => {
    const validChantId = toValidUuid(chantId);
    if (!validChantId) {
      return `${SITE_URL}/battles/${encodeURIComponent(slug)}`;
    }

    return `${SITE_URL}/chants/${encodeURIComponent(validChantId)}?ref=tiktok`;
  };

  const recordShare = async (
    source: "twitter" | "whatsapp" | "tiktok" | "copy_link",
    chantId: string,
    category?: string | null,
    shareUrl?: string,
    videoUrl?: string,
  ) => {
    const eventType = source === "tiktok" ? "tiktok_usage" : source === "whatsapp" ? "whatsapp_share" : "share";

    trackAnalyticsEvent("chant_share", {
      battle_slug: slug,
      source,
      chant_id: chantId,
      category: category || undefined,
    });

    try {
      await fetch("/api/score-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chantId,
          battleId,
          eventType,
          source,
          metadata: {
            fan_id: fanId || null,
            user_id: fanId || null,
            battle_slug: slug,
            category: category || null,
            share_url: shareUrl || `${SITE_URL}/battles/${encodeURIComponent(slug)}`,
            video_url: videoUrl || null,
          },
        }),
        keepalive: true,
      });
    } catch (error) {
      console.error("battle-share: failed to record share event", {
        source,
        chantId,
        battleId,
        error,
      });
    }
  };

  const handleTikTokShare = async (
    chantId: string,
    category?: string | null,
    shareText?: string,
    shareUrl?: string,
  ) => {
    const safeUrl = shareUrl || `${SITE_URL}/battles/${encodeURIComponent(slug)}`;
    const safeText = shareText || `${homeClub} vs ${awayClub} Chant Battle is live. Vote before kickoff.`;

    try {
      await navigator.clipboard.writeText(`${safeText}\n${safeUrl}`);
      setCopiedChantId(chantId);
      window.setTimeout(() => setCopiedChantId((previous) => (previous === chantId ? null : previous)), 1800);
    } catch (error) {
      console.error("battle-share: failed to copy link for manual share", {
        chantId,
        error,
      });
    }

    const videoUrl = `${SITE_URL}/chants/${encodeURIComponent(chantId)}/video`;
    void recordShare("tiktok", chantId, category, safeUrl, videoUrl);
    window.open("https://www.tiktok.com", "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async (
    chantId: string,
    category?: string | null,
    shareText?: string,
    shareUrl?: string,
  ) => {
    const safeUrl = shareUrl || `${SITE_URL}/battles/${encodeURIComponent(slug)}`;
    const safeText = shareText || `${homeClub} vs ${awayClub} Chant Battle is live. Vote before kickoff.`;

    try {
      await navigator.clipboard.writeText(`${safeText}\n${safeUrl}`);
      setCopiedChantId(chantId);
      window.setTimeout(() => setCopiedChantId((previous) => (previous === chantId ? null : previous)), 1800);
    } catch (error) {
      console.error("battle-share: failed to copy link", error);
    }

    void recordShare("copy_link", chantId, category, safeUrl);
  };

  return (
    <section className="space-y-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Share Chants</p>

      {visibleChants.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
          Share actions will appear once chants are available.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleChants.map((chant) => {
            const shareUrl = toShareUrl(chant.chantId, chant.category);
            const tiktokShareUrl = toTikTokShareUrl(chant.chantId);
            const shareText = buildChantShareText({
              homeClub,
              awayClub,
              battleSlug: slug,
              category: chant.category,
              kickoffAt,
            });
            const tiktokCaption = generateTikTokCaption({
              clubA: homeClub,
              clubB: awayClub,
              chantLyricsLine: firstLyricLine(chant.chantText),
            });
            const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
            const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
            const chantPreview = String(chant.chantText || "").trim();

            return (
              <article key={chant.chantId} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="line-clamp-2 text-sm text-zinc-200">{chantPreview || "Fan Chant"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => {
                      void handleTikTokShare(chant.chantId, chant.category, tiktokCaption, tiktokShareUrl);
                    }}
                  >
                    Share to TikTok
                  </button>
                  <a
                    href={whatsappShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonClass}
                    onClick={() => {
                      void recordShare("whatsapp", chant.chantId, chant.category, shareUrl);
                    }}
                  >
                    Share to WhatsApp
                  </a>
                  <a
                    href={twitterShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonClass}
                    onClick={() => {
                      void recordShare("twitter", chant.chantId, chant.category, shareUrl);
                    }}
                  >
                    Share to X
                  </a>
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => {
                      void handleCopyLink(chant.chantId, chant.category, shareText, shareUrl);
                    }}
                  >
                    Copy link
                  </button>
                </div>
                {copiedChantId === chant.chantId && (
                  <p className="mt-2 text-xs text-emerald-300">Link copied</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
