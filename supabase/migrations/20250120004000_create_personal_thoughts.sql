create extension if not exists "pgcrypto";

create table if not exists public.personal_thoughts (
  id uuid primary key default gen_random_uuid(),
  basis_id uuid references public.basis_entries(id),
  title text not null,
  body text not null,
  category text not null,
  status text not null default 'draft',
  strength_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
