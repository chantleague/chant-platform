import "server-only";

import { supabaseServer } from "@/app/lib/supabaseServer";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_SCORE_WEIGHTS = {
  vote: 3,
  share: 2,
  play: 1,
  tiktok_usage: 5,
  youtube_play: 4,
  spotify_play: 4,
  whatsapp_share: 3,
  download: 2,
  boost_purchase: 10,
} as const;

export type UniversalScoreEventType = keyof typeof DEFAULT_SCORE_WEIGHTS;

export const UNIVERSAL_SCORE_EVENT_TYPES = Object.keys(
  DEFAULT_SCORE_WEIGHTS,
) as UniversalScoreEventType[];

export interface RecordScoreEventInput {
  chantId: string;
  battleId?: string;
  eventType: UniversalScoreEventType;
  source?: string;
  metadata?: Record<string, unknown> | null;
}

export interface RecordScoreEventResult {
  success: boolean;
  message: string;
  eventId?: string;
  points?: number;
  totalScore?: number;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeUuid(value?: string | null): string {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return "";
  }

  return UUID_PATTERN.test(candidate) ? candidate : "";
}

function normalizeSource(value?: string) {
  const candidate = String(value || "").trim().toLowerCase();
  return candidate || "web";
}

function normalizeMetadata(value?: Record<string, unknown> | null): Record<string, unknown> {
  if (!isObjectRecord(value)) {
    return {};
  }

  return value;
}

function isUniversalScoreEventType(value: string): value is UniversalScoreEventType {
  return UNIVERSAL_SCORE_EVENT_TYPES.includes(value as UniversalScoreEventType);
}

async function resolveBattleIdForChant(chantId: string): Promise<string> {
  const normalizedChantId = normalizeUuid(chantId);
  if (!normalizedChantId) {
    return "";
  }

  const lookup = await supabaseServer
    .from("chants")
    .select("id, match_id, battle_id")
    .eq("id", normalizedChantId)
    .maybeSingle();

  if (lookup.error) {
    console.error("scoring/recordScoreEvent: failed to resolve battle id", {
      chantId: normalizedChantId,
      error: lookup.error,
    });
    return "";
  }

  const byMatchId = normalizeUuid(String(lookup.data?.match_id || ""));
  if (byMatchId) {
    return byMatchId;
  }

  return normalizeUuid(String(lookup.data?.battle_id || ""));
}

async function resolveWeight(eventType: UniversalScoreEventType): Promise<number> {
  const weightLookup = await supabaseServer
    .from("score_weights")
    .select("points")
    .eq("event_type", eventType)
    .maybeSingle();

  if (weightLookup.error) {
    console.error("scoring/recordScoreEvent: score weight lookup failed", {
      eventType,
      error: weightLookup.error,
    });
    return DEFAULT_SCORE_WEIGHTS[eventType];
  }

  const parsed = Number.parseInt(String(weightLookup.data?.points || ""), 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return DEFAULT_SCORE_WEIGHTS[eventType];
  }

  return parsed;
}

function toActorKeyForVote(metadata: Record<string, unknown>) {
  const fanId = String(metadata.fan_id || "").trim();
  if (fanId) {
    return `fan:${fanId}`;
  }

  const userId = String(metadata.user_id || "").trim();
  if (userId) {
    return `user:${userId}`;
  }

  const clientIp = String(metadata.client_ip || "").trim();
  if (clientIp) {
    return `ip:${clientIp}`;
  }

  return "";
}

function extractActorKeyFromRow(row: {
  user_id?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const rawUserId = String(row.user_id || "").trim();
  if (rawUserId) {
    return `user:${rawUserId}`;
  }

  if (!isObjectRecord(row.metadata)) {
    return "";
  }

  const fanId = String(row.metadata.fan_id || "").trim();
  if (fanId) {
    return `fan:${fanId}`;
  }

  const metadataUserId = String(row.metadata.user_id || "").trim();
  if (metadataUserId) {
    return `user:${metadataUserId}`;
  }

  const clientIp = String(row.metadata.client_ip || "").trim();
  if (clientIp) {
    return `ip:${clientIp}`;
  }

  return "";
}

async function hasExistingVoteForActor(
  chantId: string,
  actorKey: string,
): Promise<boolean> {
  const existingVotes = await supabaseServer
    .from("chant_score_events")
    .select("id, user_id, metadata")
    .eq("chant_id", chantId)
    .eq("event_type", "vote")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (existingVotes.error) {
    console.error("scoring/recordScoreEvent: vote dedupe lookup failed", {
      chantId,
      actorKey,
      error: existingVotes.error,
    });
    return false;
  }

  return ((existingVotes.data as Array<{ user_id?: string | null; metadata?: Record<string, unknown> | null }> | null) || []).some(
    (row) => extractActorKeyFromRow(row) === actorKey,
  );
}

async function refreshChantTotalScore(chantId: string): Promise<number | null> {
  const eventRows = await supabaseServer
    .from("chant_score_events")
    .select("value, points")
    .eq("chant_id", chantId);

  if (eventRows.error) {
    console.error("scoring/recordScoreEvent: chant total score aggregation failed", {
      chantId,
      error: eventRows.error,
    });
    return null;
  }

  const totalScore = (((eventRows.data as Array<Record<string, unknown>> | null) || [])).reduce(
    (sum, row) => {
      const parsed = Number.parseInt(String(row.value ?? row.points ?? 0), 10);
      return sum + (Number.isNaN(parsed) ? 0 : parsed);
    },
    0,
  );

  const updateResult = await supabaseServer
    .from("chants")
    .update({ total_score: totalScore })
    .eq("id", chantId);

  if (updateResult.error) {
    console.error("scoring/recordScoreEvent: chants.total_score update failed", {
      chantId,
      totalScore,
      error: updateResult.error,
    });
    return null;
  }

  return totalScore;
}

export async function recordScoreEvent(
  input: RecordScoreEventInput,
): Promise<RecordScoreEventResult> {
  const chantId = normalizeUuid(input.chantId);
  if (!chantId) {
    return {
      success: false,
      message: "Invalid chant id.",
    };
  }

  const eventType = String(input.eventType || "").trim().toLowerCase();
  if (!isUniversalScoreEventType(eventType)) {
    return {
      success: false,
      message: "Unsupported event type.",
    };
  }

  const metadata = normalizeMetadata(input.metadata);
  const battleId = normalizeUuid(input.battleId) || (await resolveBattleIdForChant(chantId));
  if (!battleId) {
    return {
      success: false,
      message: "Could not resolve battle id.",
    };
  }

  if (eventType === "vote") {
    const actorKey = toActorKeyForVote(metadata);
    if (!actorKey) {
      return {
        success: false,
        message: "Vote events require metadata.fan_id, metadata.user_id, or metadata.client_ip.",
      };
    }

    if (await hasExistingVoteForActor(chantId, actorKey)) {
      return {
        success: false,
        message: "User has already voted for this chant.",
      };
    }
  }

  const points = await resolveWeight(eventType);
  const userId = normalizeUuid(String(metadata.user_id || "")) || null;

  const insertResult = await supabaseServer
    .from("chant_score_events")
    .insert([
      {
        chant_id: chantId,
        battle_id: battleId,
        user_id: userId,
        event_type: eventType,
        source: normalizeSource(input.source),
        value: points,
        points,
        metadata,
      },
    ])
    .select("id")
    .maybeSingle();

  if (insertResult.error) {
    console.error("scoring/recordScoreEvent: insert failed", {
      chantId,
      battleId,
      eventType,
      error: insertResult.error,
    });
    return {
      success: false,
      message: "Could not record score event.",
    };
  }

  const totalScore = await refreshChantTotalScore(chantId);

  return {
    success: true,
    message: "Score event recorded.",
    eventId: insertResult.data?.id ? String(insertResult.data.id) : undefined,
    points,
    totalScore: typeof totalScore === "number" ? totalScore : undefined,
  };
}
