import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabase } from "@/app/lib/supabase";
import { supabaseServer } from "@/app/lib/supabaseServer";
import {
	deriveBattleRouteSlug,
	getBattleSlugLookupCandidates,
	normalizeBattleSlug,
	parseBattleSlugTeams,
	stripBattleDateSuffix,
} from "@/app/lib/battleRoutes";
import { mockBattles } from "@/app/lib/mockBattles";
import type { Battle, Club } from "@/app/lib/types";
import JoinBattleButton from "@/app/components/JoinBattleButton";
import OfficialChantPacks from "@/app/components/OfficialChantPacks";
import BattleVoteButton from "@/app/components/BattleVoteButton";
import FanChantSubmissionForm from "@/app/components/FanChantSubmissionForm";
import FanSubmittedChants from "@/app/components/FanSubmittedChants";

type BattleParams = { slug: string | string[] };
const SITE_URL = "https://chantleague.com";

interface WinnerChantCandidate {
	id: string;
	chantText: string;
	voteCount: number;
	clubId: string | null;
	createdAt: string | null;
}

function isMissingColumnError(errorMessage: string, columnName: string) {
	if (!errorMessage) {
		return false;
	}

	const escapedColumn = columnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(
		`(column .*${escapedColumn}.* does not exist|Could not find the '${escapedColumn}' column)`,
		"i",
	).test(errorMessage);
}

function toVoteCount(value: unknown, fallback = 0) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	const parsed = Number.parseInt(String(value || ""), 10);
	if (Number.isNaN(parsed)) {
		return fallback;
	}

	return parsed;
}

function toTimestamp(value?: string | null) {
	if (!value) {
		return 0;
	}

	const timestamp = new Date(value).getTime();
	return Number.isNaN(timestamp) ? 0 : timestamp;
}

function resolveKickoffTime(battle: Battle) {
	const kickoffCandidate =
		typeof battle.kickoff_time === "string" && battle.kickoff_time.trim()
			? battle.kickoff_time.trim()
			: null;

	if (kickoffCandidate) {
		return kickoffCandidate;
	}

	const startsAt = typeof battle.starts_at === "string" && battle.starts_at.trim()
		? battle.starts_at.trim()
		: null;

	return startsAt;
}

function hasKickoffPassed(kickoffTime?: string | null) {
	const normalizedKickoff = String(kickoffTime || "").trim();
	if (!normalizedKickoff) {
		return false;
	}

	const kickoffTimestamp = new Date(normalizedKickoff).getTime();
	if (Number.isNaN(kickoffTimestamp)) {
		return false;
	}

	return Date.now() >= kickoffTimestamp;
}

function toClubDisplayName(value?: string | null) {
	const normalized = String(value || "").trim();
	if (!normalized) {
		return "";
	}

	return normalized
		.replace(/_/g, "-")
		.split(/[-\s]+/)
		.filter(Boolean)
		.map((part) => {
			const lower = part.toLowerCase();
			return lower.charAt(0).toUpperCase() + lower.slice(1);
		})
		.join(" ");
}

function resolveRivalryNames(slug: string, battle?: Battle | null) {
	const parsedFromSlug = parseBattleSlugTeams(slug);
	const homeName =
		toClubDisplayName(battle?.home_team ? String(battle.home_team) : "") ||
		toClubDisplayName(parsedFromSlug?.homeTeam || "") ||
		"Home Club";
	const awayName =
		toClubDisplayName(battle?.away_team ? String(battle.away_team) : "") ||
		toClubDisplayName(parsedFromSlug?.awayTeam || "") ||
		"Away Club";

	return { homeName, awayName };
}

export async function generateMetadata({
	params,
}: {
	params: BattleParams | Promise<BattleParams>;
}): Promise<Metadata> {
	const { slug: rawSlug } = await Promise.resolve(params);
	const maybeSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
	const normalizedParamSlug = normalizeBattleSlug(maybeSlug);

	let battle: Battle | null = null;
	if (normalizedParamSlug) {
		try {
			battle = await resolveBattleBySlug(normalizedParamSlug);
		} catch (error) {
			console.error("battle metadata: failed to resolve battle", {
				slug: normalizedParamSlug,
				error,
			});
		}
	}

	const canonicalSlug = normalizedParamSlug || normalizeBattleSlug(battle?.slug);
	const { homeName, awayName } = resolveRivalryNames(canonicalSlug, battle);

	const title = `${homeName} vs ${awayName} Chant Battle | Chant League`;
	const description = `Vote for the best fan chant in the ${homeName} vs ${awayName} rivalry battle. Fans compete for club pride on Chant League.`;
	const canonicalUrl = `${SITE_URL}/battles/${encodeURIComponent(canonicalSlug || "battle")}`;
	const ogImageUrl = `/api/og/battle/${encodeURIComponent(canonicalSlug || "battle")}`;

	return {
		title,
		description,
		alternates: {
			canonical: canonicalUrl,
		},
		robots: {
			index: true,
			follow: true,
		},
		openGraph: {
			title,
			description,
			url: canonicalUrl,
			siteName: "Chant League",
			images: [
				{
					url: ogImageUrl,
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: [ogImageUrl],
		},
	};
}

async function resolveWinnerChantCandidate(matchId: string): Promise<WinnerChantCandidate | null> {
	const selectWithVotes = "id, chant_text, lyrics, vote_count, club_id, created_at";
	const selectWithoutVotes = "id, chant_text, lyrics, club_id, created_at";
	let includesVoteCount = true;

	let matchColumn: "match_id" | "battle_id" = "match_id";
	let queryResult = await supabaseServer
		.from("chants")
		.select(selectWithVotes)
		.eq(matchColumn, matchId);

	if (queryResult.error && isMissingColumnError(queryResult.error.message || "", "match_id")) {
		matchColumn = "battle_id";
		queryResult = await supabaseServer
			.from("chants")
			.select(selectWithVotes)
			.eq(matchColumn, matchId);
	}

	if (queryResult.error && isMissingColumnError(queryResult.error.message || "", "vote_count")) {
		includesVoteCount = false;
		const fallbackRows = await supabaseServer
			.from("chants")
			.select(selectWithoutVotes)
			.eq(matchColumn, matchId);

		if (fallbackRows.error) {
			console.error("battle page: failed to fetch winner chants", fallbackRows.error);
			return null;
		}

		const rows = (fallbackRows.data as Array<Record<string, unknown>> | null) || [];
		if (rows.length === 0) {
			return null;
		}

		const sortedRows = rows
			.map((row) => ({
				id: String(row.id || "").trim(),
				chantText: String(row.chant_text || row.lyrics || "").trim(),
				voteCount: 0,
				clubId: row.club_id ? String(row.club_id) : null,
				createdAt: row.created_at ? String(row.created_at) : null,
			}))
			.filter((row) => Boolean(row.id) && Boolean(row.chantText))
			.sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));

		return sortedRows[0] || null;
	}

	if (queryResult.error) {
		console.error("battle page: failed to resolve winner chant", queryResult.error);
		return null;
	}

	const rows = (queryResult.data as Array<Record<string, unknown>> | null) || [];
	if (rows.length === 0) {
		return null;
	}

	const sortedRows = rows
		.map((row) => ({
			id: String(row.id || "").trim(),
			chantText: String(row.chant_text || row.lyrics || "").trim(),
			voteCount: includesVoteCount ? toVoteCount(row.vote_count, 0) : 0,
			clubId: row.club_id ? String(row.club_id) : null,
			createdAt: row.created_at ? String(row.created_at) : null,
		}))
		.filter((row) => Boolean(row.id) && Boolean(row.chantText))
		.sort((left, right) => {
			if (right.voteCount !== left.voteCount) {
				return right.voteCount - left.voteCount;
			}

			return toTimestamp(right.createdAt) - toTimestamp(left.createdAt);
		});

	return sortedRows[0] || null;
}

async function resolveBattleBySlug(slug: string): Promise<Battle | null> {
	const candidates = getBattleSlugLookupCandidates(slug);

	for (const candidate of candidates) {
		const exactMatch = await supabase
			.from("matches")
			.select("*")
			.eq("slug", candidate)
			.order("starts_at", { ascending: false })
			.limit(1)
			.maybeSingle();

		if (exactMatch.error) {
			console.error("battle page: exact slug lookup failed", {
				slug: candidate,
				error: exactMatch.error,
			});
		} else if (exactMatch.data) {
			return exactMatch.data as Battle;
		}
	}

	for (const candidate of candidates) {
		const prefixResult = await supabase
			.from("matches")
			.select("*")
			.ilike("slug", `${candidate}%`)
			.order("starts_at", { ascending: false })
			.limit(20);

		if (prefixResult.error) {
			console.error("battle page: prefix slug lookup failed", {
				slug: candidate,
				error: prefixResult.error,
			});
			continue;
		}

		const prefixRows = (prefixResult.data as Battle[] | null) || [];
		const matchedPrefix = prefixRows.find((row) => {
			const rowSlug = normalizeBattleSlug(row.slug);
			const rowWithoutDate = stripBattleDateSuffix(rowSlug);
			return candidates.includes(rowSlug) || candidates.includes(rowWithoutDate);
		});

		if (matchedPrefix) {
			return matchedPrefix;
		}
	}

	const teams = parseBattleSlugTeams(slug);
	if (teams) {
		const teamFallback = await supabase
			.from("matches")
			.select("*")
			.eq("home_team", teams.homeTeam)
			.eq("away_team", teams.awayTeam)
			.order("starts_at", { ascending: false })
			.limit(1)
			.maybeSingle();

		if (teamFallback.error) {
			console.error("battle page: team fallback lookup failed", {
				homeTeam: teams.homeTeam,
				awayTeam: teams.awayTeam,
				error: teamFallback.error,
			});
		} else if (teamFallback.data) {
			return teamFallback.data as Battle;
		}
	}

	const mockMatch = mockBattles.find((battle) => {
		const mockSlug = normalizeBattleSlug(battle.slug);
		const mockWithoutDate = stripBattleDateSuffix(mockSlug);
		return candidates.includes(mockSlug) || candidates.includes(mockWithoutDate);
	});

	if (mockMatch) {
		const teamsFromMock = parseBattleSlugTeams(mockMatch.slug);
		return {
			id: normalizeBattleSlug(mockMatch.slug),
			slug: normalizeBattleSlug(mockMatch.slug),
			title: mockMatch.title,
			description: mockMatch.description,
			home_team: teamsFromMock?.homeTeam,
			away_team: teamsFromMock?.awayTeam,
			status: "upcoming",
			starts_at: null,
			stats: mockMatch.stats,
		} as Battle;
	}

	return null;
}

export default async function Page({
	params,
}: {
	params: BattleParams | Promise<BattleParams>;
}) {
	const { slug: rawSlug } = await Promise.resolve(params);
	const maybeSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
	const slug = normalizeBattleSlug(maybeSlug);

	let battle: Battle | null = null;
	let homeClub: Club | null = null;
	let awayClub: Club | null = null;
	let homeVotes = 0;
	let awayVotes = 0;
	let chantsSubmittedCount = 0;

	if (slug) {
		try {
			battle = await resolveBattleBySlug(slug);
		} catch (err) {
			console.error("Battle query failed", err);
		}
	}

	if (!battle) {
		return notFound();
	}

	const routeSlug = deriveBattleRouteSlug({
		slug: battle.slug,
		homeTeam: battle.home_team,
		awayTeam: battle.away_team,
	}) || slug;

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
	const kickoffTime = resolveKickoffTime(battle);
	const normalizedStatus = (battle.status || "").toString().toLowerCase();
	const votingClosed =
		normalizedStatus === "completed" ||
		normalizedStatus === "finished" ||
		hasKickoffPassed(kickoffTime);
	const submissionWindowOpen =
		Boolean(battleId) &&
		(normalizedStatus === "" || normalizedStatus === "upcoming");

	let winnerChantText: string | null = null;
	let winnerVoteCount = 0;
	let winnerClubValue =
		typeof battle.winning_club === "string" && battle.winning_club.trim()
			? battle.winning_club.trim()
			: "";
	let winnerClubLabel = "";

	if (votingClosed && battleId) {
		const winner = await resolveWinnerChantCandidate(battleId);

		if (winner) {
			winnerChantText = winner.chantText;
			winnerVoteCount = winner.voteCount;

			let resolvedClubLabel = "";
			if (winner.clubId && homeClub?.id && winner.clubId === String(homeClub.id)) {
				winnerClubValue = battle.home_team || winnerClubValue;
				resolvedClubLabel = homeClub?.name || battle.home_team || "";
			} else if (winner.clubId && awayClub?.id && winner.clubId === String(awayClub.id)) {
				winnerClubValue = battle.away_team || winnerClubValue;
				resolvedClubLabel = awayClub?.name || battle.away_team || "";
			} else if (winner.clubId) {
				const clubLookup = await supabase
					.from("clubs")
					.select("id, slug, name")
					.eq("id", winner.clubId)
					.maybeSingle();

				if (!clubLookup.error && clubLookup.data?.id) {
					winnerClubValue = String(clubLookup.data.slug || clubLookup.data.id || winner.clubId);
					resolvedClubLabel = String(clubLookup.data.name || winnerClubValue);
				} else {
					winnerClubValue = winner.clubId;
				}
			}

			if (winnerClubValue === (battle.home_team || "")) {
				winnerClubLabel = homeClub?.name || battle.home_team || winnerClubValue;
			} else if (winnerClubValue === (battle.away_team || "")) {
				winnerClubLabel = awayClub?.name || battle.away_team || winnerClubValue;
			} else if (resolvedClubLabel) {
				winnerClubLabel = resolvedClubLabel;
			}

			if (!winnerClubValue) {
				winnerClubValue = "fan-submission";
			}

			if (!winnerClubLabel) {
				winnerClubLabel =
					winnerClubValue === "fan-submission"
						? "Fan Submission"
						: winnerClubValue.replace(/-/g, " ");
			}

			const battleRecord = battle as Record<string, unknown>;
			const hasWinningChantColumn = Object.prototype.hasOwnProperty.call(
				battleRecord,
				"winning_chant_id",
			);
			const hasWinningClubColumn = Object.prototype.hasOwnProperty.call(
				battleRecord,
				"winning_club",
			);

			const existingWinningChantId =
				typeof battleRecord.winning_chant_id === "string"
					? battleRecord.winning_chant_id
					: "";
			const existingWinningClub =
				typeof battleRecord.winning_club === "string" ? battleRecord.winning_club : "";

			const updatePayload: Record<string, string> = {};
			if (hasWinningChantColumn && existingWinningChantId !== winner.id) {
				updatePayload.winning_chant_id = winner.id;
			}
			if (hasWinningClubColumn && existingWinningClub !== winnerClubValue) {
				updatePayload.winning_club = winnerClubValue;
			}

			if (Object.keys(updatePayload).length > 0) {
				const winnerUpdate = await supabaseServer
					.from("matches")
					.update(updatePayload)
					.eq("id", battle.id);

				if (winnerUpdate.error) {
					console.error("battle page: failed to persist winner", winnerUpdate.error);
				}
			}
		}
	}

	return (
		<div className="space-y-6">
			<header className="space-y-2">
				<p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
					Battle Overview
				</p>
				<h1 className="text-xl font-semibold tracking-tight text-zinc-50">
					{battle.title || routeSlug.replace(/-/g, " ")}
				</h1>
				{battle.description && <p className="max-w-2xl text-sm text-zinc-400">{battle.description}</p>}
			</header>

			{votingClosed && (
				<section className="rounded-2xl border border-amber-700/50 bg-amber-950/20 p-4">
					<p className="text-[11px] uppercase tracking-[0.2em] text-amber-300">🏆 Battle Winner</p>
					{winnerChantText ? (
						<div className="mt-2 space-y-2">
							<p className="text-sm text-zinc-300">
								Club: <span className="font-semibold text-zinc-100">{winnerClubLabel}</span>
							</p>
							<p className="text-sm text-zinc-300">
								Votes: <span className="font-semibold text-amber-200">{winnerVoteCount.toLocaleString()}</span>
							</p>
							<p className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-3 text-sm text-zinc-100 whitespace-pre-wrap">
								{winnerChantText}
							</p>
						</div>
					) : (
						<p className="mt-2 text-sm text-zinc-300">No winning chant has been determined yet.</p>
					)}
				</section>
			)}

			<section className="grid grid-cols-2 gap-4">
				<div className="text-center">
					<h2 className="text-lg font-semibold text-zinc-50">
						{homeClub?.name || battle.home_team}
					</h2>
					<BattleVoteButton
						battleId={battle.id}
						battleSlug={routeSlug}
						clubSlug={battle.home_team || ""}
						voteCount={homeVotes}
						votingClosed={votingClosed}
					/>
				</div>
				<div className="text-center">
					<h2 className="text-lg font-semibold text-zinc-50">
						{awayClub?.name || battle.away_team}
					</h2>
					<BattleVoteButton
						battleId={battle.id}
						battleSlug={routeSlug}
						clubSlug={battle.away_team || ""}
						voteCount={awayVotes}
						votingClosed={votingClosed}
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
					battleSlug={routeSlug}
					submissionOpen={submissionWindowOpen}
					kickoffTime={kickoffTime}
					simpleMode
				/>

				<FanSubmittedChants battleSlug={routeSlug} votingClosed={votingClosed} />
			</section>

			<OfficialChantPacks matchId={battle.id || slug} votingClosed={votingClosed} />
		</div>
	);
}
