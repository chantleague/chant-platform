import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const HOST_TO_BRAND: Record<string, "chantleague" | "battlesleague"> = {
  "chantleague.com": "chantleague",
  "www.chantleague.com": "chantleague",
  "battlesleague.com": "battlesleague",
  "www.battlesleague.com": "battlesleague",
};

function getBrandFromHostname(hostname: string): "chantleague" | "battlesleague" {
  const normalizedHost = hostname.toLowerCase().split(":")[0];
  return HOST_TO_BRAND[normalizedHost] ?? "chantleague";
}

export function middleware(req: NextRequest) {
  // Only redirect exact /battle to /battles. Allow all other /battle/* routes to proceed.
  const pathname = req.nextUrl.pathname;
  if (pathname === "/battle" || pathname === "/battle/") {
    const dest = new URL("/battles", req.url);
    return NextResponse.redirect(dest);
  }

  const hostname =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    req.nextUrl.hostname ||
    "";

  const brand = getBrandFromHostname(hostname);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-brand", brand);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
