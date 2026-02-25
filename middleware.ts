// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function pickBrand(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, "");

  if (host.includes("battlesleague") || host.includes("battleleague")) {
    return "battlesleague";
  }

  // default
  return "chantleague";
}

export function middleware(req: NextRequest) {
  const hostname =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    req.nextUrl.hostname ||
    "";

  const brand = pickBrand(hostname);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-brand", brand);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

// Run middleware on all routes
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};