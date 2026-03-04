/**
 * Fixture Source Adapters
 * 
 * This module defines the interface and implementations for fetching fixtures
 * from various sources (RSS feeds, APIs, etc.).
 * 
 * Each adapter is responsible for:
 * 1. Fetching fixture data from its source
 * 2. Mapping external data to our Fixture interface
 * 3. Error handling and graceful degradation
 * 
 * Future enhancements:
 * - Real BBC/Sky Sports RSS parsing
 * - API-level caching
 * - Rate limiting and retry logic
 */

export interface Fixture {
  // Slugs referencing the canonical club registry
  homeSlug: string;
  awaySlug: string;
  
  // ISO 8601 timestamp
  kickoffTime: string;
  
  // Additional context
  competition: string; // e.g., "Premier League", "FA Cup"
  externalId?: string; // source-specific identifier for tracking
  
  // Metadata
  source: string; // e.g., "bbc-rss", "sky-rss"
  fetchedAt: string; // when this fixture was fetched
}

export interface FixtureSourceAdapter {
  /**
   * Fetch fixtures from this source.
   * Should return an empty array if source is unreachable.
   */
  fetchFixtures(): Promise<Fixture[]>;
  
  /**
   * Human-readable name of this source
   */
  readonly name: string;
}

/**
 * BBC Sport RSS Adapter (Stub)
 * 
 * In production, this would:
 * 1. Fetch https://feeds.bbc.co.uk/sport/football/rss.xml
 * 2. Parse RSS entries
 * 3. Extract home/away team slugs and kickoff times
 * 4. Return normalized Fixture array
 */
export class BBCRssAdapter implements FixtureSourceAdapter {
  readonly name = "bbc-rss";

  async fetchFixtures(): Promise<Fixture[]> {
    // Stub implementation: returns sample fixtures
    // Real implementation would parse actual RSS feed
    console.log("[BBC RSS Adapter] Fetching fixtures...");

    const now = new Date();
    const sampleFixtures: Fixture[] = [
      {
        homeSlug: "arsenal",
        awaySlug: "brighton",
        kickoffTime: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        competition: "Premier League",
        externalId: "bbc-match-001",
        source: "bbc-rss",
        fetchedAt: now.toISOString(),
      },
      {
        homeSlug: "man-utd",
        awaySlug: "liverpool",
        kickoffTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        competition: "Premier League",
        externalId: "bbc-match-002",
        source: "bbc-rss",
        fetchedAt: now.toISOString(),
      },
      {
        homeSlug: "chelsea",
        awaySlug: "spurs",
        kickoffTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        competition: "Premier League",
        externalId: "bbc-match-003",
        source: "bbc-rss",
        fetchedAt: now.toISOString(),
      },
      {
        homeSlug: "man-city",
        awaySlug: "everton",
        kickoffTime: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        competition: "Premier League",
        externalId: "bbc-match-004",
        source: "bbc-rss",
        fetchedAt: now.toISOString(),
      },
    ];

    return sampleFixtures;
  }
}

/**
 * Sky Sports RSS Adapter (Stub)
 * 
 * In production, this would:
 * 1. Fetch https://www.skysports.com/feeds/rss/football.xml (or similar)
 * 2. Parse RSS entries
 * 3. Extract home/away team slugs and kickoff times
 * 4. Return normalized Fixture array
 */
export class SkyRssAdapter implements FixtureSourceAdapter {
  readonly name = "sky-rss";

  async fetchFixtures(): Promise<Fixture[]> {
    // Stub implementation: returns sample fixtures
    // Real implementation would parse actual RSS feed
    console.log("[Sky RSS Adapter] Fetching fixtures...");

    const now = new Date();
    const sampleFixtures: Fixture[] = [
      {
        homeSlug: "arsenal",
        awaySlug: "brighton",
        kickoffTime: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        competition: "Premier League",
        externalId: "sky-match-001",
        source: "sky-rss",
        fetchedAt: now.toISOString(),
      },
      {
        homeSlug: "man-utd",
        awaySlug: "liverpool",
        kickoffTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        competition: "Premier League",
        externalId: "sky-match-002",
        source: "sky-rss",
        fetchedAt: now.toISOString(),
      },
      {
        homeSlug: "newcastle",
        awaySlug: "chelsea",
        kickoffTime: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        competition: "Premier League",
        externalId: "sky-match-003",
        source: "sky-rss",
        fetchedAt: now.toISOString(),
      },
    ];

    return sampleFixtures;
  }
}

/**
 * Factory function to get all available adapters
 */
export function getFixtureAdapters(): FixtureSourceAdapter[] {
  return [
    new BBCRssAdapter(),
    new SkyRssAdapter(),
  ];
}
