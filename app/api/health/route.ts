import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const timestamp = new Date().toISOString();
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.storage.listBuckets();

  if (error) {
    return NextResponse.json(
      { ok: false, supabase: "error", timestamp },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    supabase: "connected",
    timestamp,
  });
}
