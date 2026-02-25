import { headers } from "next/headers";
import { brands, type Brand } from "../brand-config";

export function getBrand(): Brand {
  const h = headers();
  const key = (h.get("x-brand") || "").toLowerCase();

  if (key === "battlesleague") return brands.battlesleague;
  if (key === "chantleague") return brands.chantleague;

  return brands.chantleague; // fallback
}