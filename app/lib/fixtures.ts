import type { SupabaseClient } from "@supabase/supabase-js";

interface ClubLookup {
  id: string;
  slug: string;
  name: string;
}

export interface CreateFixtureInput {
  homeClubId: string;
  awayClubId: string;
  matchDate: string;
  league: string;
}

export interface CreateFixtureResult {
  success: boolean;
  fixtureId?: string;
  battleSlug?: string;
  homeClubSlug?: string;
  awayClubSlug?: string;
  message: string;
}

function toSlugDate(matchDate: string) {
  const parsed = new Date(matchDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export function buildBattleSlug(homeSlug: string, awaySlug: string, matchDate: string) {
  const datePart = toSlugDate(matchDate);
  if (!datePart) {
    return null;
  }

  return `${homeSlug}-vs-${awaySlug}-${datePart}`;
}

export async function createFixtureWithBattle(
  supabase: SupabaseClient,
  input: CreateFixtureInput,
): Promise<CreateFixtureResult> {
  const homeClubId = input.homeClubId?.trim();
  const awayClubId = input.awayClubId?.trim();
  const league = input.league?.trim();
  const matchDate = input.matchDate?.trim();

  if (!homeClubId || !awayClubId || !league || !matchDate) {
    return { success: false, message: "Missing fixture information." };
  }

  if (homeClubId === awayClubId) {
    return { success: false, message: "Fixture must have two different clubs." };
  }

  const { data: clubsData, error: clubsError } = await supabase
    .from("clubs")
    .select("id, slug, name")
    .in("id", [homeClubId, awayClubId]);

  if (clubsError || !clubsData || clubsData.length < 2) {
    return { success: false, message: "Could not resolve fixture clubs." };
  }

  const clubs = clubsData as ClubLookup[];
  const homeClub = clubs.find((club) => club.id === homeClubId);
  const awayClub = clubs.find((club) => club.id === awayClubId);

  if (!homeClub || !awayClub) {
    return { success: false, message: "Could not resolve fixture clubs." };
  }

  const battleSlug = buildBattleSlug(homeClub.slug, awayClub.slug, matchDate);
  if (!battleSlug) {
    return { success: false, message: "Invalid match date." };
  }

  const { data: fixtureData, error: fixtureError } = await supabase
    .from("fixtures")
    .upsert(
      [
        {
          home_club_id: homeClubId,
          away_club_id: awayClubId,
          match_date: new Date(matchDate).toISOString(),
          league,
        },
      ],
      {
        onConflict: "home_club_id,away_club_id,match_date,league",
      },
    )
    .select("id")
    .single();

  if (fixtureError || !fixtureData?.id) {
    return { success: false, message: "Could not create fixture." };
  }

  const { error: battleError } = await supabase.from("matches").upsert(
    [
      {
        slug: battleSlug,
        title: `${homeClub.name} vs ${awayClub.name}`,
        description: `${league} fixture`,
        home_team: homeClub.slug,
        away_team: awayClub.slug,
        status: "upcoming",
        starts_at: new Date(matchDate).toISOString(),
      },
    ],
    { onConflict: "slug" },
  );

  if (battleError) {
    return { success: false, message: "Fixture created but battle creation failed." };
  }

  return {
    success: true,
    fixtureId: fixtureData.id as string,
    battleSlug,
    homeClubSlug: homeClub.slug,
    awayClubSlug: awayClub.slug,
    message: "Fixture and battle created.",
  };
}
