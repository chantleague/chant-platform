import { createClient } from "@supabase/supabase-js";
import { generateBattlesFromFixtures } from "../lib/battleGenerator";
import { fetchFixtures, upsertFixtures } from "../lib/fixtures";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY env vars.",
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const fetchedFixtures = await fetchFixtures();
  const fixtureSync = await upsertFixtures(supabase, fetchedFixtures);
  const battleSync = await generateBattlesFromFixtures(supabase, fixtureSync.rows);

  console.log(
    JSON.stringify(
      {
        fetched: fetchedFixtures.length,
        fixtures: fixtureSync,
        battles: battleSync,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error("syncFixtures failed", error);
  process.exit(1);
});
