import "server-only";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type ThoughtInput = {
  basis_id?: string;
  title: string;
  body: string;
  category: string;
};

type ValidationResult =
  | { ok: true; data: ThoughtInput }
  | { ok: false; error: string };

const allowedKeys = new Set(["basis_id", "title", "body", "category"]);
const allowedStatuses = new Set(["draft", "active", "archived"]);
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, field: string) {
  if (typeof value !== "string") {
    return { ok: false, error: `Field "${field}" must be a string.` } as const;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      error: `Field "${field}" must be a non-empty string.`,
    } as const;
  }
  return { ok: true, value: trimmed } as const;
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

  const title = requireNonEmptyString(body.title, "title");
  if (!title.ok) {
    return { ok: false, error: title.error };
  }

  const bodyValue = requireNonEmptyString(body.body, "body");
  if (!bodyValue.ok) {
    return { ok: false, error: bodyValue.error };
  }

  const category = requireNonEmptyString(body.category, "category");
  if (!category.ok) {
    return { ok: false, error: category.error };
  }

  if (body.basis_id !== undefined) {
    if (typeof body.basis_id !== "string" || !isUuid(body.basis_id)) {
      return { ok: false, error: "Field \"basis_id\" must be a UUID." };
    }
  }

  return {
    ok: true,
    data: {
      basis_id: body.basis_id,
      title: title.value,
      body: bodyValue.value,
      category: category.value,
    },
  };
}

function normalizeQueryParam(value: string | null, name: string) {
  if (value === null) {
    return { ok: true, value: undefined } as const;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: `Query "${name}" must be a non-empty string.` } as const;
  }
  return { ok: true, value: trimmed } as const;
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
  const insertPayload: {
    basis_id?: string;
    title: string;
    body: string;
    category: string;
    status: "draft";
  } = {
    title: validation.data.title,
    body: validation.data.body,
    category: validation.data.category,
    status: "draft",
  };

  if (validation.data.basis_id) {
    insertPayload.basis_id = validation.data.basis_id;
  }

  const { data, error } = await supabase
    .from("personal_thoughts")
    .insert(insertPayload)
    .select("id, status")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Failed to create thought." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { id: data.id, status: data.status },
    { status: 201 }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const statusParam = normalizeQueryParam(url.searchParams.get("status"), "status");
  if (!statusParam.ok) {
    return NextResponse.json(
      { ok: false, error: statusParam.error },
      { status: 400 }
    );
  }

  const categoryParam = normalizeQueryParam(
    url.searchParams.get("category"),
    "category"
  );
  if (!categoryParam.ok) {
    return NextResponse.json(
      { ok: false, error: categoryParam.error },
      { status: 400 }
    );
  }

  const statusValue = statusParam.value ?? "draft";
  if (!allowedStatuses.has(statusValue)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Query "status" must be one of: draft, active, archived.',
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  let query = supabase
    .from("personal_thoughts")
    .select(
      "id,basis_id,title,body,category,status,strength_score,created_at,updated_at"
    )
    .eq("status", statusValue)
    .order("created_at", { ascending: false });

  if (categoryParam.value) {
    query = query.eq("category", categoryParam.value);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: data ?? [] }, { status: 200 });
}
