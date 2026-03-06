import { NextResponse } from "next/server";
import { getClubsGroupedByLeague } from "@/app/lib/apiLayer";

export async function GET() {
  const clubs = await getClubsGroupedByLeague();

  return NextResponse.json(
    {
      clubs,
    },
    { status: 200 },
  );
}
