/**
 * Admin Endpoint: Run Fixtures Sync
 * POST /api/admin/run-fixtures-sync
 * 
 * Manually trigger the fixtures → battles sync process.
 * 
 * Authenticationstub for now - should be replaced with proper auth.
 * In production: verify admin JWT token
 * 
 * Returns:
 * {
 *   success: boolean,
 *   message: string,
 *   summary: {
 *     fixturesReconciled: number,
 *     battlesCreated: number,
 *     battlesUpdated: number,
 *     battlesSkipped: number,
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getFixtureAdapters } from "@/app/lib/fixtureSourceAdapters";
import { reconcileFixtures } from "@/app/lib/fixtureReconciliation";
import { createBattlesFromFixtures } from "@/app/lib/battleScheduler";
import { CANONICAL_CLUB_REGISTRY } from "@/app/lib/canonicalClubRegistry";

// For now, store battles in memory (in production, use database)
const battlesStore = new Map();

function authenticateAdmin(request: NextRequest): boolean {
  // Stub authentication: check for a simple authorization header
  // In production, verify JWT token against your auth service
  const authHeader = request.headers.get("authorization");
  return authHeader === "Bearer admin-token-stub";
}

export async function POST(request: NextRequest) {
  // Simple auth check
  if (!authenticateAdmin(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    console.log("[API] Starting fixtures sync...");

    // Get all fixture adapters
    const adapters = getFixtureAdapters();
    console.log(`[API] Using ${adapters.length} fixture adapters`);

    // Reconcile fixtures from all sources
    const fixtures = await reconcileFixtures(adapters);
    console.log(`[API] Reconciled ${fixtures.length} fixtures`);

    // Build club lookup map (slug -> displayName)
    const clubMap = new Map();
    for (const club of CANONICAL_CLUB_REGISTRY) {
      clubMap.set(club.slug, club.displayName);
    }

    // Create battles from fixtures
    const { created, updated, skipped } = createBattlesFromFixtures(
      fixtures,
      battlesStore,
      clubMap,
      { daysAhead: 3 },
    );

    console.log(`[API] Results: created=${created.length}, updated=${updated.length}, skipped=${skipped.length}`);

    return NextResponse.json(
      {
        success: true,
        message: "Fixtures sync completed",
        summary: {
          fixturesReconciled: fixtures.length,
          battlesCreated: created.length,
          battlesUpdated: updated.length,
          battlesSkipped: skipped.length,
        },
        details: {
          created: created.map((b) => b.slug),
          updated: updated.map((b) => b.slug),
          skipped,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[API] Error during fixtures sync:", error);
    return NextResponse.json(
      {
        success: false,
        error: `Fixtures sync failed: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    );
  }
}
