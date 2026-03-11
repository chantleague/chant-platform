"use client";

import { useState } from "react";
import { trackAnalyticsEvent } from "@/app/lib/analyticsClient";

interface BattleShareProps {
  slug: string;
  homeClub: string;
  awayClub: string;
  battleId?: string;
  chantId?: string;
}

const SITE_URL = "https://chantleague.com";

export default function BattleShare({
  slug,
  homeClub,
  awayClub,
  battleId,
  chantId,
}: BattleShareProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${SITE_URL}/battles/${encodeURIComponent(slug)}`;
  const shareText = `${homeClub} vs ${awayClub} Chant Battle \u26BD\nVote for the best chant before kickoff.`;

  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
  const tiktokShareUrl = "https://www.tiktok.com";
  const instagramShareUrl = "https://www.instagram.com";

  const buttonClass =
    "rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-neutral-700";

  const recordShare = async (source: "twitter" | "whatsapp" | "tiktok" | "instagram") => {
    trackAnalyticsEvent("chant_share", {
      battle_slug: slug,
      source,
      chant_id: chantId,
    });

    if (!chantId) {
      return;
    }

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
            share_url: shareUrl,
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

  const handleManualShare = async (
    source: "tiktok" | "instagram",
    targetUrl: string,
  ) => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("battle-share: failed to copy link for manual share", {
        source,
        error,
      });
    }

    void recordShare(source);
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("battle-share: failed to copy link", error);
    }
  };

  return (
    <section className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Share Battle</p>
      <div className="flex flex-wrap gap-3">
        <a
          href={twitterShareUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonClass}
          onClick={() => {
            void recordShare("twitter");
          }}
        >
          Twitter/X
        </a>
        <a
          href={whatsappShareUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonClass}
          onClick={() => {
            void recordShare("whatsapp");
          }}
        >
          WhatsApp
        </a>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            void handleManualShare("tiktok", tiktokShareUrl);
          }}
        >
          TikTok
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            void handleManualShare("instagram", instagramShareUrl);
          }}
        >
          Instagram
        </button>
        <button type="button" className={buttonClass} onClick={handleCopyLink}>
          Copy Link
        </button>
      </div>
      {copied && <p className="text-xs text-emerald-300">Link copied</p>}
    </section>
  );
}
