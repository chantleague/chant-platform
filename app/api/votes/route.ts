import { NextRequest, NextResponse } from "next/server";
import { submitChantVote } from "@/app/lib/apiLayer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chantId = String(body?.chant_id || "");
    const userIdentifier = String(body?.user_identifier || "");

    const result = await submitChantVote(chantId, userIdentifier);

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
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
