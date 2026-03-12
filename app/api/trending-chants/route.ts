import { NextRequest, NextResponse } from "next/server";
import { getTrendingChants, getTrendingChantsFromCache } from "@/lib/trending/getTrendingChants";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const limit = Number.isNaN(rawLimit) ? 20 : Math.max(1, Math.min(rawLimit, 50));

  const cached = await getTrendingChantsFromCache({
    limit,
  });

  if (cached.length > 0) {
    return NextResponse.json(
      {
        chants: cached,
      },
      { status: 200 },
    );
  }

  const fallback = await getTrendingChants({
    limit,
    useCache: false,
  });

  return NextResponse.json(
    {
      chants: fallback,
    },
    { status: 200 },
  );
}
