import { createClient } from "@supabase/supabase-js";
import { updateTrendingChantsCache } from "../lib/trending/getTrendingChants";

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
  const result = await updateTrendingChantsCache(
    {
      cacheSize: 50,
    },
    supabase,
  );

  if (!result.success) {
    throw new Error(result.message);
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        updated: result.updated,
        message: result.message,
        schedule: "*/15 * * * *",
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error("updateTrendingChants failed", error);
  process.exit(1);
});
