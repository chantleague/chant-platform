import type { SupabaseClient } from "@supabase/supabase-js";
import { toTeamSlug } from "@/lib/fixtures";

export interface FixtureForBattleGeneration {
  home_team: string | null;
  away_team: string | null;
  competition: string | null;
  kickoff: string | null;
}

export interface BattleGenerationResult {
  processed: number;
  created: number;
  skippedPast: number;
  skippedExisting: number;
}

interface BattleInsertRow {
  slug: string;
  title: string;
  description: string;
  home_team: string;
  away_team: string;
  status: "upcoming";
  starts_at: string;
}

function toDisplayName(value: string) {
  return value
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeCompetition(value: string | null) {
  const normalized = String(value || "").trim();
  return normalized || "Football";
}

export function buildBattleSlug(homeTeam: string, awayTeam: string) {
  const homeSlug = toTeamSlug(homeTeam);
  const awaySlug = toTeamSlug(awayTeam);

  if (!homeSlug || !awaySlug) {
    return "";
  }

  return `${homeSlug}-vs-${awaySlug}`;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function generateBattlesFromFixtures(
  supabase: SupabaseClient,
  fixtures: FixtureForBattleGeneration[],
): Promise<BattleGenerationResult> {
  const now = Date.now();
  const candidates: BattleInsertRow[] = [];

  let skippedPast = 0;

  for (const fixture of fixtures) {
    const homeTeam = String(fixture.home_team || "").trim();
    const awayTeam = String(fixture.away_team || "").trim();
    const kickoffRaw = String(fixture.kickoff || "").trim();
    const kickoffDate = new Date(kickoffRaw);

    if (!homeTeam || !awayTeam || Number.isNaN(kickoffDate.getTime())) {
      continue;
    }

    if (kickoffDate.getTime() <= now) {
      skippedPast += 1;
      continue;
    }

    const battleSlug = buildBattleSlug(homeTeam, awayTeam);
    if (!battleSlug) {
      continue;
    }

    candidates.push({
      slug: battleSlug,
      title: `${toDisplayName(homeTeam)} vs ${toDisplayName(awayTeam)} Chant Battle`,
      description: `${normalizeCompetition(fixture.competition)} fixture`,
      home_team: toTeamSlug(homeTeam),
      away_team: toTeamSlug(awayTeam),
      status: "upcoming",
      starts_at: kickoffDate.toISOString(),
    });
  }

  if (candidates.length === 0) {
    return {
      processed: fixtures.length,
      created: 0,
      skippedPast,
      skippedExisting: 0,
    };
  }

  const uniqueCandidates = new Map<string, BattleInsertRow>();
  for (const candidate of candidates) {
    if (!uniqueCandidates.has(candidate.slug)) {
      uniqueCandidates.set(candidate.slug, candidate);
    }
  }

  const candidateRows = [...uniqueCandidates.values()];
  const candidateSlugs = candidateRows.map((candidate) => candidate.slug);
  const existingSlugs = new Set<string>();

  for (const slugChunk of chunk(candidateSlugs, 100)) {
    const { data: existingRows, error: existingError } = await supabase
      .from("matches")
      .select("slug")
      .in("slug", slugChunk);

    if (existingError) {
      throw new Error(`Could not check existing battles: ${existingError.message}`);
    }

    (((existingRows as Array<{ slug?: string }> | null) || [])).forEach((row) => {
      const slug = String(row.slug || "").trim();
      if (slug) {
        existingSlugs.add(slug);
      }
    });
  }

  const rowsToInsert = candidateRows.filter((candidate) => !existingSlugs.has(candidate.slug));
  let skippedExisting = candidateRows.length - rowsToInsert.length;

  if (rowsToInsert.length === 0) {
    return {
      processed: fixtures.length,
      created: 0,
      skippedPast,
      skippedExisting,
    };
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("matches")
    .upsert(rowsToInsert, {
      onConflict: "slug",
      ignoreDuplicates: true,
    })
    .select("slug");

  if (insertError) {
    throw new Error(`Could not generate battles: ${insertError.message}`);
  }

  const created = (((insertedRows as Array<{ slug?: string }> | null) || [])).length;
  skippedExisting += rowsToInsert.length - created;

  return {
    processed: fixtures.length,
    created,
    skippedPast,
    skippedExisting,
  };
}
