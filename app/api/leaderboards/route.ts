import { NextResponse } from "next/server";
import { getLeaderboardsPayload } from "@/app/lib/apiLayer";

export async function GET() {
  const payload = await getLeaderboardsPayload();

  return NextResponse.json(
    {
      weekly_leaderboard: payload.weekly,
      all_time_leaderboard: payload.all_time,
      club_leaderboard: payload.club,
    },
    { status: 200 },
  );
}
