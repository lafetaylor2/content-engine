import "server-only";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type BasisEntryInput = {
  basis_type: string;
  reference: string;
  source_text: string;
  theme: string;
  angle?: string | null;
  notes?: string | null;
  approved?: boolean;
  source_link?: string | null;
};

type ValidationResult =
  | { ok: true; data: BasisEntryInput }
  | { ok: false; error: string };

const allowedKeys = new Set([
  "basis_type",
  "reference",
  "source_text",
  "theme",
  "angle",
  "notes",
  "approved",
  "source_link",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown, field: string) {
  if (value === undefined) {
    return { ok: true, value: undefined } as const;
  }
  if (value === null) {
    return { ok: true, value: null } as const;
  }
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

  const basisType = requireNonEmptyString(body.basis_type, "basis_type");
  if (!basisType.ok) {
    return { ok: false, error: basisType.error };
  }

  const reference = requireNonEmptyString(body.reference, "reference");
  if (!reference.ok) {
    return { ok: false, error: reference.error };
  }

  const sourceText = requireNonEmptyString(body.source_text, "source_text");
  if (!sourceText.ok) {
    return { ok: false, error: sourceText.error };
  }

  const theme = requireNonEmptyString(body.theme, "theme");
  if (!theme.ok) {
    return { ok: false, error: theme.error };
  }

  const angle = normalizeOptionalString(body.angle, "angle");
  if (!angle.ok) {
    return { ok: false, error: angle.error };
  }

  const notes = normalizeOptionalString(body.notes, "notes");
  if (!notes.ok) {
    return { ok: false, error: notes.error };
  }

  const sourceLink = normalizeOptionalString(body.source_link, "source_link");
  if (!sourceLink.ok) {
    return { ok: false, error: sourceLink.error };
  }

  const approvedValue = body.approved;
  if (approvedValue !== undefined && typeof approvedValue !== "boolean") {
    return { ok: false, error: "Field \"approved\" must be a boolean." };
  }

  return {
    ok: true,
    data: {
      basis_type: basisType.value,
      reference: reference.value,
      source_text: sourceText.value,
      theme: theme.value,
      angle: angle.value,
      notes: notes.value,
      approved: approvedValue,
      source_link: sourceLink.value,
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
  const { data, error } = await supabase
    .from("basis_entries")
    .insert(validation.data)
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Failed to create basis entry." },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const theme = normalizeQueryParam(url.searchParams.get("theme"), "theme");
  if (!theme.ok) {
    return NextResponse.json(
      { ok: false, error: theme.error },
      { status: 400 }
    );
  }

  const basisType = normalizeQueryParam(
    url.searchParams.get("basis_type"),
    "basis_type"
  );
  if (!basisType.ok) {
    return NextResponse.json(
      { ok: false, error: basisType.error },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  let query = supabase
    .from("basis_entries")
    .select(
      "id,basis_type,reference,source_text,theme,angle,notes,approved,source_link,created_at,updated_at"
    )
    .eq("approved", true)
    .order("created_at", { ascending: true });

  if (theme.value) {
    query = query.eq("theme", theme.value);
  }

  if (basisType.value) {
    query = query.eq("basis_type", basisType.value);
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
