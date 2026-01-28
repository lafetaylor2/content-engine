alter table public.content_jobs
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by text;

create or replace function public.claim_next_job(worker_id text)
returns public.content_jobs
language plpgsql
as $$
declare
  job_row public.content_jobs;
begin
  update public.content_jobs
  set claimed_at = now(),
      claimed_by = worker_id,
      status = 'processing'
  where id = (
    select id
    from public.content_jobs
    where status = 'queued'
      and claimed_at is null
    order by created_at asc
    for update skip locked
    limit 1
  )
  returning * into job_row;

  return job_row;
end;
$$;
