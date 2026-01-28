alter table public.content_jobs
  add column if not exists completed_at timestamptz,
  add column if not exists result jsonb,
  add column if not exists error text;
