import { notFound } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { BattleCard } from "../../components/BattleCard";
import { mockClubs } from "../../lib/mockClubs";
import { buildBattleSlug } from "@/app/lib/fixtures";
import type { Club, Battle, Fixture } from "@/app/lib/types";

type ClubParams = { slug: string | string[] };

export default async function ClubPage({
  params,
}: {
  params: ClubParams | Promise<ClubParams>;
}) {
  const { slug: rawSlug } = await Promise.resolve(params);
  const maybeSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const slug = (maybeSlug ?? "").toString().trim().toLowerCase();

  const { data, error: clubError } = await supabase
    .from("clubs")
    .select("*")
    .eq("slug", slug)
    .single();
  let club: Club | null = data as Club | null;

  if (clubError || !club) {
    console.error("Club fetch error", clubError);
    // fallback to mock club when network issue occurs
    const mock = mockClubs.find((c) => c.slug === slug);
    if (mock) {
      club = mock as unknown as Club;
    } else {
      return notFound();
    }
  }
  if (!club) {
    return notFound();
  }

  let normalizedBattles: Battle[] = [];

  if (club.id) {
    const nowIso = new Date().toISOString();

    const [{ data: homeFixtures, error: homeFixtureError }, { data: awayFixtures, error: awayFixtureError }] =
      await Promise.all([
        supabase
          .from("fixtures")
          .select("*")
          .eq("home_club_id", club.id)
          .gte("match_date", nowIso),
        supabase
          .from("fixtures")
          .select("*")
          .eq("away_club_id", club.id)
          .gte("match_date", nowIso),
      ]);

    if (homeFixtureError) {
      console.error("Error fetching home fixtures:", homeFixtureError);
    }
    if (awayFixtureError) {
      console.error("Error fetching away fixtures:", awayFixtureError);
    }

    const fixtureMap = new Map<string, Fixture>();
    [
      ...((homeFixtures as Fixture[] | null) || []),
      ...((awayFixtures as Fixture[] | null) || []),
    ].forEach((fixture) => {
      fixtureMap.set(fixture.id, fixture);
    });

    const fixtures = [...fixtureMap.values()].sort(
      (a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime(),
    );

    if (fixtures.length > 0) {
      const clubIds = [...new Set(fixtures.flatMap((fixture) => [fixture.home_club_id, fixture.away_club_id]))];

      const { data: clubsData, error: fixtureClubError } = await supabase
        .from("clubs")
        .select("id, slug, name")
        .in("id", clubIds);

      if (fixtureClubError) {
        console.error("Error fetching fixture clubs:", fixtureClubError);
      }

      const clubsById: Record<string, Pick<Club, "id" | "slug" | "name">> = {};
      (((clubsData as Pick<Club, "id" | "slug" | "name">[] | null) || [])).forEach((fixtureClub) => {
        clubsById[fixtureClub.id] = fixtureClub;
      });

      const fixtureSlugs = fixtures
        .map((fixture) => {
          const homeClub = clubsById[fixture.home_club_id];
          const awayClub = clubsById[fixture.away_club_id];
          if (!homeClub?.slug || !awayClub?.slug) {
            return null;
          }

          return buildBattleSlug(homeClub.slug, awayClub.slug, fixture.match_date);
        })
        .filter((battleSlug): battleSlug is string => Boolean(battleSlug));

      const { data: fixtureBattles, error: fixtureBattleError } = fixtureSlugs.length
        ? await supabase.from("matches").select("*").in("slug", fixtureSlugs)
        : { data: [], error: null };

      if (fixtureBattleError) {
        console.error("Error fetching fixture battles:", fixtureBattleError);
      }

      const battlesBySlug: Record<string, Battle> = {};
      (((fixtureBattles as Battle[] | null) || [])).forEach((battle) => {
        if (battle.slug) {
          battlesBySlug[battle.slug] = battle;
        }
      });

      normalizedBattles = fixtures
        .map((fixture) => {
          const homeClub = clubsById[fixture.home_club_id];
          const awayClub = clubsById[fixture.away_club_id];

          if (!homeClub?.slug || !awayClub?.slug) {
            return null;
          }

          const battleSlug = buildBattleSlug(homeClub.slug, awayClub.slug, fixture.match_date);
          if (!battleSlug) {
            return null;
          }

          const existingBattle = battlesBySlug[battleSlug];

          return {
            id: existingBattle?.id || fixture.id,
            slug: battleSlug,
            title: existingBattle?.title || `${homeClub.name} vs ${awayClub.name}`,
            description: existingBattle?.description || `${fixture.league} fixture`,
            home_team: existingBattle?.home_team || homeClub.slug,
            away_team: existingBattle?.away_team || awayClub.slug,
            status: existingBattle?.status || "upcoming",
            starts_at: existingBattle?.starts_at || fixture.match_date,
            stats: existingBattle?.stats,
          } as Battle;
        })
        .filter((battle): battle is Battle => Boolean(battle));
    }
  }

  if (normalizedBattles.length === 0) {
    const { data: rawBattles, error: battlesError } = await supabase
      .from("matches")
      .select("*")
      .ilike("slug", `%${slug}%`);

    normalizedBattles = (rawBattles as Battle[] | null) || [];
    if (battlesError) {
      console.error("Error fetching related battles:", battlesError);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">{club.name}</h1>
        {club.description && <p className="text-sm text-zinc-400">{club.description}</p>}
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Total fans: {(club.fans || 0).toLocaleString()}
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-50">Upcoming battles</h2>
        {normalizedBattles.length === 0 ? (
          <p className="text-sm text-zinc-400">No upcoming battles found for this club.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {normalizedBattles.map((b: Battle) => {
              const slugVal = b.slug || "";
              const [clubA, clubB] = slugVal.split("-vs-");
              const fallbackTitle = `${clubA.replace(/-/g, " ")} vs ${(clubB || "").replace(/-/g, " ")}`;
              const status: "live" | "upcoming" | "finished" =
                b.status === "live"
                  ? "live"
                  : b.status === "finished" || b.status === "completed"
                  ? "finished"
                  : "upcoming";
              return (
                <BattleCard
                  key={b.id || slugVal}
                  slug={slugVal}
                  title={(b.title as string) || fallbackTitle}
                  subtitle={(b.description as string) || ""}
                  status={status}
                  tag="battle"
                  metricLabel="Kickoff"
                  metricValue={
                    b.starts_at ? new Date(b.starts_at).toLocaleString() : "TBD"
                  }
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
