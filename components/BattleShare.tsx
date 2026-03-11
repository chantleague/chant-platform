"use client";

import { useState } from "react";

interface BattleShareProps {
  slug: string;
  homeClub: string;
  awayClub: string;
}

const SITE_URL = "https://chantleague.com";

export default function BattleShare({ slug, homeClub, awayClub }: BattleShareProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${SITE_URL}/battles/${encodeURIComponent(slug)}`;
  const shareText = `${homeClub} vs ${awayClub} Chant Battle \u26BD\nVote for the best chant before kickoff.`;

  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;

  const buttonClass =
    "rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-neutral-700";

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
        <a href={twitterShareUrl} target="_blank" rel="noreferrer" className={buttonClass}>
          Twitter/X
        </a>
        <a href={whatsappShareUrl} target="_blank" rel="noreferrer" className={buttonClass}>
          WhatsApp
        </a>
        <a href={facebookShareUrl} target="_blank" rel="noreferrer" className={buttonClass}>
          Facebook
        </a>
        <button type="button" className={buttonClass} onClick={handleCopyLink}>
          Copy Link
        </button>
      </div>
      {copied && <p className="text-xs text-emerald-300">Link copied</p>}
    </section>
  );
}
