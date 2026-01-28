import "server-only";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type ClaimRequestBody = {
  worker_id: string;
};

type ValidationResult =
  | { ok: true; data: ClaimRequestBody }
  | { ok: false; error: string };

const allowedKeys = new Set(["worker_id"]);

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

  const workerIdValue = body.worker_id;
  if (typeof workerIdValue !== "string" || workerIdValue.trim().length === 0) {
    return {
      ok: false,
      error: "Field \"worker_id\" must be a non-empty string.",
    };
  }

  return {
    ok: true,
    data: { worker_id: workerIdValue.trim() },
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
  const { data, error } = await supabase.rpc("claim_next_job", {
    worker_id: validation.data.worker_id,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(data, { status: 200 });
}
