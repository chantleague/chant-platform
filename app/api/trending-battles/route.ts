import { NextResponse } from "next/server";
import { getTrendingBattles } from "@/lib/trendingBattles";

export async function GET() {
  const battles = await getTrendingBattles();

  return NextResponse.json(
    {
      battles,
    },
    { status: 200 },
  );
}
