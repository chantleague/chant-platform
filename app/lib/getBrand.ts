// app/lib/getBrand.ts

import { headers } from "next/headers";
import { brands, type Brand, type BrandKey } from "../brand-config";

function normalizeHost(host: string) {
  return host
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/:\d+$/, "") // remove :3000 etc
    .replace(/^www\./, "");
}

function brandFromHost(host: string): BrandKey {
  const h = normalizeHost(host);

  // ✅ Chant League domains
  if (
    h === "chantleague.com" ||
    h === "chantleague.co.uk" ||
    h === "chantleague.uk"
  ) {
    return "chantleague";
  }

  // ✅ Battle League domains
  if (h === "battlesleague.com" || h === "battlesleague.co.uk") {
    return "battlesleague";
  }

  // ✅ Fallback for previews / unknown host
  // You can default to Chant League to be safe
  return "chantleague";
}

/**
 * Returns the current brand based on:
 * 1) optional override via searchParams.brand (for local testing)
 * 2) otherwise host header
 */
export function getBrand(overrideBrand?: string | null): Brand {
  if (overrideBrand === "chantleague" || overrideBrand === "battlesleague") {
    return brands[overrideBrand];
  }

  const host = headers().get("host") || "";
  const key = brandFromHost(host);
  return brands[key];
}
