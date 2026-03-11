type ChantCategory = "praise" | "roast" | "meme" | "player";

interface BuildChantShareTextInput {
  homeClub: string;
  awayClub: string;
  battleSlug: string;
  category: string | null | undefined;
  kickoffAt?: string | null;
}

function normalizeCategory(value: string | null | undefined): ChantCategory {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "praise" || normalized === "roast" || normalized === "meme" || normalized === "player") {
    return normalized;
  }

  return "praise";
}

function toCategoryLabel(category: ChantCategory) {
  if (category === "roast") {
    return "Roast";
  }
  if (category === "meme") {
    return "Meme";
  }
  if (category === "player") {
    return "Player";
  }
  return "Praise";
}

function toUrgencyLine(kickoffAt?: string | null) {
  const kickoffTimestamp = kickoffAt ? new Date(kickoffAt).getTime() : NaN;
  if (Number.isNaN(kickoffTimestamp)) {
    return "Vote before kickoff.";
  }

  const msUntilKickoff = kickoffTimestamp - Date.now();
  if (msUntilKickoff <= 0) {
    return "Matchday is here.";
  }

  const hoursUntilKickoff = Math.floor(msUntilKickoff / (60 * 60 * 1000));

  if (hoursUntilKickoff <= 12) {
    return "Winner reveal is close.";
  }

  if (hoursUntilKickoff <= 24) {
    return "Voting closes soon.";
  }

  if (hoursUntilKickoff <= 48) {
    return "Final push before kickoff.";
  }

  if (hoursUntilKickoff <= 120) {
    return "Voting is live.";
  }

  return "Draft your chant early.";
}

export function buildChantShareText({
  homeClub,
  awayClub,
  battleSlug,
  category,
  kickoffAt,
}: BuildChantShareTextInput) {
  const safeHome = String(homeClub || "Home Club").trim() || "Home Club";
  const safeAway = String(awayClub || "Away Club").trim() || "Away Club";
  const safeSlug = String(battleSlug || "battle").trim().toLowerCase() || "battle";
  const safeCategory = toCategoryLabel(normalizeCategory(category));
  const urgencyLine = toUrgencyLine(kickoffAt);

  return `${safeHome} vs ${safeAway} ${safeCategory} Chant Battle is live. ${urgencyLine} #${safeSlug.replace(/-/g, "")}`;
}
