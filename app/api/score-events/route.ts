import { NextRequest, NextResponse } from "next/server";
import {
  recordInviteScoreEvent,
  recordScoreEvent,
  recordSponsorBoostEvent,
} from "@/lib/recordScoreEvent";
import { isShareSource, recordShareEvent } from "@/lib/recordShareEvent";
import { isScoreEventType } from "@/lib/scoringRules";

type ScoreEventPayload = {
  chant_id?: unknown;
  battle_id?: unknown;
  user_id?: unknown;
  event_type?: unknown;
  source?: unknown;
  metadata?: unknown;
};

function toMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  let body: ScoreEventPayload;

  try {
    body = (await request.json()) as ScoreEventPayload;
  } catch (error) {
    console.error("api/score-events: invalid request body", error);
    return NextResponse.json(
      {
        success: false,
        message: "Invalid request body.",
      },
      { status: 400 },
    );
  }

  const chantId = String(body?.chant_id || "").trim();
  const battleId = String(body?.battle_id || "").trim() || undefined;
  const userId = String(body?.user_id || "").trim() || undefined;
  const eventType = String(body?.event_type || "").trim().toLowerCase();
  const source = String(body?.source || "").trim().toLowerCase() || "web";
  const metadata = toMetadata(body?.metadata);

  if (!chantId || !eventType || !isScoreEventType(eventType)) {
    return NextResponse.json(
      {
        success: false,
        message: "chant_id and a supported event_type are required.",
      },
      { status: 400 },
    );
  }

  try {
    const result =
      eventType === "share"
        ? isShareSource(source)
          ? await recordShareEvent(chantId, source, {
              battleId,
              userId,
              metadata,
            })
          : {
              success: false,
              message: "Unsupported share source.",
            }
        : eventType === "invite"
          ? await recordInviteScoreEvent({
              chantId,
              battleId,
              userId,
              source,
              metadata,
            })
          : eventType === "boost"
            ? await recordSponsorBoostEvent({
                chantId,
                battleId,
                userId,
                source,
                metadata,
              })
            : await recordScoreEvent({
                chantId,
                battleId,
                userId,
                eventType,
                source,
                metadata,
              });

    if (!result.success) {
      const status = result.message === "Unsupported share source." ? 400 : 500;
      return NextResponse.json(
        {
          success: false,
          message: result.message,
        },
        { status },
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      event_id: result.eventId,
      points: result.points,
      chant_score: result.chantScore,
      battle_score: result.battleScore,
    });
  } catch (error) {
    console.error("api/score-events: unexpected error", error);
    return NextResponse.json(
      {
        success: false,
        message: "Could not record score event.",
      },
      { status: 500 },
    );
  }
}
