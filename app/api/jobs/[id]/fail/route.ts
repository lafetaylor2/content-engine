import "server-only";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type FailRequestBody = {
  error: string;
};

type ValidationResult =
  | { ok: true; data: FailRequestBody }
  | { ok: false; error: string };

const allowedKeys = new Set(["error"]);
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

  const errorValue = body.error;
  if (typeof errorValue !== "string" || errorValue.trim().length === 0) {
    return { ok: false, error: "Field \"error\" must be a non-empty string." };
  }

  return { ok: true, data: { error: errorValue.trim() } };
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
      status: "failed",
      completed_at: new Date().toISOString(),
      result: null,
      error: validation.data.error,
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
