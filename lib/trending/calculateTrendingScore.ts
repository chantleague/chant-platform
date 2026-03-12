export interface TrendingScoreInput {
  totalScore: number;
  shares: number;
  videoPlays: number;
  createdAt?: string | null;
  nowMs?: number;
}

const RECENCY_WINDOW_MS = 48 * 60 * 60 * 1000;

function toInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toTimestamp(value?: string | null): number {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return 0;
  }

  const timestamp = new Date(normalized).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function calculateTrendingScore(input: TrendingScoreInput): number {
  const totalScore = Math.max(0, toInt(input.totalScore));
  const shares = Math.max(0, toInt(input.shares));
  const videoPlays = Math.max(0, toInt(input.videoPlays));

  const baseScore = totalScore * 0.6 + shares * 0.2 + videoPlays * 0.1;

  const nowMs = typeof input.nowMs === "number" && Number.isFinite(input.nowMs)
    ? input.nowMs
    : Date.now();
  const createdAtMs = toTimestamp(input.createdAt);
  const hasRecencyBoost = createdAtMs > 0 && nowMs - createdAtMs <= RECENCY_WINDOW_MS;

  const recencyBoost = hasRecencyBoost ? baseScore * 0.2 : 0;

  return Math.round((baseScore + recencyBoost) * 100) / 100;
}
