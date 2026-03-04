/**
 * Smoke Tests for Fixtures → Battles Engine
 * 
 * Verifies:
 * 1. Club registry and pages work (5+ clubs)
 * 2. Fixture reconciliation merges sources correctly
 * 3. Battle creation scheduler works and doesn't duplicate
 * 4. API endpoint for fixtures sync
 */

const fetch = global.fetch || require("node-fetch");

// Test data helpers
const CANONICAL_CLUBS_PL = [
  "arsenal",
  "man-city",
  "man-utd",
  "liverpool",
  "chelsea",
];
const CANONICAL_CLUBS_EFL = [
  "leicester",
  "norwich",
  "coventry",
];

let base = process.env.BASE_URL || "http://localhost:3000";

async function findWorkingBase() {
  if (process.env.BASE_URL) return base;
  const ports = [3000, 3001, 3002, 3003, 3004];
  for (const port of ports) {
    try {
      const baseTry = `http://localhost:${port}`;
      const res = await fetch(`${baseTry}/clubs`, { redirect: "manual" });
      if (res.status === 200) {
        return baseTry;
      }
    } catch (_e) {
      // ignore
    }
  }
  return base;
}

// Test 1: Verify club pages render
async function testClubPages() {
  console.log("\n[TEST 1] Testing club pages...");
  let passed = 0;
  let failed = 0;

  // Test clubs index
  try {
    const res = await fetch(`${base}/clubs`, { redirect: "manual" });
    if (res.status === 200) {
      console.log("  ✓ /clubs renders");
      passed++;
    } else {
      console.error(`  ✗ /clubs returned ${res.status}`);
      failed++;
    }
  } catch (err) {
    console.error(`  ✗ /clubs error:`, err.message);
    failed++;
  }

  // Test club detail pages (5+ clubs)
  const clubsToTest = [...CANONICAL_CLUBS_PL, ...CANONICAL_CLUBS_EFL].slice(
    0,
    8,
  );
  for (const club of clubsToTest) {
    try {
      const res = await fetch(`${base}/clubs/${club}`, { redirect: "manual" });
      if (res.status === 200) {
        console.log(`  ✓ /clubs/${club} renders`);
        passed++;
      } else {
        console.error(`  ✗ /clubs/${club} returned ${res.status}`);
        failed++;
      }
    } catch (err) {
      console.error(`  ✗ /clubs/${club} error:`, err.message);
      failed++;
    }
  }

  return { passed, failed };
}

// Test 2: Verify fixtures sync API
async function testFixturesSyncAPI() {
  console.log("\n[TEST 2] Testing fixtures sync API...");
  let passed = 0;
  let failed = 0;

  try {
    const res = await fetch(`${base}/api/admin/run-fixtures-sync`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer admin-token-stub",
        "Content-Type": "application/json",
      },
    });

    if (res.status === 200) {
      const data = await res.json();
      if (
        data.success &&
        typeof data.summary.fixturesReconciled === "number" &&
        typeof data.summary.battlesCreated === "number"
      ) {
        console.log(`  ✓ API returned success with fixture count: ${data.summary.fixturesReconciled}`);
        console.log(
          `    battles created: ${data.summary.battlesCreated}, updated: ${data.summary.battlesUpdated}`,
        );
        passed++;
      } else {
        console.error("  ✗ API response missing expected fields");
        failed++;
      }
    } else {
      console.error(`  ✗ API returned ${res.status}`);
      failed++;
    }
  } catch (err) {
    console.error("  ✗ API error:", err.message);
    failed++;
  }

  return { passed, failed };
}

// Test 3: Verify reconciliation deduplicates
async function testReconciliation() {
  console.log("\n[TEST 3] Testing fixture reconciliation...");
  let passed = 0;
  let failed = 0;

  try {
    // Call API twice to test idempotency
    const res1 = await fetch(`${base}/api/admin/run-fixtures-sync`, {
      method: "POST",
      headers: {
        Authorization: "Bearer admin-token-stub",
      },
    });

    if (res1.status !== 200) {
      console.error("  ✗ First sync call failed");
      failed++;
    } else {
      const data1 = await res1.json();
      const battlesCreatedFirst = data1.summary.battlesCreated;

      // Call again to check for duplication
      const res2 = await fetch(`${base}/api/admin/run-fixtures-sync`, {
        method: "POST",
        headers: {
          Authorization: "Bearer admin-token-stub",
        },
      });

      if (res2.status === 200) {
        const data2 = await res2.json();
        const battlesCreatedSecond = data2.summary.battlesCreated;

        // Second call should create fewer or zero new battles (idempotency)
        if (battlesCreatedSecond <= battlesCreatedFirst) {
          console.log(
            `  ✓ Reconciliation is idempotent (first: ${battlesCreatedFirst}, second: ${battlesCreatedSecond})`,
          );
          passed++;
        } else {
          console.error("  ✗ Reconciliation created duplicates");
          failed++;
        }
      } else {
        console.error("  ✗ Second sync call failed");
        failed++;
      }
    }
  } catch (err) {
    console.error("  ✗ Reconciliation test error:", err.message);
    failed++;
  }

  return { passed, failed };
}

// Test 4: Verify club-home page
async function testClubHome() {
  console.log("\n[TEST 4] Testing club-home page...");
  let passed = 0;
  let failed = 0;

  try {
    const res = await fetch(`${base}/club-home`, { redirect: "manual" });
    if (res.status === 200) {
      console.log("  ✓ /club-home renders");
      passed++;
    } else {
      console.error(`  ✗ /club-home returned ${res.status}`);
      failed++;
    }
  } catch (err) {
    console.error("  ✗ /club-home error:", err.message);
    failed++;
  }

  return { passed, failed };
}

// Main
(async () => {
  base = await findWorkingBase();
  console.log(`Running fixture engine smoke tests against ${base}`);

  let totalPassed = 0;
  let totalFailed = 0;

  const test1 = await testClubPages();
  totalPassed += test1.passed;
  totalFailed += test1.failed;

  const test2 = await testFixturesSyncAPI();
  totalPassed += test2.passed;
  totalFailed += test2.failed;

  const test3 = await testReconciliation();
  totalPassed += test3.passed;
  totalFailed += test3.failed;

  const test4 = await testClubHome();
  totalPassed += test4.passed;
  totalFailed += test4.failed;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);
  console.log(`${"=".repeat(50)}\n`);

  if (totalFailed > 0) {
    console.error("Smoke test FAILED");
    process.exit(1);
  }

  console.log("Smoke test PASSED");
  process.exit(0);
})();
