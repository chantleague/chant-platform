import "server-only";

import { supabaseServer } from "@/app/lib/supabaseServer";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface BattleScoreRow {
  chant_id: string;
  total_score: number;
  event_breakdown: Record<string, number>;
}

type EventRow = {
  chant_id?: string;
  event_type?: string;
  source?: string;
  value?: number;
  points?: number;
};

function normalizeUuid(value?: string | null): string {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return "";
  }

  return UUID_PATTERN.test(candidate) ? candidate : "";
}

function toInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeEventType(eventType: string, source: string) {
  const normalizedType = String(eventType || "").trim().toLowerCase();
  const normalizedSource = String(source || "").trim().toLowerCase();

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

export async function getBattleScores(battleId: string): Promise<BattleScoreRow[]> {
  const normalizedBattleId = normalizeUuid(battleId);
  if (!normalizedBattleId) {
    return [];
  }

  const eventRows = await supabaseServer
    .from("chant_score_events")
    .select("chant_id, event_type, source, value, points")
    .eq("battle_id", normalizedBattleId);

  if (eventRows.error) {
    console.error("scoring/getBattleScores: failed to fetch chant score events", {
      battleId: normalizedBattleId,
      error: eventRows.error,
    });
    return [];
  }

  const byChantId = new Map<string, BattleScoreRow>();

  (((eventRows.data as EventRow[] | null) || [])).forEach((row) => {
    const chantId = normalizeUuid(String(row.chant_id || ""));
    if (!chantId) {
      return;
    }

    const normalizedEventType = normalizeEventType(
      String(row.event_type || ""),
      String(row.source || ""),
    );

    if (!normalizedEventType) {
      return;
    }

    const current = byChantId.get(chantId) || {
      chant_id: chantId,
      total_score: 0,
      event_breakdown: {},
    };

    const scoreDelta = toInt(row.value ?? row.points ?? 0);
    current.total_score += scoreDelta;
    current.event_breakdown[normalizedEventType] =
      toInt(current.event_breakdown[normalizedEventType]) + 1;

    byChantId.set(chantId, current);
  });

  return Array.from(byChantId.values()).sort((left, right) => {
    if (right.total_score !== left.total_score) {
      return right.total_score - left.total_score;
    }

    return left.chant_id.localeCompare(right.chant_id);
  });
}
