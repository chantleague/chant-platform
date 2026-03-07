import { NextRequest, NextResponse } from "next/server";
import { submitChantVote } from "@/app/lib/apiLayer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chantRowId = String(body?.chant_row_id || "");
    const chantPackId = String(body?.chant_pack_id || body?.chant_id || "");
    const matchId = String(body?.match_id || "");
    const battleSlug = String(body?.battle_slug || "");
    const userIdentifier = String(body?.user_identifier || "");

    const result = await submitChantVote({
      chantRowId,
      chantPackId,
      matchId,
      battleSlug,
      userIdentifier,
    });

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
        vote_count: result.voteCount,
      },
      { status: result.status },
    );
  } catch (error) {
    console.error("api/votes: invalid request body", error);
    return NextResponse.json(
      {
        success: false,
        message: "Invalid request body.",
      },
      { status: 400 },
    );
  }
}
