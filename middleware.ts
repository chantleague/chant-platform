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
  const hostHeader = req.headers.get("host") ?? "";
  const hostname = normalizeHost(hostHeader);

  const brand = resolveBrandFromHost(hostname);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-brand", brand);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};