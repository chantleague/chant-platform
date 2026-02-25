// app/lib/getBrand.ts
import { headers } from "next/headers";
import { brands, type Brand } from "../brand-config";

export async function getBrand(): Promise<Brand> {
  const h = await headers();

  const key = (h.get("x-brand") || "").toLowerCase();

  if (key === "battlesleague") return brands.battlesleague;
  return brands.chantleague;
}