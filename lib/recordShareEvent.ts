import "server-only";

import { recordScoreEvent } from "@/lib/recordScoreEvent";

export const SHARE_SOURCES = ["whatsapp", "tiktok", "twitter", "instagram"] as const;

export type ShareSource = (typeof SHARE_SOURCES)[number];

export function isShareSource(value: string): value is ShareSource {
  return SHARE_SOURCES.includes(value as ShareSource);
}

export async function recordShareEvent(
  chantId: string,
  source: ShareSource,
  input?: {
    battleId?: string;
    userId?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  return recordScoreEvent({
    chantId,
    battleId: input?.battleId,
    userId: input?.userId,
    eventType: "share",
    source,
    metadata: input?.metadata,
  });
}
