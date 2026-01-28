# Content Engine Canon

## Core Tables

- content_jobs  
  Intent queue. Never stores content.

- basis_entries  
  Approved reference layer (scripture, principles, themes).  
  Objective. Stable.

- personal_thoughts  
  Subjective draft interpretations derived from basis_entries.  
  Always draft-first.

- job_executions  
  Audit trail of every worker run.

## Execution Model

1. Jobs are created via POST /api/jobs  
2. Workers claim jobs atomically via claim_next_job()  
3. Workers execute exactly once per job  
4. Workers return 204 when idle  
5. Workers must be idempotent and single-shot  

Workers never loop internally.

## Content Rules

- Basis precedes thought  
- Thoughts may reference basis via basis_id  
- Workers generate drafts only  
- Publishing is downstream  
- AI replaces placeholder generation only  

AI never changes queue semantics.

## System Principles

- Deterministic over clever  
- Explicit over implicit  
- Draft-first always  
- No direct publishing from workers  
- No schema drift without migration  
- No automation without audit  

## Scheduler

Schedulers may call workers.  
Workers never schedule themselves.

## Extension Pattern

New engines = new workers.  
Same job queue.  
Different output tables.

---

## Environment Contract

Required env vars:

- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

These must exist in .env.local for local dev.

Server startup must fail loudly if either is missing.

---

## API Surface

Document these endpoints:

POST /api/jobs  
Creates a queued job.

POST /api/workers/personal-thought/run-once  
Claims exactly one job and attempts execution.

GET /api/health  
Verifies Supabase connectivity.

Workers return:

- 200 + { thought_id } on success  
- 204 when no jobs exist  
- 500 on failure (job marked failed)

---

## Local Development Loop

1. npm run dev
2. curl POST /api/jobs
3. curl POST /api/workers/personal-thought/run-once
4. Verify personal_thoughts row in Supabase

This is the canonical test path.

---

## Failure Semantics

If worker throws:

- job_executions.status = failed
- content_jobs.status = failed
- error message stored

Retries require manual requeue.

No silent failures.

---

## Supabase Contract

Supabase is authoritative storage.

Workers use SERVICE_ROLE_KEY.

Frontend uses anon key only.

All writes occur server-side.

---

## Operational Truth

This system replaces n8n entirely.

No external orchestrators.

All automation flows through:

content_jobs → workers → tables

This repo is the engine.
