import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function normalizeHost(host: string) {
  return host.replace(/^https?:\/\//, "").replace(/^www\./, "").split(":")[0].toLowerCase();
}

export function middleware(req: NextRequest) {
  const host = normalizeHost(req.headers.get("host") || "");

  const res = NextResponse.next();

  // Domain → brand mapping
  if (host === "battlesleague.com") {
    res.headers.set("x-brand", "battlesleague");
  } else {
    // chantleague.com, chantleague.co.uk, anything else
    res.headers.set("x-brand", "chantleague");
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|assets|api).*)"],
};