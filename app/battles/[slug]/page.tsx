import { notFound } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import type { Battle, Club } from "@/app/lib/types";
import JoinBattleButton from "@/app/components/JoinBattleButton";
import OfficialChantPacks from "@/app/components/OfficialChantPacks";
import BattleVoteButton from "@/app/components/BattleVoteButton";
import FanChantSubmissionForm from "@/app/components/FanChantSubmissionForm";
import FanSubmittedChants from "@/app/components/FanSubmittedChants";

type BattleParams = { slug: string | string[] };

export default async function Page({
	params,
}: {
	params: BattleParams | Promise<BattleParams>;
}) {
	const { slug: rawSlug } = await Promise.resolve(params);
	const maybeSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
	const slug = (maybeSlug ?? "").toString().trim().toLowerCase();

	let battle: Battle | null = null;
	let homeClub: Club | null = null;
	let awayClub: Club | null = null;
	let homeVotes = 0;
	let awayVotes = 0;
	let chantsSubmittedCount = 0;

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

	if (!battle) {
		return notFound();
	}

	try {
		const { data: homeClubData, error: homeErr } = await supabase
			.from("clubs")
			.select("*")
			.eq("slug", battle.home_team)
			.single();

		if (homeClubData) {
			homeClub = homeClubData as Club;
		} else {
			if (homeErr) {
				console.error("Error fetching home club", homeErr);
			}
		}
	} catch (e) {
		console.error("Error fetching home club", e);
	}

	try {
		const { data: awayClubData, error: awayErr } = await supabase
			.from("clubs")
			.select("*")
			.eq("slug", battle.away_team)
			.single();

		if (awayClubData) {
			awayClub = awayClubData as Club;
		} else {
			if (awayErr) {
				console.error("Error fetching away club", awayErr);
			}
		}
	} catch (e) {
		console.error("Error fetching away club", e);
	}

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

	chantsSubmittedCount = Number(battle.stats?.chants || 0);

	if (battle.id) {
		try {
			const byMatchId = await supabase
				.from("chants")
				.select("id", { count: "exact", head: true })
				.eq("match_id", battle.id);

			let count = byMatchId.count;
			let error = byMatchId.error;

			if (error && /column .*match_id.* does not exist/i.test(error.message || "")) {
				const legacyByBattleId = await supabase
					.from("chants")
					.select("id", { count: "exact", head: true })
					.eq("battle_id", battle.id);

				count = legacyByBattleId.count;
				error = legacyByBattleId.error;
			}

			if (error) {
				console.warn("battle page: failed to fetch chant count", error);
			} else if (typeof count === "number") {
				chantsSubmittedCount = count;
			}
		} catch (error) {
			console.warn("battle page: unexpected chant count error", error);
		}
	}

	const battleId = battle.id || "";
	const kickoffTimeCandidate =
		typeof battle.kickoff_time === "string" && battle.kickoff_time.trim()
			? battle.kickoff_time
			: null;
	const kickoffTime = kickoffTimeCandidate || battle.starts_at || null;
	const normalizedStatus = (battle.status || "").toString().toLowerCase();
	const submissionWindowOpen =
		Boolean(battleId) &&
		(normalizedStatus === "" || normalizedStatus === "upcoming");

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

			<section className="grid gap-4 text-xs text-zinc-300 sm:grid-cols-3">
				<div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
					<p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
						Chants Submitted
					</p>
					<p className="mt-1 text-2xl font-semibold text-emerald-400">
						{chantsSubmittedCount.toLocaleString()}
					</p>
				</div>
				<div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
					<p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
						Total Voters
					</p>
					<p className="mt-1 text-2xl font-semibold text-sky-400">
						{(homeVotes + awayVotes).toLocaleString()}
					</p>
				</div>
				<JoinBattleButton targetId="submit-chant-section" />
			</section>

			<section id="submit-chant-section" className="space-y-4">
				<div className="space-y-1">
					<p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
						Fan Chants
					</p>
					<h2 className="text-lg font-semibold tracking-tight text-zinc-50">
						Submit Your Chant
					</h2>
				</div>

				<FanChantSubmissionForm
					battleSlug={slug}
					submissionOpen={submissionWindowOpen}
					kickoffTime={kickoffTime}
					simpleMode
				/>

				<FanSubmittedChants battleSlug={slug} />
			</section>

			<OfficialChantPacks matchId={battle.id || slug} />
		</div>
	);
}
