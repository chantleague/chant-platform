import { NextResponse } from "next/server";
import { getActiveBattles } from "@/app/lib/apiLayer";

export async function GET() {
  const battles = await getActiveBattles();

  return NextResponse.json(
    {
      battles,
    },
    { status: 200 },
  );
}
