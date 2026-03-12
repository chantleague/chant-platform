import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { BattleCard } from "../../components/BattleCard";
import { mockClubs } from "../../lib/mockClubs";
import { buildBattleSlug } from "@/app/lib/fixtures";
import {
  buildBattleSlugFromTeams,
  deriveBattleRouteSlug,
  normalizeBattleSlug,
} from "@/app/lib/battleRoutes";
import { getTrendingChants } from "@/lib/trending/getTrendingChants";
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

      const fixtureCanonicalSlugs = fixtures
        .map((fixture) => {
          const homeClub = clubsById[fixture.home_club_id];
          const awayClub = clubsById[fixture.away_club_id];
          if (!homeClub?.slug || !awayClub?.slug) {
            return null;
          }

          return buildBattleSlugFromTeams(homeClub.slug, awayClub.slug);
        })
        .filter((battleSlug): battleSlug is string => Boolean(battleSlug));

      const fixtureLookupSlugs = [...new Set([...fixtureSlugs, ...fixtureCanonicalSlugs])];

      const { data: fixtureBattles, error: fixtureBattleError } = fixtureLookupSlugs.length
        ? await supabase.from("matches").select("*").in("slug", fixtureLookupSlugs)
        : { data: [], error: null };

      if (fixtureBattleError) {
        console.error("Error fetching fixture battles:", fixtureBattleError);
      }

      const battlesBySlug: Record<string, Battle> = {};
      (((fixtureBattles as Battle[] | null) || [])).forEach((battle) => {
        const normalizedBattleSlug = normalizeBattleSlug(battle.slug);
        if (normalizedBattleSlug) {
          battlesBySlug[normalizedBattleSlug] = battle;
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
          const canonicalBattleSlug = buildBattleSlugFromTeams(homeClub.slug, awayClub.slug);
          if (!battleSlug && !canonicalBattleSlug) {
            return null;
          }

          const existingBattle =
            battlesBySlug[normalizeBattleSlug(battleSlug || "")] ||
            battlesBySlug[normalizeBattleSlug(canonicalBattleSlug)];

          const routeSlug = deriveBattleRouteSlug({
            slug: existingBattle?.slug,
            homeTeam: homeClub.slug,
            awayTeam: awayClub.slug,
          });

          if (!routeSlug) {
            return null;
          }

          return {
            id: existingBattle?.id || fixture.id,
            slug: routeSlug,
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

  const topChantsThisWeek = await getTrendingChants({
    limit: 6,
    clubId: String(club.id || "").trim(),
    withinDays: 7,
  });

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
              const normalizedStatus = String(b.status || "").toLowerCase();
              const status: "live" | "upcoming" | "finished" =
                normalizedStatus === "live" || normalizedStatus === "open"
                  ? "live"
                  : normalizedStatus === "finished" ||
                      normalizedStatus === "completed" ||
                      normalizedStatus === "closed"
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

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-50">Top Chants This Week</h2>
        {topChantsThisWeek.length === 0 ? (
          <p className="text-sm text-zinc-400">No trending chants from this club yet this week.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topChantsThisWeek.map((chant) => (
              <article
                key={chant.chantId}
                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"
              >
                <p className="line-clamp-3 text-sm text-zinc-200">{chant.chantText}</p>
                <p className="mt-2 text-xs text-zinc-400">Total Score: {chant.totalScore.toLocaleString()}</p>
                <p className="text-xs text-emerald-300">
                  Trending Score: {chant.trendingScore.toLocaleString()}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/chants/${encodeURIComponent(chant.chantId)}`}
                    className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-200 transition hover:border-zinc-500"
                  >
                    Open Chant
                  </Link>
                  {chant.battleSlug ? (
                    <Link
                      href={`/battles/${encodeURIComponent(chant.battleSlug)}`}
                      className="rounded-full border border-emerald-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300 transition hover:bg-emerald-500 hover:text-black"
                    >
                      Open Battle
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
