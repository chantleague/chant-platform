import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const syncUrl = new URL("/api/sync-fixtures", request.nextUrl.origin);
    const response = await fetch(syncUrl.toString(), {
      method: "GET",
      cache: "no-store",
      headers: {
        "x-cron-job": "sync-fixtures",
      },
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "Fixture sync failed.",
          upstreamStatus: response.status,
          upstream: payload,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Fixture sync completed.",
        upstream: payload,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("api/cron/sync-fixtures: sync invocation failed", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not trigger fixture sync.",
      },
      { status: 500 },
    );
  }
}
