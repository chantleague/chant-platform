import { NextResponse } from "next/server";
import { supabaseServer } from "@/app/lib/supabaseServer";
import { generateBattlesFromFixtures } from "@/lib/battleGenerator";
import { fetchFixtures, upsertFixtures } from "@/lib/fixtures";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fetchedFixtures = await fetchFixtures();
    const fixtureSync = await upsertFixtures(supabaseServer, fetchedFixtures);
    const battleSync = await generateBattlesFromFixtures(supabaseServer, fixtureSync.rows);

    return NextResponse.json(
      {
        success: true,
        fetched: fetchedFixtures.length,
        fixtures: fixtureSync,
        battles: battleSync,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("api/sync-fixtures: sync failed", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to sync fixtures.",
      },
      { status: 500 },
    );
  }
}
