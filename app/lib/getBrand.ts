import "server-only";
import { headers } from "next/headers";
import { brands, BrandKey } from "@/brand-config";

export function getBrand() {
  const h = headers();
  const key = (h.get("x-brand") || "chantleague") as BrandKey;
  return brands[key] ?? brands.chantleague;
}