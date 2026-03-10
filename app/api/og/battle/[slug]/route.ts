import { ImageResponse } from "next/og";
import { createElement } from "react";
import { supabase } from "@/app/lib/supabase";
import {
  getBattleSlugLookupCandidates,
  normalizeBattleSlug,
  parseBattleSlugTeams,
  stripBattleDateSuffix,
} from "@/app/lib/battleRoutes";
import { mockBattles } from "@/app/lib/mockBattles";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

interface RouteContext {
  params: { slug: string } | Promise<{ slug: string }>;
}

interface OgBattleData {
  slug: string;
  title: string;
  homeClub: string;
  awayClub: string;
}

interface MatchRow {
  slug?: string | null;
  title?: string | null;
  home_team?: string | null;
  away_team?: string | null;
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

function fallbackBattleFromSlug(slug: string): OgBattleData {
  const parsed = parseBattleSlugTeams(slug);
  const homeClub = toClubDisplayName(parsed?.homeTeam || "Home Club") || "Home Club";
  const awayClub = toClubDisplayName(parsed?.awayTeam || "Away Club") || "Away Club";

  return {
    slug,
    title: `${homeClub} vs ${awayClub} Chant Battle`,
    homeClub,
    awayClub,
  };
}

function toOgBattleData(row: MatchRow, fallbackSlug: string): OgBattleData {
  const normalizedRowSlug = normalizeBattleSlug(row.slug || fallbackSlug) || fallbackSlug;
  const parsed = parseBattleSlugTeams(normalizedRowSlug) || parseBattleSlugTeams(fallbackSlug);

  const homeClub =
    toClubDisplayName(row.home_team) ||
    toClubDisplayName(parsed?.homeTeam || "") ||
    "Home Club";
  const awayClub =
    toClubDisplayName(row.away_team) ||
    toClubDisplayName(parsed?.awayTeam || "") ||
    "Away Club";
  const title =
    String(row.title || "").trim() || `${homeClub} vs ${awayClub} Chant Battle`;

  return {
    slug: normalizedRowSlug,
    title,
    homeClub,
    awayClub,
  };
}

async function resolveBattleForOg(slug: string): Promise<OgBattleData> {
  const normalizedSlug = normalizeBattleSlug(slug);
  const candidates = getBattleSlugLookupCandidates(normalizedSlug);

  for (const candidate of candidates) {
    const exactResult = await supabase
      .from("matches")
      .select("slug, title, home_team, away_team")
      .eq("slug", candidate)
      .order("starts_at", { ascending: false })
      .limit(1);

    if (exactResult.error) {
      console.error("og battle route: exact slug lookup failed", {
        slug: candidate,
        error: exactResult.error,
      });
      continue;
    }

    if ((exactResult.data || []).length > 0) {
      return toOgBattleData((exactResult.data as MatchRow[])[0], normalizedSlug);
    }
  }

  for (const candidate of candidates) {
    const prefixResult = await supabase
      .from("matches")
      .select("slug, title, home_team, away_team")
      .ilike("slug", `${candidate}%`)
      .order("starts_at", { ascending: false })
      .limit(20);

    if (prefixResult.error) {
      console.error("og battle route: prefix slug lookup failed", {
        slug: candidate,
        error: prefixResult.error,
      });
      continue;
    }

    const rows = (prefixResult.data as MatchRow[] | null) || [];
    const matched = rows.find((row) => {
      const rowSlug = normalizeBattleSlug(row.slug);
      const rowWithoutDate = stripBattleDateSuffix(rowSlug);
      return candidates.includes(rowSlug) || candidates.includes(rowWithoutDate);
    });

    if (matched) {
      return toOgBattleData(matched, normalizedSlug);
    }
  }

  const parsedTeams = parseBattleSlugTeams(normalizedSlug);
  if (parsedTeams) {
    const teamResult = await supabase
      .from("matches")
      .select("slug, title, home_team, away_team")
      .ilike("home_team", parsedTeams.homeTeam)
      .ilike("away_team", parsedTeams.awayTeam)
      .order("starts_at", { ascending: false })
      .limit(1);

    if (teamResult.error) {
      console.error("og battle route: team lookup failed", {
        homeTeam: parsedTeams.homeTeam,
        awayTeam: parsedTeams.awayTeam,
        error: teamResult.error,
      });
    } else if ((teamResult.data || []).length > 0) {
      return toOgBattleData((teamResult.data as MatchRow[])[0], normalizedSlug);
    }
  }

  const mockBattle = mockBattles.find((battle) => {
    const mockSlug = normalizeBattleSlug(battle.slug);
    const mockSlugWithoutDate = stripBattleDateSuffix(mockSlug);
    return candidates.includes(mockSlug) || candidates.includes(mockSlugWithoutDate);
  });

  if (mockBattle) {
    const parsedMockTeams = parseBattleSlugTeams(mockBattle.slug);
    return {
      slug: normalizeBattleSlug(mockBattle.slug),
      title: mockBattle.title,
      homeClub: toClubDisplayName(parsedMockTeams?.homeTeam || "") || "Home Club",
      awayClub: toClubDisplayName(parsedMockTeams?.awayTeam || "") || "Away Club",
    };
  }

  return fallbackBattleFromSlug(normalizedSlug || "battle");
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug: rawSlug } = await Promise.resolve(context.params);
  const slug = normalizeBattleSlug(rawSlug) || "battle";

  let battle = fallbackBattleFromSlug(slug);
  try {
    battle = await resolveBattleForOg(slug);
  } catch (error) {
    console.error("og battle route: unexpected battle resolution error", {
      slug,
      error,
    });
  }

  return new ImageResponse(
    createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.35) 0, rgba(16,185,129,0) 45%), radial-gradient(circle at 85% 10%, rgba(56,189,248,0.25) 0, rgba(56,189,248,0) 42%), linear-gradient(135deg, #020617 0%, #0b132b 45%, #111827 100%)",
          color: "#f8fafc",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          padding: "58px",
        },
      },
      createElement(
        "div",
        {
          style: {
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: "28px",
            padding: "44px",
            backgroundColor: "rgba(2,6,23,0.45)",
          },
        },
        createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            },
          },
          createElement(
            "div",
            {
              style: {
                fontSize: "26px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#86efac",
                fontWeight: 700,
              },
            },
            "Chant League",
          ),
          createElement(
            "div",
            {
              style: {
                fontSize: "72px",
                lineHeight: 1,
                fontWeight: 800,
                color: "#f8fafc",
              },
            },
            "Chant Battle",
          ),
          createElement(
            "div",
            {
              style: {
                marginTop: "10px",
                fontSize: "56px",
                fontWeight: 700,
                color: "#d1fae5",
              },
            },
            `${battle.homeClub} vs ${battle.awayClub}`,
          ),
        ),
        createElement(
          "div",
          {
            style: {
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              fontSize: "30px",
              color: "#cbd5e1",
              letterSpacing: "0.04em",
            },
          },
          createElement(
            "div",
            {
              style: {
                maxWidth: "76%",
                fontSize: "28px",
                color: "#e2e8f0",
              },
            },
            battle.title,
          ),
          createElement(
            "div",
            {
              style: {
                fontWeight: 700,
                color: "#86efac",
              },
            },
            "ChantLeague.com",
          ),
        ),
      ),
    ),
    size,
  );
}