import { NextResponse, type NextRequest } from "next/server";

function normalizeHost(host: string) {
  return host.toLowerCase().replace(/^www\./, "").trim();
}

export function middleware(req: NextRequest) {
  // Vercel commonly sends the real domain here:
  const forwarded = req.headers.get("x-forwarded-host");
  const host = normalizeHost(forwarded ?? req.headers.get("host") ?? "");

  const brand =
    host.includes("battlesleague") ? "battleleague" : "chantleague";

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-brand", brand);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|robots.txt|sitemap.xml).*)"],
};