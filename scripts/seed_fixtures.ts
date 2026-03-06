import { createClient } from "@supabase/supabase-js";
import { createFixtureWithBattle } from "../app/lib/fixtures";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars.",
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const fixtureSeeds = [
  {
    homeSlug: "arsenal",
    awaySlug: "spurs",
    matchDate: "2026-03-20T17:30:00Z",
    league: "Premier League",
  },
  {
    homeSlug: "man-utd",
    awaySlug: "liverpool",
    matchDate: "2026-03-21T16:30:00Z",
    league: "Premier League",
  },
  {
    homeSlug: "chelsea",
    awaySlug: "arsenal",
    matchDate: "2026-03-27T19:45:00Z",
    league: "Premier League",
  },
] as const;

async function getClubIds(slugs: readonly string[]) {
  const { data, error } = await supabase
    .from("clubs")
    .select("id, slug")
    .in("slug", [...slugs]);

  if (error || !data) {
    throw new Error(`Could not resolve club ids: ${error?.message || "unknown"}`);
  }

  const map = new Map<string, string>();
  data.forEach((club) => {
    map.set(club.slug as string, club.id as string);
  });

  return map;
}

async function seedFixtures() {
  const slugSet = new Set<string>();
  fixtureSeeds.forEach((fixture) => {
    slugSet.add(fixture.homeSlug);
    slugSet.add(fixture.awaySlug);
  });

  const clubIds = await getClubIds([...slugSet]);

  for (const fixture of fixtureSeeds) {
    const homeClubId = clubIds.get(fixture.homeSlug);
    const awayClubId = clubIds.get(fixture.awaySlug);

    if (!homeClubId || !awayClubId) {
      throw new Error(
        `Missing club ids for ${fixture.homeSlug} vs ${fixture.awaySlug}.`,
      );
    }

    const result = await createFixtureWithBattle(supabase, {
      homeClubId,
      awayClubId,
      matchDate: fixture.matchDate,
      league: fixture.league,
    });

    if (!result.success) {
      throw new Error(
        `Failed seeding ${fixture.homeSlug} vs ${fixture.awaySlug}: ${result.message}`,
      );
    }

    console.log(
      `Seeded fixture ${fixture.homeSlug} vs ${fixture.awaySlug} -> ${result.battleSlug}`,
    );
  }
}

seedFixtures()
  .then(() => {
    console.log("Fixture seeding complete.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
