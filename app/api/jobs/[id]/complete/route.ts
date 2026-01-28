import "server-only";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type CompleteRequestBody = {
  result: Record<string, unknown>;
};

type ValidationResult =
  | { ok: true; data: CompleteRequestBody }
  | { ok: false; error: string };

const allowedKeys = new Set(["result"]);
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return uuidRegex.test(value);
}

function validateBody(body: unknown): ValidationResult {
  if (!isPlainObject(body)) {
    return { ok: false, error: "Body must be a JSON object." };
  }

  const keys = Object.keys(body);
  const unknownKeys = keys.filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      error: `Unexpected fields: ${unknownKeys.sort().join(", ")}.`,
    };
  }

  const resultValue = body.result;
  if (!isPlainObject(resultValue)) {
    return { ok: false, error: "Field \"result\" must be a JSON object." };
  }

  return { ok: true, data: { result: resultValue } };
}

async function ensureProcessingStatus(id: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_jobs")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, error: "Job not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: `Job status is "${data.status}". Expected "processing".`,
    },
    { status: 409 }
  );
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (!isUuid(id)) {
    return NextResponse.json(
      { ok: false, error: "Invalid job id." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const validation = validateBody(body);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: validation.error },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      result: validation.data.result,
      error: null,
    })
    .eq("id", id)
    .eq("status", "processing")
    .select("id");

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  if (!data || data.length === 0) {
    return ensureProcessingStatus(id);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
