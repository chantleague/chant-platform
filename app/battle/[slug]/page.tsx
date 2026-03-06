import { notFound } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { mockBattles } from "../../lib/mockBattles";
import { mockClubs } from "../../lib/mockClubs"; // used for club fallback
import type { Battle, Club } from "@/app/lib/types";
import JoinBattleButton from "../../components/JoinBattleButton";
import OfficialChantPacks from "../../components/OfficialChantPacks";
import BattleVoteButton from "../../components/BattleVoteButton";

type BattleParams = { slug: string | string[] };

export default async function Page({
  params,
}: {
  params: BattleParams | Promise<BattleParams>;
}) {
  const { slug: rawSlug } = await Promise.resolve(params);
  const maybeSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const slug = (maybeSlug ?? "").toString().trim().toLowerCase();

  // fetch battle from Supabase
  let battle: Battle | null = null;
  let homeClub: Club | null = null;
  let awayClub: Club | null = null;
  let homeVotes = 0;
  let awayVotes = 0;

  try {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("slug", slug)
      .single();
    if (!error && data) {
      battle = data as Battle;
    }
  } catch (err) {
    console.error("Battle query failed", err);
  }

  // fallback to mock list if Supabase unavailable or battle missing
  if (!battle) {
    const mb = mockBattles.find((b) => (b.slug ?? "").toLowerCase() === slug);
    if (!mb) return notFound();
    battle = { ...mb, id: "", home_team: (mb.slug || "").split("-vs-")[0], away_team: (mb.slug || "").split("-vs-")[1] } as unknown as Battle;
  }

  // club lookup
  try {
    const { data: h, error: homeErr } = await supabase
      .from("clubs")
      .select("*")
      .eq("slug", battle.home_team)
      .single();
    if (h) {
      homeClub = h as Club;
    } else {
      if (homeErr) {
        console.error("Error fetching home club", homeErr);
      }
      homeClub = mockClubs.find((c) => c.slug === battle.home_team) as Club | null;
    }
  } catch (e) {
    console.error("Error fetching home club", e);
    // fallback to mock
    homeClub = mockClubs.find((c) => c.slug === battle.home_team) as Club | null;
  }
  try {
    const { data: a, error: awayErr } = await supabase
      .from("clubs")
      .select("*")
      .eq("slug", battle.away_team)
      .single();
    if (a) {
      awayClub = a as Club;
    } else {
      if (awayErr) {
        console.error("Error fetching away club", awayErr);
      }
      awayClub = mockClubs.find((c) => c.slug === battle.away_team) as Club | null;
    }
  } catch (e) {
    console.error("Error fetching away club", e);
    awayClub = mockClubs.find((c) => c.slug === battle.away_team) as Club | null;
  }

  // votes count
  try {
    const { count } = await supabase
      .from("votes")
      .select("id", { count: "exact" })
      .eq("battle_id", battle.id)
      .eq("club_slug", battle.home_team);
    homeVotes = count || 0;
  } catch (error) {
    console.error("Error counting home votes", error);
  }
  try {
    const { count } = await supabase
      .from("votes")
      .select("id", { count: "exact" })
      .eq("battle_id", battle.id)
      .eq("club_slug", battle.away_team);
    awayVotes = count || 0;
  } catch (error) {
    console.error("Error counting away votes", error);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Battle Overview
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
          {battle.title || slug.replace(/-/g, " ")}
        </h1>
        {battle.description && <p className="max-w-2xl text-sm text-zinc-400">{battle.description}</p>}
      </header>

      {/* voting area */}
      <section className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-zinc-50">
            {homeClub?.name || battle.home_team}
          </h2>
          <BattleVoteButton
            battleId={battle.id}
            battleSlug={slug}
            clubSlug={battle.home_team || ""}
            voteCount={homeVotes}
          />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-zinc-50">
            {awayClub?.name || battle.away_team}
          </h2>
          <BattleVoteButton
            battleId={battle.id}
            battleSlug={slug}
            clubSlug={battle.away_team || ""}
            voteCount={awayVotes}
          />
        </div>
      </section>

      <section className="grid gap-4 text-xs text-zinc-300 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Chants Submitted
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">
            {(battle.stats?.chants || 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Total Voters
          </p>
          <p className="mt-1 text-2xl font-semibold text-sky-400">
            {(battle.stats?.voters || 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Peak Volume
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-50">
            {battle.stats?.peakDb || 0}
            <span className="ml-1 text-xs text-zinc-500">dB</span>
          </p>
        </div>
        <JoinBattleButton />
      </section>

      <OfficialChantPacks matchId={battle.id || slug} />
    </div>
  );
}

