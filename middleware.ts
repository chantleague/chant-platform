import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {

  const host = request.headers.get("host") || "";

  let brand = "chantleague";

  if (host.includes("battlesleague")) {
    brand = "battleleague";
  }

  const response = NextResponse.next();

  response.headers.set("x-brand", brand);

  return response;
}

export const config = {
  matcher: "/:path*",
};