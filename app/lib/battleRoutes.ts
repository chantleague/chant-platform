import { slugify } from "@/app/lib/canonicalClubRegistry";

interface DeriveBattleRouteSlugInput {
  slug?: unknown;
  homeTeam?: unknown;
  awayTeam?: unknown;
}

export function normalizeBattleSlug(value?: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function stripBattleDateSuffix(slug: string): string {
  return normalizeBattleSlug(slug).replace(/-\d{4}-\d{2}-\d{2}$/, "");
}

export function buildBattleSlugFromTeams(homeTeam?: unknown, awayTeam?: unknown): string {
  const homeSlug = slugify(String(homeTeam || "").trim());
  const awaySlug = slugify(String(awayTeam || "").trim());

  if (!homeSlug || !awaySlug) {
    return "";
  }

  return `${homeSlug}-vs-${awaySlug}`;
}

export function deriveBattleRouteSlug(input: DeriveBattleRouteSlugInput): string {
  const preferredSlug = normalizeBattleSlug(input.slug);
  if (preferredSlug) {
    return preferredSlug;
  }

  return buildBattleSlugFromTeams(input.homeTeam, input.awayTeam);
}

export function parseBattleSlugTeams(slug: string): { homeTeam: string; awayTeam: string } | null {
  const normalized = normalizeBattleSlug(slug);
  if (!normalized.includes("-vs-")) {
    return null;
  }

  const [homePart, awayPartRaw] = normalized.split("-vs-");
  const homeTeam = normalizeBattleSlug(homePart);
  const awayTeam = normalizeBattleSlug(awayPartRaw).replace(/-\d{4}-\d{2}-\d{2}$/, "");

  if (!homeTeam || !awayTeam) {
    return null;
  }

  return { homeTeam, awayTeam };
}

export function getBattleSlugLookupCandidates(slug: string): string[] {
  const normalized = normalizeBattleSlug(slug);
  if (!normalized) {
    return [];
  }

  const candidates = new Set<string>();
  candidates.add(normalized);

  const withoutDate = stripBattleDateSuffix(normalized);
  if (withoutDate) {
    candidates.add(withoutDate);
  }

  const teams = parseBattleSlugTeams(normalized);
  if (teams) {
    const canonical = buildBattleSlugFromTeams(teams.homeTeam, teams.awayTeam);
    if (canonical) {
      candidates.add(canonical);
    }
  }

  return [...candidates].filter((candidate) => Boolean(candidate));
}
