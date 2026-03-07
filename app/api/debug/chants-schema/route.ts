import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/app/lib/supabaseServer";

export async function GET() {
  const sampleResponse = await supabase
    .from("chants")
    .select("*")
    .limit(1);

  if (sampleResponse.error) {
    return NextResponse.json(
      {
        error: sampleResponse.error.message,
        details: sampleResponse.error.details,
        code: sampleResponse.error.code,
      },
      { status: 500 },
    );
  }

  const sampleRow = (sampleResponse.data || [])[0] as Record<string, unknown> | undefined;
  const sampleKeys = sampleRow ? Object.keys(sampleRow) : [];

  const countResponse = await supabase
    .from("chants")
    .select("id", { count: "exact", head: true });

  return NextResponse.json(
    {
      totalRows: countResponse.count ?? null,
      sampleKeys,
      sampleRow,
      countError: countResponse.error ? countResponse.error.message : null,
    },
    { status: 200 },
  );
}
