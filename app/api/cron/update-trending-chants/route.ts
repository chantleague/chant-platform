import { NextResponse } from "next/server";
import { updateTrendingChantsCache } from "@/lib/trending/getTrendingChants";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await updateTrendingChantsCache({
    cacheSize: 50,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        message: result.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: result.message,
      updated: result.updated,
    },
    { status: 200 },
  );
}
