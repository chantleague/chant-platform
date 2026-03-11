"use client";

import { useState } from "react";
import { trackAnalyticsEvent } from "@/app/lib/analyticsClient";
import { buildChantShareText } from "@/lib/shareText";

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

export default function BattleShare({
  slug,
  homeClub,
  awayClub,
  kickoffAt,
  battleId,
  chants = [],
}: BattleShareProps) {
  const [copiedChantId, setCopiedChantId] = useState<string | null>(null);

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

  const recordShare = async (
    source: "twitter" | "whatsapp" | "tiktok" | "copy_link",
    chantId: string,
    category?: string | null,
    shareUrl?: string,
  ) => {
    trackAnalyticsEvent("chant_share", {
      battle_slug: slug,
      source,
      chant_id: chantId,
      category: category || undefined,
    });

    try {
      await fetch("/api/score-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chant_id: chantId,
          battle_id: battleId,
          event_type: "share",
          source,
          metadata: {
            battle_slug: slug,
            category: category || null,
            share_url: shareUrl || `${SITE_URL}/battles/${encodeURIComponent(slug)}`,
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

    void recordShare("tiktok", chantId, category, safeUrl);
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
            const shareText = buildChantShareText({
              homeClub,
              awayClub,
              battleSlug: slug,
              category: chant.category,
              kickoffAt,
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
                      void handleTikTokShare(chant.chantId, chant.category, shareText, shareUrl);
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
