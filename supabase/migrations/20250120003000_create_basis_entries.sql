create extension if not exists "pgcrypto";

create table if not exists public.basis_entries (
  id uuid primary key default gen_random_uuid(),
  basis_type text not null,
  reference text not null,
  source_text text not null,
  theme text not null,
  angle text,
  notes text,
  approved boolean not null default false,
  source_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
