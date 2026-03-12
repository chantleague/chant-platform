import { NextRequest, NextResponse } from "next/server";

import { supabaseServer } from "@/app/lib/supabaseServer";
import {
  recordScoreEvent,
  UNIVERSAL_SCORE_EVENT_TYPES,
  type UniversalScoreEventType,
} from "@/lib/scoring/recordScoreEvent";

type Payload = {
  chantId?: unknown;
  battleId?: unknown;
  eventType?: unknown;
  source?: unknown;
  metadata?: unknown;
  chant_id?: unknown;
  battle_id?: unknown;
  event_type?: unknown;
};

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_EVENTS = 30;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  return isObjectRecord(value) ? value : {};
}

function getClientIp(request: NextRequest) {
  const xForwardedFor = request.headers.get("x-forwarded-for") || "";
  const firstForwarded = xForwardedFor.split(",")[0]?.trim();
  if (firstForwarded) {
    return firstForwarded;
  }

  return (request.headers.get("x-real-ip") || "").trim();
}

function resolveRateLimitKey(metadata: Record<string, unknown>, clientIp: string) {
  const fanId = String(metadata.fan_id || "").trim();
  if (fanId) {
    return `fan:${fanId}`;
  }

  const userId = String(metadata.user_id || "").trim();
  if (userId) {
    return `user:${userId}`;
  }

  if (clientIp) {
    return `ip:${clientIp}`;
  }

  return "anon";
}

function normalizeEventType(eventType: string, source: string): string {
  const normalizedType = eventType.trim().toLowerCase();
  const normalizedSource = source.trim().toLowerCase();

  if (normalizedType === "video_play") {
    return "play";
  }
  if (normalizedType === "spotify_stream") {
    return "spotify_play";
  }
  if (normalizedType === "boost") {
    return "boost_purchase";
  }
  if (normalizedType === "share" && normalizedSource === "tiktok") {
    return "tiktok_usage";
  }
  if (normalizedType === "share" && normalizedSource === "whatsapp") {
    return "whatsapp_share";
  }

  return normalizedType;
}

function isUniversalEventType(value: string): value is UniversalScoreEventType {
  return UNIVERSAL_SCORE_EVENT_TYPES.includes(value as UniversalScoreEventType);
}

async function isRateLimited(rateLimitKey: string) {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const lookup = await supabaseServer
    .from("chant_score_events")
    .select("id", { count: "exact", head: true })
    .contains("metadata", { rate_limit_key: rateLimitKey })
    .gte("created_at", cutoff);

  if (lookup.error) {
    console.error("api/score-event: rate limit lookup failed", {
      rateLimitKey,
      error: lookup.error,
    });
    return false;
  }

  return (lookup.count || 0) >= RATE_LIMIT_MAX_EVENTS;
}

export async function POST(request: NextRequest) {
  let body: Payload;

  try {
    body = (await request.json()) as Payload;
  } catch (error) {
    console.error("api/score-event: invalid request body", error);
    return NextResponse.json(
      {
        success: false,
        message: "Invalid request body.",
      },
      { status: 400 },
    );
  }

  const chantId = String(body.chantId || body.chant_id || "").trim();
  const battleId = String(body.battleId || body.battle_id || "").trim();
  const source = String(body.source || "web").trim().toLowerCase();
  const rawEventType = String(body.eventType || body.event_type || "").trim().toLowerCase();
  const eventType = normalizeEventType(rawEventType, source);
  const metadata = normalizeMetadata(body.metadata);

  if (!chantId || !eventType || !isUniversalEventType(eventType)) {
    return NextResponse.json(
      {
        success: false,
        message: "chantId and a supported eventType are required.",
      },
      { status: 400 },
    );
  }

  const clientIp = getClientIp(request);
  const rateLimitKey = resolveRateLimitKey(metadata, clientIp);
  const enrichedMetadata: Record<string, unknown> = {
    ...metadata,
    rate_limit_key: rateLimitKey,
    client_ip: metadata.client_ip || clientIp || null,
  };

  if (await isRateLimited(rateLimitKey)) {
    return NextResponse.json(
      {
        success: false,
        message: "Rate limit reached. Try again shortly.",
      },
      { status: 429 },
    );
  }

  const result = await recordScoreEvent({
    chantId,
    battleId,
    eventType,
    source,
    metadata: enrichedMetadata,
  });

  if (!result.success) {
    const status = /already voted/i.test(result.message)
      ? 409
      : /require metadata/i.test(result.message)
        ? 400
        : 500;

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
  });
}
