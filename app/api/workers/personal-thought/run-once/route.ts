import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = getSupabaseServerClient();

  try {
    const body = await req.json().catch(() => ({}));
    const worker_id =
      typeof body.worker_id === "string" && body.worker_id.length > 0
        ? body.worker_id
        : "local-worker";

    // 1. Claim one job (RPC ALWAYS returns an array)
    const { data: claimedJobs, error: claimError } = await supabase.rpc(
      "claim_next_job",
      { worker_id }
    );

    if (claimError) {
      throw claimError;
    }

    // No jobs available
    if (
      !claimedJobs ||
      !Array.isArray(claimedJobs) ||
      claimedJobs.length === 0
    ) {
      return new Response(null, { status: 204 });
    }

    const job = claimedJobs[0];

    if (!job.id) {
      throw new Error("Claimed job has an invalid id.");
    }

    // 2. Fetch the oldest approved basis entry
    const { data: basisEntries, error: basisError } = await supabase
      .from("basis_entries")
      .select("*")
      .eq("approved", true)
      .order("created_at", { ascending: true })
      .limit(1);

    if (basisError) {
      throw basisError;
    }

    if (!basisEntries || basisEntries.length === 0) {
      await supabase
        .from("content_jobs")
        .update({
          status: "failed",
          error: "No approved basis entries available.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return NextResponse.json({
        ok: false,
        error: "No approved basis entries available.",
        job_id: job.id,
      });
    }

    const basis = basisEntries[0];

    // 3. Create placeholder draft thought
    const title = `Draft thought on ${basis.theme ?? "general"}`;
    const bodyText = `This thought is derived from the following basis:\n\n${basis.source_text}`;

    const { data: thought, error: thoughtError } = await supabase
    .from("personal_thoughts")
    .insert({
      title,
      body: bodyText,
      category: basis.theme ?? "general",
      status: "draft",
      basis_id: basis.id,
    })
    .select("id")
    .single();


    if (thoughtError) {
      throw thoughtError;
    }

    // 4. Mark job completed
    await supabase
      .from("content_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return NextResponse.json({
      ok: true,
      job_id: job.id,
      thought_id: thought.id,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
