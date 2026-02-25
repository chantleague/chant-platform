import { headers } from "next/headers";
import { brands } from "../brand-config";

function pickBrandFromHost(hostRaw: string | null) {
  const host = (hostRaw || "").toLowerCase().replace(/^www\./, "");

  // ✅ map your domains to brands here
  if (host === "battlesleague.com") return brands["battleleague"];
  if (host === "chantleague.com") return brands["chantleague"];
  if (host === "chantleague.co.uk") return brands["chantleague"];

  // fallback
  return brands["chantleague"];
}

export function getBrand() {
  const h = headers();

  // these are the common host headers you’ll see on Vercel
  const host =
    h.get("x-forwarded-host") ||
    h.get("host") ||
    h.get("x-vercel-deployment-url") ||
    "";

  return pickBrandFromHost(host);
}