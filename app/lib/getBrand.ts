import { headers } from "next/headers";
import { brands, type Brand } from "../brand-config";

export function getBrand(): Brand {
  const h = headers();

  // Set by middleware
  const brandKey = h.get("x-brand");
  if (brandKey === "battleleague") return brands.battleleague;
  if (brandKey === "chantleague") return brands.chantleague;

  // Fallback safety
  return brands.chantleague;
}