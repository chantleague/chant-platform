import { NextResponse } from "next/server";
import { supabaseServer } from "@/app/lib/supabaseServer";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ChantScoreParams =
  | {
      chantId?: string;
    }
  | Promise<{
      chantId?: string;
    }>;

function toSafeInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export async function GET(
  _request: Request,
  context: {
    params: ChantScoreParams;
  },
) {
  const params = await Promise.resolve(context.params);
  const chantId = String(params?.chantId || "").trim();

  if (!UUID_PATTERN.test(chantId)) {
    return NextResponse.json(
      {
        message: "Invalid chant id.",
      },
      { status: 400 },
    );
  }

  const scoreLookup = await supabaseServer
    .from("chant_scores")
    .select(
      "total_points, vote_points, share_points, comment_points, remix_points, invite_points, stream_points, download_points, boost_points",
    )
    .eq("chant_id", chantId)
    .maybeSingle();

  if (scoreLookup.error) {
    console.error("api/chant-score: failed to fetch score", {
      chantId,
      error: scoreLookup.error,
    });

    return NextResponse.json(
      {
        message: "Could not fetch chant score.",
      },
      { status: 500 },
    );
  }

  const row = (scoreLookup.data as Record<string, unknown> | null) || {};

  return NextResponse.json({
    total_points: toSafeInt(row.total_points),
    votes: toSafeInt(row.vote_points),
    shares: toSafeInt(row.share_points),
    comments: toSafeInt(row.comment_points),
    remixes: toSafeInt(row.remix_points),
    invites: toSafeInt(row.invite_points),
    downloads: toSafeInt(row.download_points),
    streams: toSafeInt(row.stream_points),
    boosts: toSafeInt(row.boost_points),
  });
}
