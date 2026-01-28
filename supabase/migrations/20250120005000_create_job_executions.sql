create extension if not exists "pgcrypto";

create table if not exists public.job_executions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.content_jobs(id),
  worker text not null,
  inputs jsonb not null,
  outputs jsonb,
  status text not null,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
