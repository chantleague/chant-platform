import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPremierLeagueFixtures } from "@/lib/footballData";

const THESPORTSDB_BASE_URL = "https://www.thesportsdb.com/api/v1/json";
const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";

export interface ExternalFixture {
  fixtureId: string;
  fixtureApiId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoff: string;
  season: string;
  provider: "football-data" | "thesportsdb" | "api-football";
}

export interface StoredFixture {
  id: string;
  fixture_id: string | null;
  fixture_api_id: string | null;
  home_team: string | null;
  away_team: string | null;
  competition: string | null;
  kickoff: string | null;
  season: string | null;
}

export interface UpsertFixturesResult {
  processed: number;
  upserted: number;
  skipped: number;
  clubsInserted: number;
  clubsActivated: number;
  clubsInactivated: number;
  rows: StoredFixture[];
}

type ClubRow = {
  id: string;
  slug: string;
  name: string;
  is_active?: boolean | null;
};

type ClubLookup = {
  byNormalizedName: Map<string, ClubRow>;
  bySlug: Map<string, ClubRow>;
};

type TheSportsDbEvent = {
  idEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  strLeague?: string;
  strLeagueAlternate?: string;
  strSeason?: string;
  strTimestamp?: string;
  dateEvent?: string;
  strTime?: string;
};

function isMissingColumnError(errorMessage: string, columnName: string) {
  if (!errorMessage) {
    return false;
  }

  const escapedColumn = columnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(column .*${escapedColumn}.* does not exist|Could not find the '${escapedColumn}' column)`, "i").test(
    errorMessage,
  );
}

function toSafeString(value: unknown) {
  return String(value || "").trim();
}

function normalizeTeamName(value: string) {
  return value
    .toLowerCase()
    .replace(/[&]/g, " and ")
    .replace(/\b(fc|cf|afc|sc|the)\b/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toTeamSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[&]/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function getSeasonLabel(kickoffIso?: string) {
  const kickoffDate = kickoffIso ? new Date(kickoffIso) : new Date();
  const validDate = Number.isNaN(kickoffDate.getTime()) ? new Date() : kickoffDate;
  const year = validDate.getUTCMonth() >= 6 ? validDate.getUTCFullYear() : validDate.getUTCFullYear() - 1;
  return `${year}/${year + 1}`;
}

function parseKickoff(event: TheSportsDbEvent): string | null {
  const strTimestamp = toSafeString(event.strTimestamp);
  if (strTimestamp) {
    const parsed = new Date(strTimestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  const dateEvent = toSafeString(event.dateEvent);
  const strTime = toSafeString(event.strTime);
  if (!dateEvent) {
    return null;
  }

  const fallbackTimestamp = strTime
    ? new Date(`${dateEvent}T${strTime.endsWith("Z") ? strTime : `${strTime}Z`}`)
    : new Date(`${dateEvent}T00:00:00Z`);

  if (Number.isNaN(fallbackTimestamp.getTime())) {
    return null;
  }

  return fallbackTimestamp.toISOString();
}

async function fetchFromTheSportsDb(): Promise<ExternalFixture[]> {
  const apiKey = toSafeString(process.env.THESPORTSDB_API_KEY) || "3";
  const leagueIds = (toSafeString(process.env.THESPORTSDB_LEAGUE_IDS) || "4328")
    .split(",")
    .map((leagueId) => leagueId.trim())
    .filter(Boolean);

  const responses = await Promise.all(
    leagueIds.map(async (leagueId) => {
      const url = `${THESPORTSDB_BASE_URL}/${encodeURIComponent(apiKey)}/eventsnextleague.php?id=${encodeURIComponent(leagueId)}`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`TheSportsDB request failed for league ${leagueId}: ${response.status}`);
      }

      const payload = (await response.json()) as { events?: TheSportsDbEvent[] };
      return payload.events || [];
    }),
  );

  const fixtures: ExternalFixture[] = [];

  for (const event of responses.flat()) {
    const fixtureId = toSafeString(event.idEvent);
    const homeTeam = toSafeString(event.strHomeTeam);
    const awayTeam = toSafeString(event.strAwayTeam);
    const competition = toSafeString(event.strLeague || event.strLeagueAlternate) || "Football";
    const kickoff = parseKickoff(event);
    const season = toSafeString(event.strSeason) || getSeasonLabel(kickoff || undefined);

    if (!fixtureId || !homeTeam || !awayTeam || !kickoff) {
      continue;
    }

    fixtures.push({
      fixtureId: `sportsdb:${fixtureId}`,
      fixtureApiId: `sportsdb:${fixtureId}`,
      homeTeam,
      awayTeam,
      competition,
      kickoff,
      season,
      provider: "thesportsdb",
    });
  }

  return fixtures;
}

async function fetchFromApiFootball(): Promise<ExternalFixture[]> {
  const apiKey = toSafeString(process.env.API_FOOTBALL_KEY);
  if (!apiKey) {
    return [];
  }

  const baseUrl = toSafeString(process.env.API_FOOTBALL_BASE_URL) || API_FOOTBALL_BASE_URL;
  const leagueIds = (toSafeString(process.env.API_FOOTBALL_LEAGUE_IDS) || "39")
    .split(",")
    .map((leagueId) => leagueId.trim())
    .filter(Boolean);
  const requestedFixtureCount = Number.parseInt(toSafeString(process.env.API_FOOTBALL_NEXT_COUNT) || "20", 10);
  const nextCount = Number.isNaN(requestedFixtureCount) ? 20 : Math.max(1, requestedFixtureCount);

  const now = new Date();
  const currentSeason = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;

  const responses = await Promise.all(
    leagueIds.map(async (leagueId) => {
      const season = toSafeString(process.env.API_FOOTBALL_SEASON) || String(currentSeason);
      const query = new URLSearchParams({ next: String(nextCount), league: leagueId, season });
      const response = await fetch(`${baseUrl}/fixtures?${query.toString()}`, {
        cache: "no-store",
        headers: {
          "x-apisports-key": apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`API-Football request failed for league ${leagueId}: ${response.status}`);
      }

      const payload = (await response.json()) as {
        response?: Array<{
          fixture?: { id?: number; date?: string };
          league?: { name?: string; season?: number | string };
          teams?: { home?: { name?: string }; away?: { name?: string } };
        }>;
      };

      return payload.response || [];
    }),
  );

  const fixtures: ExternalFixture[] = [];

  for (const item of responses.flat()) {
    const fixtureId = String(item.fixture?.id || "").trim();
    const homeTeam = toSafeString(item.teams?.home?.name);
    const awayTeam = toSafeString(item.teams?.away?.name);
    const competition = toSafeString(item.league?.name) || "Football";
    const kickoffValue = toSafeString(item.fixture?.date);
    const kickoffDate = new Date(kickoffValue);

    if (!fixtureId || !homeTeam || !awayTeam || Number.isNaN(kickoffDate.getTime())) {
      continue;
    }

    const seasonRaw = toSafeString(item.league?.season);

    fixtures.push({
      fixtureId: `apifootball:${fixtureId}`,
      fixtureApiId: `apifootball:${fixtureId}`,
      homeTeam,
      awayTeam,
      competition,
      kickoff: kickoffDate.toISOString(),
      season: seasonRaw || getSeasonLabel(kickoffDate.toISOString()),
      provider: "api-football",
    });
  }

  return fixtures;
}

async function fetchFromFootballData(): Promise<ExternalFixture[]> {
  const fixtures = await fetchPremierLeagueFixtures();
  return fixtures.map((fixture) => ({
    fixtureId: fixture.fixtureId,
    fixtureApiId: fixture.fixtureId,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    competition: fixture.competition,
    kickoff: fixture.kickoff,
    season: fixture.season,
    provider: "football-data",
  }));
}

function dedupeFixtures(fixtures: ExternalFixture[]) {
  const deduped = new Map<string, ExternalFixture>();
  for (const fixture of fixtures) {
    const dedupeKey = toSafeString(fixture.fixtureId || fixture.fixtureApiId);
    if (!dedupeKey) {
      continue;
    }

    if (!deduped.has(dedupeKey)) {
      deduped.set(dedupeKey, fixture);
    }
  }

  return [...deduped.values()].sort(
    (left, right) => new Date(left.kickoff).getTime() - new Date(right.kickoff).getTime(),
  );
}

export async function fetchFixtures(): Promise<ExternalFixture[]> {
  const preferredProvider = toSafeString(process.env.FIXTURES_PROVIDER).toLowerCase();
  const providers =
    preferredProvider === "api-football"
      ? [fetchFromApiFootball, fetchFromFootballData, fetchFromTheSportsDb]
      : preferredProvider === "thesportsdb"
        ? [fetchFromTheSportsDb, fetchFromFootballData, fetchFromApiFootball]
        : preferredProvider === "football-data"
          ? [fetchFromFootballData, fetchFromTheSportsDb, fetchFromApiFootball]
          : [fetchFromFootballData, fetchFromTheSportsDb, fetchFromApiFootball];

  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const fixtures = await provider();
      if (fixtures.length > 0) {
        return dedupeFixtures(fixtures);
      }
    } catch (error) {
      errors.push(String(error));
    }
  }

  if (errors.length > 0) {
    throw new Error(`Unable to fetch fixtures from providers: ${errors.join(" | ")}`);
  }

  return [];
}

function toClubLookup(clubs: ClubRow[]): ClubLookup {
  const byNormalizedName = new Map<string, ClubRow>();
  const bySlug = new Map<string, ClubRow>();

  for (const club of clubs) {
    const slug = toSafeString(club.slug);
    if (slug) {
      bySlug.set(slug, club);
    }

    const clubName = toSafeString(club.name);
    const normalizedName = normalizeTeamName(clubName);
    if (normalizedName) {
      byNormalizedName.set(normalizedName, club);
    }

    const slugAsName = normalizeTeamName(club.slug.replace(/-/g, " "));
    if (slugAsName) {
      byNormalizedName.set(slugAsName, club);
    }
  }

  return { byNormalizedName, bySlug };
}

function resolveClub(teamName: string, lookup: ClubLookup) {
  const normalized = normalizeTeamName(teamName);
  if (!normalized) {
    return null;
  }

  return lookup.byNormalizedName.get(normalized) || null;
}

function getDominantSeason(fixtures: ExternalFixture[]) {
  const seasonCounts = new Map<string, number>();

  fixtures.forEach((fixture) => {
    const season = toSafeString(fixture.season);
    if (!season) {
      return;
    }

    seasonCounts.set(season, (seasonCounts.get(season) || 0) + 1);
  });

  let dominantSeason: string | null = null;
  let maxCount = 0;

  seasonCounts.forEach((count, season) => {
    if (count > maxCount) {
      dominantSeason = season;
      maxCount = count;
    }
  });

  return dominantSeason;
}

async function loadClubsForSync(supabase: SupabaseClient) {
  const primaryQuery = await supabase.from("clubs").select("id, slug, name, is_active");

  let hasIsActiveColumn = true;
  let rows = (primaryQuery.data as Array<Record<string, unknown>> | null) || [];
  let error = primaryQuery.error;

  if (error && isMissingColumnError(error.message || "", "is_active")) {
    hasIsActiveColumn = false;
    const fallbackQuery = await supabase.from("clubs").select("id, slug, name");
    rows = (fallbackQuery.data as Array<Record<string, unknown>> | null) || [];
    error = fallbackQuery.error;
  }

  if (error) {
    throw new Error(`Could not load clubs for fixture sync: ${error.message}`);
  }

  const clubs: ClubRow[] = [];

  rows.forEach((row) => {
    const id = toSafeString(row.id);
    const slug = toSafeString(row.slug);
    const name = toSafeString(row.name);

    if (!id || !slug || !name) {
      return;
    }

    clubs.push({
      id,
      slug,
      name,
      is_active: typeof row.is_active === "boolean" ? row.is_active : null,
    });
  });

  return {
    clubs,
    hasIsActiveColumn,
  };
}

async function ensureClubsFromFixtures(supabase: SupabaseClient, fixtures: ExternalFixture[]) {
  if (fixtures.length === 0) {
    const { clubs } = await loadClubsForSync(supabase);
    return {
      clubLookup: toClubLookup(clubs),
      clubsInserted: 0,
      clubsActivated: 0,
      clubsInactivated: 0,
    };
  }

  const teamBySlug = new Map<string, string>();

  fixtures.forEach((fixture) => {
    const homeTeamName = toSafeString(fixture.homeTeam);
    const awayTeamName = toSafeString(fixture.awayTeam);
    const homeSlug = toTeamSlug(homeTeamName);
    const awaySlug = toTeamSlug(awayTeamName);

    if (homeSlug && homeTeamName && !teamBySlug.has(homeSlug)) {
      teamBySlug.set(homeSlug, homeTeamName);
    }

    if (awaySlug && awayTeamName && !teamBySlug.has(awaySlug)) {
      teamBySlug.set(awaySlug, awayTeamName);
    }
  });

  const initialClubState = await loadClubsForSync(supabase);
  let hasIsActiveColumn = initialClubState.hasIsActiveColumn;
  const existingLookup = toClubLookup(initialClubState.clubs);

  const missingTeamRows = [...teamBySlug.entries()]
    .filter(([slug]) => !existingLookup.bySlug.has(slug))
    .map(([slug, name]) => ({ slug, name }));

  let clubsInserted = 0;

  if (missingTeamRows.length > 0) {
    const payloadWithActive = missingTeamRows.map((team) => ({
      slug: team.slug,
      name: team.name,
      fans: 0,
      is_active: true,
    }));

    let insertError: { message?: string } | null = null;

    if (hasIsActiveColumn) {
      const insertResult = await supabase
        .from("clubs")
        .upsert(payloadWithActive, { onConflict: "slug", ignoreDuplicates: true });

      insertError = insertResult.error;

      if (insertError && isMissingColumnError(insertError.message || "", "is_active")) {
        hasIsActiveColumn = false;
      }
    }

    if (!hasIsActiveColumn) {
      const payload = missingTeamRows.map((team) => ({
        slug: team.slug,
        name: team.name,
        fans: 0,
      }));

      const insertResult = await supabase
        .from("clubs")
        .upsert(payload, { onConflict: "slug", ignoreDuplicates: true });

      insertError = insertResult.error;
    }

    if (insertError) {
      throw new Error(`Could not auto-insert clubs: ${insertError.message || "unknown error"}`);
    }

    clubsInserted = missingTeamRows.length;
  }

  const refreshedClubState = await loadClubsForSync(supabase);
  const clubLookup = toClubLookup(refreshedClubState.clubs);

  if (!refreshedClubState.hasIsActiveColumn) {
    return {
      clubLookup,
      clubsInserted,
      clubsActivated: 0,
      clubsInactivated: 0,
    };
  }

  const dominantSeason = getDominantSeason(fixtures);
  const seasonFixtures = dominantSeason
    ? fixtures.filter((fixture) => toSafeString(fixture.season) === dominantSeason)
    : fixtures;

  const activeSlugs = new Set<string>();
  seasonFixtures.forEach((fixture) => {
    const homeSlug = toTeamSlug(toSafeString(fixture.homeTeam));
    const awaySlug = toTeamSlug(toSafeString(fixture.awayTeam));

    if (homeSlug) {
      activeSlugs.add(homeSlug);
    }

    if (awaySlug) {
      activeSlugs.add(awaySlug);
    }
  });

  if (activeSlugs.size === 0) {
    return {
      clubLookup,
      clubsInserted,
      clubsActivated: 0,
      clubsInactivated: 0,
    };
  }

  const idsToActivate: string[] = [];
  const idsToInactivate: string[] = [];

  refreshedClubState.clubs.forEach((club) => {
    const shouldBeActive = activeSlugs.has(club.slug);
    const currentlyActive = club.is_active !== false;

    if (shouldBeActive && !currentlyActive) {
      idsToActivate.push(club.id);
    }

    if (!shouldBeActive && currentlyActive) {
      idsToInactivate.push(club.id);
    }
  });

  if (idsToActivate.length > 0) {
    const activateResult = await supabase
      .from("clubs")
      .update({ is_active: true })
      .in("id", idsToActivate);

    if (activateResult.error) {
      throw new Error(`Could not activate clubs: ${activateResult.error.message}`);
    }
  }

  if (idsToInactivate.length > 0) {
    const inactivateResult = await supabase
      .from("clubs")
      .update({ is_active: false })
      .in("id", idsToInactivate);

    if (inactivateResult.error) {
      throw new Error(`Could not inactivate clubs: ${inactivateResult.error.message}`);
    }
  }

  return {
    clubLookup,
    clubsInserted,
    clubsActivated: idsToActivate.length,
    clubsInactivated: idsToInactivate.length,
  };
}

export async function upsertFixtures(
  supabase: SupabaseClient,
  fixtures: ExternalFixture[],
): Promise<UpsertFixturesResult> {
  if (fixtures.length === 0) {
    return {
      processed: 0,
      upserted: 0,
      skipped: 0,
      clubsInserted: 0,
      clubsActivated: 0,
      clubsInactivated: 0,
      rows: [],
    };
  }

  const {
    clubLookup,
    clubsInserted,
    clubsActivated,
    clubsInactivated,
  } = await ensureClubsFromFixtures(supabase, fixtures);

  const rows: Array<Record<string, string | null>> = [];
  let skipped = 0;

  for (const fixture of fixtures) {
    const fixtureId = toSafeString(fixture.fixtureId || fixture.fixtureApiId);
    const fixtureApiId = toSafeString(fixture.fixtureApiId || fixtureId);
    const homeTeamRaw = toSafeString(fixture.homeTeam);
    const awayTeamRaw = toSafeString(fixture.awayTeam);
    const competition = toSafeString(fixture.competition) || "Football";
    const kickoffDate = new Date(toSafeString(fixture.kickoff));

    if (!fixtureId || !homeTeamRaw || !awayTeamRaw || Number.isNaN(kickoffDate.getTime())) {
      skipped += 1;
      continue;
    }

    const homeTeamSlug = toTeamSlug(homeTeamRaw);
    const awayTeamSlug = toTeamSlug(awayTeamRaw);

    const homeClub =
      clubLookup.bySlug.get(homeTeamSlug) ||
      resolveClub(homeTeamRaw, clubLookup);
    const awayClub =
      clubLookup.bySlug.get(awayTeamSlug) ||
      resolveClub(awayTeamRaw, clubLookup);

    const homeTeam = homeClub?.slug || homeTeamSlug;
    const awayTeam = awayClub?.slug || awayTeamSlug;

    if (!homeTeam || !awayTeam || homeTeam === awayTeam) {
      skipped += 1;
      continue;
    }

    rows.push({
      fixture_id: fixtureId,
      fixture_api_id: fixtureApiId,
      home_team: homeTeam,
      away_team: awayTeam,
      competition,
      kickoff: kickoffDate.toISOString(),
      season: toSafeString(fixture.season) || getSeasonLabel(kickoffDate.toISOString()),
      home_club_id: homeClub?.id || null,
      away_club_id: awayClub?.id || null,
      match_date: kickoffDate.toISOString(),
      league: competition,
    });
  }

  if (rows.length === 0) {
    return {
      processed: fixtures.length,
      upserted: 0,
      skipped,
      clubsInserted,
      clubsActivated,
      clubsInactivated,
      rows: [],
    };
  }

  let data: Array<Record<string, unknown>> | null = null;
  let error: { message?: string } | null = null;

  const upsertByFixtureId = await supabase
    .from("fixtures")
    .upsert(rows, { onConflict: "fixture_id" })
    .select("id, fixture_id, fixture_api_id, home_team, away_team, competition, kickoff, season");

  data = (upsertByFixtureId.data as Array<Record<string, unknown>> | null) || null;
  error = upsertByFixtureId.error;

  if (error && isMissingColumnError(error.message || "", "fixture_id")) {
    const fallbackRows = rows.map((row) => {
      const legacyRow = { ...row };
      delete legacyRow.fixture_id;
      return legacyRow;
    });

    const fallbackUpsert = await supabase
      .from("fixtures")
      .upsert(fallbackRows, { onConflict: "fixture_api_id" })
      .select("id, fixture_api_id, home_team, away_team, competition, kickoff, season");

    data = (fallbackUpsert.data as Array<Record<string, unknown>> | null) || null;
    error = fallbackUpsert.error;
  }

  if (error) {
    throw new Error(`Could not upsert fixtures: ${error.message}`);
  }

  return {
    processed: fixtures.length,
    upserted: (data || []).length,
    skipped,
    clubsInserted,
    clubsActivated,
    clubsInactivated,
    rows: ((data as StoredFixture[] | null) || []).map((row) => ({
      ...row,
      fixture_id: row.fixture_id || row.fixture_api_id || null,
    })),
  };
}
