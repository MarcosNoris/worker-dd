create table if not exists public.case_ai_generation_job_locks (
  lock_name text primary key,
  locked_by text not null,
  locked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_case_ai_generation_runs_status_finished
on public.case_ai_generation_runs(status, finished_at);

create or replace function public.set_case_ai_generation_job_locks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_case_ai_generation_job_locks_updated_at
on public.case_ai_generation_job_locks;

create trigger trg_case_ai_generation_job_locks_updated_at
before update on public.case_ai_generation_job_locks
for each row
execute function public.set_case_ai_generation_job_locks_updated_at();

create or replace function public.try_acquire_case_ai_generation_job_lock(
  p_lock_name text,
  p_locked_by text,
  p_ttl_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  lock_expiration timestamptz := v_now + make_interval(secs => p_ttl_seconds);
begin
  insert into public.case_ai_generation_job_locks (
    lock_name,
    locked_by,
    locked_until,
    updated_at
  )
  values (
    p_lock_name,
    p_locked_by,
    lock_expiration,
    v_now
  )
  on conflict (lock_name) do nothing;

  if found then
    return true;
  end if;

  update public.case_ai_generation_job_locks
  set
    locked_by = p_locked_by,
    locked_until = lock_expiration,
    updated_at = v_now
  where lock_name = p_lock_name
  and locked_until <= v_now;

  return found;
end;
$$;

create or replace function public.release_case_ai_generation_job_lock(
  p_lock_name text,
  p_locked_by text
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.case_ai_generation_job_locks
  where lock_name = p_lock_name
  and locked_by = p_locked_by;
$$;

create or replace function public.get_recoverable_case_ai_generation_runs(
  p_limit integer default 2
)
returns table (
  id uuid,
  case_id uuid,
  status text,
  current_step text,
  theme text,
  difficulty text,
  culprit_suspect_id uuid,
  attempts_by_step jsonb,
  generation_options jsonb,
  last_error text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  finished_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with latest_runs as (
    select distinct on (case_id)
      run.*
    from public.case_ai_generation_runs run
    where run.case_id is not null
    order by run.case_id, run.created_at desc
  )
  select
    latest_runs.id,
    latest_runs.case_id,
    latest_runs.status,
    latest_runs.current_step,
    latest_runs.theme,
    latest_runs.difficulty,
    latest_runs.culprit_suspect_id,
    latest_runs.attempts_by_step,
    latest_runs.generation_options,
    latest_runs.last_error,
    latest_runs.created_by,
    latest_runs.created_at,
    latest_runs.updated_at,
    latest_runs.finished_at
  from latest_runs
  where latest_runs.status = 'failed'
  order by latest_runs.finished_at asc nulls last, latest_runs.created_at asc
  limit greatest(p_limit, 0);
$$;

alter table public.case_ai_generation_job_locks enable row level security;

revoke all on public.case_ai_generation_job_locks from public;
grant all on public.case_ai_generation_job_locks to service_role;

revoke all on function public.try_acquire_case_ai_generation_job_lock(text, text, integer) from public;
grant execute on function public.try_acquire_case_ai_generation_job_lock(text, text, integer) to service_role;

revoke all on function public.release_case_ai_generation_job_lock(text, text) from public;
grant execute on function public.release_case_ai_generation_job_lock(text, text) to service_role;

revoke all on function public.get_recoverable_case_ai_generation_runs(integer) from public;
grant execute on function public.get_recoverable_case_ai_generation_runs(integer) to service_role;

notify pgrst, 'reload schema';
