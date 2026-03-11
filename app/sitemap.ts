import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { deriveBattleRouteSlug, normalizeBattleSlug } from "@/app/lib/battleRoutes";

const SITE_URL = "https://chantleague.com";

interface BattleSlugRow {
  slug?: string | null;
  home_team?: string | null;
  away_team?: string | null;
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function fetchBattleSlugRows(): Promise<BattleSlugRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  for (const tableName of ["battles", "matches"]) {
    const result = await supabase.from(tableName).select("slug,home_team,away_team").limit(1000);

    if (result.error) {
      console.warn(`sitemap: failed to fetch battle slugs from ${tableName}`, result.error.message);
      continue;
    }

    const rows = (result.data as BattleSlugRow[] | null) || [];
    if (rows.length > 0) {
      return rows;
    }
  }

  return [];
}

async function getBattleEntries(now: Date): Promise<MetadataRoute.Sitemap> {
  try {
    const battleRows = await fetchBattleSlugRows();
    const uniqueSlugs = new Set<string>();

    for (const row of battleRows) {
      const resolvedSlug = normalizeBattleSlug(
        deriveBattleRouteSlug({
          slug: row.slug,
          homeTeam: row.home_team,
          awayTeam: row.away_team,
        }),
      );

      if (resolvedSlug) {
        uniqueSlugs.add(resolvedSlug);
      }
    }

    return [...uniqueSlugs].map((slug) => ({
      url: `${SITE_URL}/battles/${encodeURIComponent(slug)}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    }));
  } catch (error) {
    console.error("sitemap: unexpected dynamic route generation error", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/battles`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/clubs`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/events`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/leaderboards`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  const battleEntries = await getBattleEntries(now);
  return [...staticEntries, ...battleEntries];
}
