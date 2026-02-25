import { NextRequest, NextResponse } from "next/server";

function normalizeHost(host: string) {
    const h = (host || "").toLowerCase().split(":")[0]; // remove port
    return h.startsWith("www.") ? h.slice(4) : h;        // remove www.
  }


function resolveBrandFromHost(hostname: string) {
  if (hostname === "chantleague.com") return "chantleague";
  if (hostname === "chantleague.co.uk") return "chantleague";

  if (hostname === "battlesleague.com") return "battleleague";
if (hostname === "battlesleague.co.uk") return "battleleague";

  return "chantleague";
}

export function middleware(req: NextRequest) {
    const rawHost =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "";

  const hostHeader = rawHost.split(",")[0].trim();
  const hostname = normalizeHost(hostHeader);

  const brand = resolveBrandFromHost(hostname);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-brand", brand);

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });

  res.headers.set("x-debug-host", hostname);
  res.headers.set("x-debug-brand", brand);

  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};