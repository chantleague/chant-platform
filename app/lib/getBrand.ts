import { headers } from "next/headers";
import { brands, type Brand, type BrandKey } from "../brand-config";

export async function getBrand(): Promise<Brand> {
  const h = await headers();

  // Prefer middleware-set header (best)
  const headerKey = (h.get("x-brand") || "").toLowerCase() as BrandKey;
  if (headerKey && headerKey in brands) return brands[headerKey];

  // Fallback: detect via host
  const host = (h.get("x-forwarded-host") || h.get("host") || "").toLowerCase();

  if (host.includes("battlesleague")) return brands.battlesleague;
  if (host.includes("chantleague")) return brands.chantleague;

  // Safety fallback
  return brands.chantleague;
}