/**
 * Fixture Reconciliation
 * 
 * This module handles:
 * 1. Fetching fixtures from multiple sources
 * 2. Deduplicating fixtures by (homeSlug, awaySlug, kickoffTime)
 * 3. Applying tolerance rules for timing mismatches
 * 4. Handling conflicts and returning a unified fixture list
 */

import { Fixture, FixtureSourceAdapter } from "./fixtureSourceAdapters";

/**
 * Configuration for fixture reconciliation
 */
export interface ReconciliationConfig {
  /**
   * Time window in seconds to consider two fixtures as duplicates
   * Default: 300 seconds (5 minutes)
   * 
   * Rationale: Different sources might have slightly different kickoff times
   * (e.g., "15:00" vs "15:05" could be rounding differences)
   */
  timeTolerance: number;
  
  /**
   * Maximum days in future to fetch fixtures
   * Default: 60 days
   */
  maxDaysAhead: number;
}

const DEFAULT_CONFIG: ReconciliationConfig = {
  timeTolerance: 300, // 5 minutes
  maxDaysAhead: 60,
};

/**
 * Deduplicates and reconciles fixtures from multiple sources
 * 
 * Algorithm:
 * 1. Fetch from all adapters in parallel
 * 2. Group fixtures by (homeSlug, awaySlug, kickoffTime with tolerance)
 * 3. Within each group, keep the earliest fetched entry (most recent source)
 * 4. Filter out duplicates and past fixtures
 * 
 * Returns a sorted array by kickoff time
 */
export async function reconcileFixtures(
  adapters: FixtureSourceAdapter[],
  config: Partial<ReconciliationConfig> = {},
): Promise<Fixture[]> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  console.log(`[Reconciler] Starting reconciliation with ${adapters.length} adapters`);
  
  // Fetch from all sources in parallel
  const results = await Promise.allSettled(
    adapters.map((adapter) => adapter.fetchFixtures()),
  );

  const allFixtures: Fixture[] = [];
  results.forEach((result, idx) => {
    if (result.status === "fulfilled") {
      const adapterName = adapters[idx].name;
      console.log(`[Reconciler] ${adapterName} returned ${result.value.length} fixtures`);
      allFixtures.push(...result.value);
    } else {
      console.error(
        `[Reconciler] Adapter ${adapters[idx].name} failed:`,
        result.reason,
      );
    }
  });

  // Filter out past fixtures and those beyond maxDaysAhead
  const now = new Date();
  const maxDate = new Date(now.getTime() + mergedConfig.maxDaysAhead * 24 * 60 * 60 * 1000);
  
  const futureFixtures = allFixtures.filter((fixture) => {
    const fixtureTime = new Date(fixture.kickoffTime);
    return fixtureTime >= now && fixtureTime <= maxDate;
  });

  console.log(`[Reconciler] After filtering: ${futureFixtures.length} future fixtures`);

  // Deduplicate by (homeSlug, awaySlug, kickoffTime with tolerance)
  const deduped = deduplicateFixtures(futureFixtures, mergedConfig.timeTolerance);

  console.log(`[Reconciler] After deduplication: ${deduped.length} unique fixtures`);

  // Sort by kickoff time
  deduped.sort(
    (a, b) =>
      new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime(),
  );

  return deduped;
}

/**
 * Deduplicates fixtures using time tolerance
 * 
 * Two fixtures are considered duplicates if:
 * - Same homeSlug AND awaySlug
 * - Kickoff times within timeTolerance seconds
 * 
 * When duplicates are found, keeps the entry with the earliest fetchedAt
 * (most recently fetched = fresher data)
 */
function deduplicateFixtures(fixtures: Fixture[], timeTolerance: number): Fixture[] {
  if (fixtures.length === 0) return [];

  const groups = new Map<string, Fixture[]>();

  for (const fixture of fixtures) {
    const key = `${fixture.homeSlug}|${fixture.awaySlug}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(fixture);
  }

  const result: Fixture[] = [];

  for (const [, matchFixtures] of groups) {
    // Within each (homeSlug, awaySlug) group, apply time tolerance
    const timeGroups = new Map<string, Fixture[]>();

    for (const fixture of matchFixtures) {
      const matchTime = new Date(fixture.kickoffTime).getTime();
      let found = false;

      // Check if this fixture belongs to an existing time group
      for (const [timeKey, group] of timeGroups) {
        const groupTime = new Date(group[0].kickoffTime).getTime();
        if (Math.abs(matchTime - groupTime) <= timeTolerance * 1000) {
          group.push(fixture);
          found = true;
          break;
        }
      }

      // If not found, create new time group
      if (!found) {
        timeGroups.set(String(matchTime), [fixture]);
      }
    }

    // For each time group, keep the most recently fetched
    for (const [, group] of timeGroups) {
      const mostRecent = group.reduce((prev, current) =>
        new Date(current.fetchedAt) > new Date(prev.fetchedAt)
          ? current
          : prev,
      );
      result.push(mostRecent);
    }
  }

  return result;
}

/**
 * Checks if two fixtures are likely the same match
 * (useful for manual override logic)
 */
export function areFixturesSameMatch(
  a: Fixture,
  b: Fixture,
  timeTolerance: number = 300,
): boolean {
  if (a.homeSlug !== b.homeSlug || a.awaySlug !== b.awaySlug) {
    return false;
  }

  const timeA = new Date(a.kickoffTime).getTime();
  const timeB = new Date(b.kickoffTime).getTime();
  const diff = Math.abs(timeA - timeB);

  return diff <= timeTolerance * 1000;
}
