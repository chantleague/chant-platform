const NON_FAN_CHANT_PATTERNS = [
  /\bcodex\b/i,
  /\bfallback\b/i,
  /\bverify\b/i,
  /\bdebug\b/i,
  /\bsmoke\s*test\b/i,
  /\bplaceholder\b/i,
];

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim();
}

export function isLikelySeedOrDebugChant(...values: Array<string | null | undefined>) {
  const merged = values
    .map((value) => normalizeText(value))
    .filter((value) => Boolean(value))
    .join(" ");

  if (!merged) {
    return false;
  }

  return NON_FAN_CHANT_PATTERNS.some((pattern) => pattern.test(merged));
}

export function toRenderableChantText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized && !isLikelySeedOrDebugChant(normalized)) {
      return normalized;
    }
  }

  return "";
}
