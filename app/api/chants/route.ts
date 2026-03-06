import { NextRequest, NextResponse } from "next/server";
import { getChantsForBattleSlug } from "@/app/lib/apiLayer";

export async function GET(request: NextRequest) {
  const battleSlug = request.nextUrl.searchParams.get("battle_slug") || undefined;
  const payload = await getChantsForBattleSlug(battleSlug);

  return NextResponse.json(payload, { status: 200 });
}
