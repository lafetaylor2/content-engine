create extension if not exists "pgcrypto";

create table if not exists public.content_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  payload jsonb not null,
  status text not null default 'queued',
  created_at timestamptz not null default now()
);
