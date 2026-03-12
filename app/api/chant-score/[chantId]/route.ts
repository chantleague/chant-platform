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

function normalizeEventType(eventType: string, source: string) {
  const normalizedEventType = String(eventType || "").trim().toLowerCase();
  const normalizedSource = String(source || "").trim().toLowerCase();

  if (normalizedEventType === "video_play") {
    return "play";
  }
  if (normalizedEventType === "spotify_stream") {
    return "spotify_play";
  }
  if (normalizedEventType === "share" && normalizedSource === "tiktok") {
    return "tiktok_usage";
  }
  if (normalizedEventType === "share" && normalizedSource === "whatsapp") {
    return "whatsapp_share";
  }

  return normalizedEventType;
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
    .from("chant_score_events")
    .select("event_type, source, value, points")
    .eq("chant_id", chantId);

  if (scoreLookup.error) {
    console.error("api/chant-score: failed to fetch score events", {
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

  const rows =
    (scoreLookup.data as Array<{ event_type?: string; source?: string; value?: number; points?: number }> | null) ||
    [];

  let totalScore = 0;
  let votes = 0;
  let shares = 0;
  let plays = 0;
  let tiktokUsage = 0;

  rows.forEach((row) => {
    const eventType = normalizeEventType(String(row.event_type || ""), String(row.source || ""));
    const scoreDelta = toSafeInt(row.value ?? row.points ?? 0);
    totalScore += scoreDelta;

    if (eventType === "vote") {
      votes += 1;
      return;
    }

    if (eventType === "share" || eventType === "whatsapp_share") {
      shares += 1;
      return;
    }

    if (eventType === "play" || eventType === "youtube_play" || eventType === "spotify_play") {
      plays += 1;
      return;
    }

    if (eventType === "tiktok_usage") {
      tiktokUsage += 1;
    }
  });

  return NextResponse.json({
    total_points: totalScore,
    total_score: totalScore,
    votes,
    shares,
    plays,
    tiktok_usage: tiktokUsage,
  });
}
