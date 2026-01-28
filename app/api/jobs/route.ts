import "server-only";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {

  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  if (process.env.VERCEL && !isVercelCron) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }


type JobRequestBody = {
  type: string;
  payload: Record<string, unknown>;
};

type ValidationResult =
  | { ok: true; data: JobRequestBody }
  | { ok: false; error: string };

const allowedKeys = new Set(["type", "payload"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

  const typeValue = body.type;
  if (typeof typeValue !== "string" || typeValue.trim().length === 0) {
    return { ok: false, error: "Field \"type\" must be a non-empty string." };
  }

  const payloadValue = body.payload;
  if (!isPlainObject(payloadValue)) {
    return { ok: false, error: "Field \"payload\" must be a JSON object." };
  }

  return {
    ok: true,
    data: {
      type: typeValue.trim(),
      payload: payloadValue,
    },
  };
}

export async function POST(request: Request) {
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
    .insert({
      type: validation.data.type,
      payload: validation.data.payload,
    })
    .select("id, status")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Failed to create job." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { job_id: data.id, status: data.status },
    { status: 201 }
  );
}
