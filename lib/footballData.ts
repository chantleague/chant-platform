import "server-only";

const FOOTBALL_DATA_BASE_URL = "https://api.football-data.org/v4";

export interface FootballDataFixture {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  competition: string;
  season: string;
}

type FootballDataMatch = {
  id?: number;
  utcDate?: string;
  competition?: {
    name?: string;
  };
  season?: {
    startDate?: string;
    endDate?: string;
  };
  homeTeam?: {
    name?: string;
  };
  awayTeam?: {
    name?: string;
  };
};

function toSafeString(value: unknown) {
  return String(value || "").trim();
}

function toSeasonLabel(startDateRaw?: string, endDateRaw?: string, fallbackKickoff?: string) {
  const startDate = new Date(toSafeString(startDateRaw || fallbackKickoff));
  const endDate = new Date(toSafeString(endDateRaw));

  const startYear = Number.isNaN(startDate.getTime()) ? new Date().getUTCFullYear() : startDate.getUTCFullYear();
  const defaultEndYear = startYear + 1;
  const endYear = Number.isNaN(endDate.getTime()) ? defaultEndYear : endDate.getUTCFullYear();

  return `${startYear}/${endYear}`;
}

export async function fetchPremierLeagueFixtures(): Promise<FootballDataFixture[]> {
  const apiKey = toSafeString(process.env.FOOTBALL_DATA_API_KEY);
  if (!apiKey) {
    return [];
  }

  const requestUrl = `${FOOTBALL_DATA_BASE_URL}/competitions/PL/matches`;
  const response = await fetch(requestUrl, {
    cache: "no-store",
    headers: {
      "X-Auth-Token": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Football Data API request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    competition?: {
      name?: string;
    };
    matches?: FootballDataMatch[];
  };

  const competitionName = toSafeString(payload.competition?.name) || "Premier League";

  return ((payload.matches || []) as FootballDataMatch[])
    .map((match) => {
      const id = String(match.id || "").trim();
      const homeTeam = toSafeString(match.homeTeam?.name);
      const awayTeam = toSafeString(match.awayTeam?.name);
      const kickoffRaw = toSafeString(match.utcDate);
      const kickoffDate = new Date(kickoffRaw);

      if (!id || !homeTeam || !awayTeam || Number.isNaN(kickoffDate.getTime())) {
        return null;
      }

      return {
        fixtureId: `football-data:${id}`,
        homeTeam,
        awayTeam,
        kickoff: kickoffDate.toISOString(),
        competition: competitionName,
        season: toSeasonLabel(match.season?.startDate, match.season?.endDate, kickoffDate.toISOString()),
      } satisfies FootballDataFixture;
    })
    .filter((fixture): fixture is FootballDataFixture => Boolean(fixture));
}
