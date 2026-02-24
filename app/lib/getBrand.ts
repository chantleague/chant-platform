import { headers } from "next/headers";
import { brands } from "../brand-config";

export async function getBrand() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "chantleague.com";

  if (host.includes("battleleague")) return brands.battleleague;
  return brands.chantleague;
}

