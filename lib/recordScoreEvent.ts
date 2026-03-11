import "server-only";

import { supabaseServer } from "@/app/lib/supabaseServer";
import { SCORING_RULES, type ScoreEventType } from "@/lib/scoringRules";

type RawRow = Record<string, unknown>;

type ScoreSnapshot = {
  total_points: number;
  vote_points: number;
  share_points: number;
  comment_points: number;
  remix_points: number;
  invite_points: number;
  stream_points: number;
  download_points: number;
  boost_points: number;
};

export interface RecordScoreEventInput {
  chantId: string;
  battleId?: string;
  userId?: string | null;
  eventType: ScoreEventType;
  source?: string;
  metadata?: Record<string, unknown> | null;
}

export interface RecordScoreEventResult {
  success: boolean;
  message: string;
  eventId?: string;
  points?: number;
  chantScore?: ScoreSnapshot;
  battleScore?: number | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingColumnError(errorMessage: string, columnName: string) {
  if (!errorMessage) {
    return false;
  }

  const escapedColumn = columnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(column .*${escapedColumn}.* does not exist|Could not find the '${escapedColumn}' column)`, "i").test(
    errorMessage,
  );
}

function toSafeErrorLog(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error || "unknown") };
  }

  const maybeError = error as { message?: string; code?: string; details?: string; hint?: string };
  return {
    message: maybeError.message || "unknown",
    code: maybeError.code,
    details: maybeError.details,
    hint: maybeError.hint,
  };
}

function normalizeUuid(value?: string | null): string | null {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return null;
  }

  return UUID_PATTERN.test(candidate) ? candidate : null;
}

function normalizeSource(value?: string): string {
  const source = String(value || "").trim().toLowerCase();
  return source || "web";
}

function normalizeMetadata(value?: Record<string, unknown> | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function toScoreSnapshot(data?: RawRow | null): ScoreSnapshot {
  const toInt = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    const parsed = Number.parseInt(String(value || ""), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  return {
    total_points: toInt(data?.total_points),
    vote_points: toInt(data?.vote_points),
    share_points: toInt(data?.share_points),
    comment_points: toInt(data?.comment_points),
    remix_points: toInt(data?.remix_points),
    invite_points: toInt(data?.invite_points),
    stream_points: toInt(data?.stream_points),
    download_points: toInt(data?.download_points),
    boost_points: toInt(data?.boost_points),
  };
}

export async function resolveBattleIdForChant(chantId: string): Promise<string | null> {
  const normalizedChantId = normalizeUuid(chantId);
  if (!normalizedChantId) {
    return null;
  }

  const chantLookup = await supabaseServer
    .from("chants")
    .select("id, match_id, battle_id")
    .eq("id", normalizedChantId)
    .maybeSingle();

  if (chantLookup.error && isMissingColumnError(chantLookup.error.message || "", "match_id")) {
    const legacyLookup = await supabaseServer
      .from("chants")
      .select("id, battle_id")
      .eq("id", normalizedChantId)
      .maybeSingle();

    if (legacyLookup.error) {
      console.error("recordScoreEvent: legacy chant lookup failed", toSafeErrorLog(legacyLookup.error));
      return null;
    }

    if (!legacyLookup.data?.id) {
      return null;
    }

    const legacyBattleId = normalizeUuid(String(legacyLookup.data.battle_id || ""));
    return legacyBattleId;
  }

  if (chantLookup.error) {
    console.error("recordScoreEvent: chant lookup failed", toSafeErrorLog(chantLookup.error));
    return null;
  }

  if (!chantLookup.data?.id) {
    return null;
  }

  const fromMatch = normalizeUuid(String(chantLookup.data.match_id || ""));
  if (fromMatch) {
    return fromMatch;
  }

  return normalizeUuid(String(chantLookup.data.battle_id || ""));
}

async function readChantScoreSnapshot(chantId: string): Promise<ScoreSnapshot | null> {
  const scoreLookup = await supabaseServer
    .from("chant_scores")
    .select(
      "total_points, vote_points, share_points, comment_points, remix_points, invite_points, stream_points, download_points, boost_points",
    )
    .eq("chant_id", chantId)
    .maybeSingle();

  if (scoreLookup.error) {
    console.error("recordScoreEvent: score lookup failed", toSafeErrorLog(scoreLookup.error));
    return null;
  }

  return toScoreSnapshot((scoreLookup.data as RawRow | null) || null);
}

async function persistBattleScore(battleId: string, score: number) {
  const updateBattleScore = await supabaseServer
    .from("matches")
    .update({ engagement_score: score })
    .eq("id", battleId);

  if (updateBattleScore.error && !isMissingColumnError(updateBattleScore.error.message || "", "engagement_score")) {
    console.error("recordScoreEvent: engagement score update failed", toSafeErrorLog(updateBattleScore.error));
  }
}

export async function recalculateBattleScore(battleId: string): Promise<number | null> {
  const normalizedBattleId = normalizeUuid(battleId);
  if (!normalizedBattleId) {
    return null;
  }

  const chantIds = new Set<string>();

  const byMatchId = await supabaseServer
    .from("chants")
    .select("id")
    .eq("match_id", normalizedBattleId);

  if (byMatchId.error && !isMissingColumnError(byMatchId.error.message || "", "match_id")) {
    console.error("recordScoreEvent: match-based chant lookup failed", toSafeErrorLog(byMatchId.error));
    return null;
  }

  (((byMatchId.data as RawRow[] | null) || [])).forEach((row) => {
    const chantId = normalizeUuid(String(row.id || ""));
    if (chantId) {
      chantIds.add(chantId);
    }
  });

  const byBattleId = await supabaseServer
    .from("chants")
    .select("id")
    .eq("battle_id", normalizedBattleId);

  if (byBattleId.error && !isMissingColumnError(byBattleId.error.message || "", "battle_id")) {
    console.error("recordScoreEvent: legacy battle-based chant lookup failed", toSafeErrorLog(byBattleId.error));
    return null;
  }

  (((byBattleId.data as RawRow[] | null) || [])).forEach((row) => {
    const chantId = normalizeUuid(String(row.id || ""));
    if (chantId) {
      chantIds.add(chantId);
    }
  });

  const chantIdList = Array.from(chantIds);
  if (chantIdList.length === 0) {
    await persistBattleScore(normalizedBattleId, 0);
    return 0;
  }

  const scoreRows = await supabaseServer
    .from("chant_scores")
    .select("chant_id, total_points")
    .in("chant_id", chantIdList);

  if (scoreRows.error) {
    console.error("recordScoreEvent: battle score aggregation failed", toSafeErrorLog(scoreRows.error));
    return null;
  }

  const totalBattleScore = (((scoreRows.data as RawRow[] | null) || [])).reduce((sum, row) => {
    const nextScore = Number.parseInt(String(row.total_points || 0), 10);
    return sum + (Number.isNaN(nextScore) ? 0 : nextScore);
  }, 0);

  await persistBattleScore(normalizedBattleId, totalBattleScore);

  return totalBattleScore;
}

export async function recordScoreEvent({
  chantId,
  battleId,
  userId,
  eventType,
  source,
  metadata,
}: RecordScoreEventInput): Promise<RecordScoreEventResult> {
  const normalizedChantId = normalizeUuid(chantId);
  if (!normalizedChantId) {
    return {
      success: false,
      message: "Invalid chant id.",
    };
  }

  const points = SCORING_RULES[eventType];
  const resolvedBattleId = normalizeUuid(battleId) || (await resolveBattleIdForChant(normalizedChantId));

  if (!resolvedBattleId) {
    return {
      success: false,
      message: "Could not resolve battle id for chant score event.",
    };
  }

  const normalizedUserId = normalizeUuid(userId);

  const insertResult = await supabaseServer
    .from("chant_score_events")
    .insert([
      {
        chant_id: normalizedChantId,
        battle_id: resolvedBattleId,
        user_id: normalizedUserId,
        event_type: eventType,
        points,
        source: normalizeSource(source),
        metadata: normalizeMetadata(metadata),
      },
    ])
    .select("id")
    .maybeSingle();

  if (insertResult.error) {
    console.error("recordScoreEvent: event insert failed", {
      chantId: normalizedChantId,
      battleId: resolvedBattleId,
      eventType,
      error: toSafeErrorLog(insertResult.error),
    });

    return {
      success: false,
      message: "Could not record score event.",
    };
  }

  const [chantScore, battleScore] = await Promise.all([
    readChantScoreSnapshot(normalizedChantId),
    recalculateBattleScore(resolvedBattleId),
  ]);

  return {
    success: true,
    message: "Score event recorded.",
    eventId: insertResult.data?.id ? String(insertResult.data.id) : undefined,
    points,
    chantScore: chantScore || undefined,
    battleScore,
  };
}

export async function recordSponsorBoostEvent(input: {
  chantId: string;
  battleId?: string;
  userId?: string | null;
  source?: string;
  metadata?: Record<string, unknown> | null;
}) {
  return recordScoreEvent({
    chantId: input.chantId,
    battleId: input.battleId,
    userId: input.userId,
    eventType: "boost",
    source: input.source,
    metadata: input.metadata,
  });
}

export async function recordInviteScoreEvent(input: {
  chantId: string;
  battleId?: string;
  userId?: string | null;
  source?: string;
  metadata?: Record<string, unknown> | null;
}) {
  return recordScoreEvent({
    chantId: input.chantId,
    battleId: input.battleId,
    userId: input.userId,
    eventType: "invite",
    source: input.source,
    metadata: input.metadata,
  });
}
