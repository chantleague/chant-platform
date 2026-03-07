import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/app/lib/supabaseServer";

export async function GET() {
  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name, data_type, is_nullable, ordinal_position")
    .eq("table_schema", "public")
    .eq("table_name", "chants")
    .order("ordinal_position", { ascending: true });

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        details: error.details,
        code: error.code,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ columns: data || [] }, { status: 200 });
}
