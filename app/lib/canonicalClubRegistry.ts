/**
 * Canonical Club Registry
 * 
 * This is the single source of truth for all clubs supported by the platform.
 * Each club has:
 * - slug: stable identifier (never changes, even if club name changes)
 * - displayName: the official name shown to users
 * - league: current league (PL, Championship, etc.)
 * 
 * Future enhancements will support:
 * - Promotion/relegation without breaking URLs
 * - Cup opponents and tournament participants
 * - Historical data
 */

export const enum League {
  PREMIER_LEAGUE = "PL",
  CHAMPIONSHIP = "EFL_CHAMPIONSHIP",
  INTERNATIONAL = "INTL", // for national teams
  EUROPEAN = "EUR", // for European club teams not in UK
}

export interface CanonicalClub {
  slug: string; // stable, immutable identifier
  displayName: string; // official club name
  league: League;
  badges?: {
    imageUrl?: string;
  };
}

/**
 * Canonical registry of all clubs.
 * Sorted alphabetically by displayName within each league.
 */

const PREMIER_LEAGUE_CLUBS: CanonicalClub[] = [
  { slug: "arsenal", displayName: "Arsenal FC", league: League.PREMIER_LEAGUE },
  { slug: "aston-villa", displayName: "Aston Villa", league: League.PREMIER_LEAGUE },
  { slug: "bournemouth", displayName: "AFC Bournemouth", league: League.PREMIER_LEAGUE },
  { slug: "brentford", displayName: "Brentford FC", league: League.PREMIER_LEAGUE },
  { slug: "brighton", displayName: "Brighton & Hove Albion", league: League.PREMIER_LEAGUE },
  { slug: "burnley", displayName: "Burnley FC", league: League.PREMIER_LEAGUE },
  { slug: "chelsea", displayName: "Chelsea FC", league: League.PREMIER_LEAGUE },
  { slug: "crystal-palace", displayName: "Crystal Palace", league: League.PREMIER_LEAGUE },
  { slug: "everton", displayName: "Everton FC", league: League.PREMIER_LEAGUE },
  { slug: "fulham", displayName: "Fulham FC", league: League.PREMIER_LEAGUE },
  { slug: "leeds", displayName: "Leeds United", league: League.PREMIER_LEAGUE },
  { slug: "liverpool", displayName: "Liverpool FC", league: League.PREMIER_LEAGUE },
  { slug: "man-city", displayName: "Manchester City", league: League.PREMIER_LEAGUE },
  { slug: "man-utd", displayName: "Manchester United", league: League.PREMIER_LEAGUE },
  { slug: "newcastle", displayName: "Newcastle United", league: League.PREMIER_LEAGUE },
  { slug: "nottm-forest", displayName: "Nottingham Forest", league: League.PREMIER_LEAGUE },
  { slug: "southampton", displayName: "Southampton FC", league: League.PREMIER_LEAGUE },
  { slug: "spurs", displayName: "Tottenham Hotspur", league: League.PREMIER_LEAGUE },
  { slug: "west-ham", displayName: "West Ham United", league: League.PREMIER_LEAGUE },
  { slug: "wolves", displayName: "Wolverhampton Wanderers", league: League.PREMIER_LEAGUE },
];

const CHAMPIONSHIP_CLUBS: CanonicalClub[] = [
  { slug: "birmingham", displayName: "Birmingham City", league: League.CHAMPIONSHIP },
  { slug: "blackburn", displayName: "Blackburn Rovers", league: League.CHAMPIONSHIP },
  { slug: "bristol-city", displayName: "Bristol City", league: League.CHAMPIONSHIP },
  { slug: "charlton", displayName: "Charlton Athletic", league: League.CHAMPIONSHIP },
  { slug: "coventry", displayName: "Coventry City", league: League.CHAMPIONSHIP },
  { slug: "derby", displayName: "Derby County", league: League.CHAMPIONSHIP },
  { slug: "hull", displayName: "Hull City", league: League.CHAMPIONSHIP },
  { slug: "ipswich", displayName: "Ipswich Town", league: League.CHAMPIONSHIP },
  { slug: "leicester", displayName: "Leicester City", league: League.CHAMPIONSHIP },
  { slug: "middlesbrough", displayName: "Middlesbrough", league: League.CHAMPIONSHIP },
  { slug: "millwall", displayName: "Millwall", league: League.CHAMPIONSHIP },
  { slug: "norwich", displayName: "Norwich City", league: League.CHAMPIONSHIP },
  { slug: "oxford-utd", displayName: "Oxford United", league: League.CHAMPIONSHIP },
  { slug: "preston", displayName: "Preston North End", league: League.CHAMPIONSHIP },
  { slug: "qpr", displayName: "Queens Park Rangers", league: League.CHAMPIONSHIP },
  { slug: "sheff-utd", displayName: "Sheffield United", league: League.CHAMPIONSHIP },
  { slug: "sheff-wed", displayName: "Sheffield Wednesday", league: League.CHAMPIONSHIP },
  { slug: "stoke", displayName: "Stoke City", league: League.CHAMPIONSHIP },
  { slug: "sunderland", displayName: "Sunderland AFC", league: League.CHAMPIONSHIP },
  { slug: "swansea", displayName: "Swansea City", league: League.CHAMPIONSHIP },
  { slug: "watford", displayName: "Watford FC", league: League.CHAMPIONSHIP },
  { slug: "west-brom", displayName: "West Bromwich Albion", league: League.CHAMPIONSHIP },
  { slug: "wrexham", displayName: "Wrexham AFC", league: League.CHAMPIONSHIP },
];

const INTERNATIONAL_CLUBS: CanonicalClub[] = [
  { slug: "england", displayName: "England", league: League.INTERNATIONAL },
  { slug: "scotland", displayName: "Scotland", league: League.INTERNATIONAL },
  { slug: "wales", displayName: "Wales", league: League.INTERNATIONAL },
  { slug: "brazil", displayName: "Brazil", league: League.INTERNATIONAL },
  { slug: "argentina", displayName: "Argentina", league: League.INTERNATIONAL },
  { slug: "france", displayName: "France", league: League.INTERNATIONAL },
  { slug: "germany", displayName: "Germany", league: League.INTERNATIONAL },
  { slug: "spain", displayName: "Spain", league: League.INTERNATIONAL },
];

const EUROPEAN_CLUBS: CanonicalClub[] = [
  { slug: "barcelona", displayName: "FC Barcelona", league: League.EUROPEAN },
  { slug: "real-madrid", displayName: "Real Madrid CF", league: League.EUROPEAN },
  { slug: "celtic", displayName: "Celtic FC", league: League.EUROPEAN },
  { slug: "rangers", displayName: "Rangers FC", league: League.EUROPEAN },
  { slug: "psg", displayName: "Paris Saint-Germain", league: League.EUROPEAN },
  { slug: "manchester-city", displayName: "Manchester City", league: League.EUROPEAN },
];

/**
 * Complete registry combining all leagues.
 * Maintains insertion order: PL, Championship, International, European.
 */
export const CANONICAL_CLUB_REGISTRY: CanonicalClub[] = [
  ...PREMIER_LEAGUE_CLUBS,
  ...CHAMPIONSHIP_CLUBS,
  ...INTERNATIONAL_CLUBS,
  ...EUROPEAN_CLUBS,
];

/**
 * Quick lookup by slug
 */
const slugToClubMap = new Map<string, CanonicalClub>();
CANONICAL_CLUB_REGISTRY.forEach((club) => {
  slugToClubMap.set(club.slug, club);
});

export function getClubBySlug(slug: string): CanonicalClub | undefined {
  return slugToClubMap.get(slug);
}

export function getAllClubs(): CanonicalClub[] {
  return [...CANONICAL_CLUB_REGISTRY];
}

export function getClubsByLeague(league: League): CanonicalClub[] {
  return CANONICAL_CLUB_REGISTRY.filter((club) => club.league === league);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[&]/g, "and")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Check if a slug is valid (exists in registry)
 */
export function isValidClubSlug(slug: string): boolean {
  return slugToClubMap.has(slug);
}

/**
 * Get display name for a club slug
 */
export function getDisplayName(slug: string): string | null {
  return getClubBySlug(slug)?.displayName ?? null;
}
