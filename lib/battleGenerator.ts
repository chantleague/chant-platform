import type { SupabaseClient } from "@supabase/supabase-js";
import { toTeamSlug } from "@/lib/fixtures";
import { getBattleLifecycle } from "@/lib/battleLifecycle";

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

interface BattleCandidateRow extends BattleInsertRow {
  kickoff_at: string;
  battle_opens_at: string;
  submission_opens_at: string;
  voting_opens_at: string;
  submission_closes_at: string;
  voting_closes_at: string;
  winner_reveal_at: string;
}

function extractMissingTableColumn(errorMessage: string, tableName: string): string | null {
  const escapedTableName = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const schemaCachePattern = new RegExp(
    `Could not find the '([^']+)' column of '${escapedTableName}' in the schema cache`,
    "i",
  );
  const schemaCacheMatch = errorMessage.match(schemaCachePattern);
  if (schemaCacheMatch?.[1]) {
    return schemaCacheMatch[1];
  }

  const directPattern = /column\s+(?:\w+\.)?"?([a-zA-Z0-9_]+)"?\s+does not exist/i;
  const directMatch = errorMessage.match(directPattern);
  if (directMatch?.[1]) {
    return directMatch[1];
  }

  return null;
}

async function updateBattleTimingBySlug(
  supabase: SupabaseClient,
  row: BattleCandidateRow,
) {
  const seedPayload: Record<string, string> = {
    starts_at: row.starts_at,
    kickoff: row.kickoff_at,
    kickoff_at: row.kickoff_at,
    battle_opens_at: row.battle_opens_at,
    submission_opens_at: row.submission_opens_at,
    voting_opens_at: row.voting_opens_at,
    submission_closes_at: row.submission_closes_at,
    voting_closes_at: row.voting_closes_at,
    winner_reveal_at: row.winner_reveal_at,
  };

  const disabledColumns = new Set<string>();

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const payload = Object.fromEntries(
      Object.entries(seedPayload).filter(([column]) => !disabledColumns.has(column)),
    );

    if (Object.keys(payload).length === 0) {
      return;
    }

    const updateResult = await supabase
      .from("matches")
      .update(payload)
      .eq("slug", row.slug);

    if (!updateResult.error) {
      return;
    }

    const errorMessage = updateResult.error.message || "";
    const missingColumn = extractMissingTableColumn(errorMessage, "matches");

    if (missingColumn) {
      disabledColumns.add(missingColumn);
      continue;
    }

    throw new Error(`Could not update battle timing for ${row.slug}: ${errorMessage}`);
  }

  throw new Error(`Could not update battle timing for ${row.slug}: no compatible columns available`);
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
  const candidates: BattleCandidateRow[] = [];

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

    const kickoffIso = kickoffDate.toISOString();
    const lifecycle = getBattleLifecycle(kickoffIso);
    if (
      !lifecycle.kickoff_at ||
      !lifecycle.battle_opens_at ||
      !lifecycle.submission_opens_at ||
      !lifecycle.voting_opens_at ||
      !lifecycle.submission_closes_at ||
      !lifecycle.voting_closes_at ||
      !lifecycle.winner_reveal_at
    ) {
      continue;
    }

    candidates.push({
      slug: battleSlug,
      title: `${toDisplayName(homeTeam)} vs ${toDisplayName(awayTeam)} Chant Battle`,
      description: `${normalizeCompetition(fixture.competition)} fixture`,
      home_team: toTeamSlug(homeTeam),
      away_team: toTeamSlug(awayTeam),
      status: "upcoming",
      starts_at: kickoffIso,
      kickoff_at: lifecycle.kickoff_at,
      battle_opens_at: lifecycle.battle_opens_at,
      submission_opens_at: lifecycle.submission_opens_at,
      voting_opens_at: lifecycle.voting_opens_at,
      submission_closes_at: lifecycle.submission_closes_at,
      voting_closes_at: lifecycle.voting_closes_at,
      winner_reveal_at: lifecycle.winner_reveal_at,
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

  const timingBySlug = new Map<string, BattleCandidateRow>();

  const uniqueCandidates = new Map<string, BattleInsertRow>();
  for (const candidate of candidates) {
    timingBySlug.set(candidate.slug, candidate);

    if (!uniqueCandidates.has(candidate.slug)) {
      uniqueCandidates.set(candidate.slug, {
        slug: candidate.slug,
        title: candidate.title,
        description: candidate.description,
        home_team: candidate.home_team,
        away_team: candidate.away_team,
        status: candidate.status,
        starts_at: candidate.starts_at,
      });
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

  for (const slug of candidateSlugs) {
    const timingRow = timingBySlug.get(slug);
    if (!timingRow) {
      continue;
    }

    await updateBattleTimingBySlug(supabase, timingRow);
  }

  return {
    processed: fixtures.length,
    created,
    skippedPast,
    skippedExisting,
  };
}
