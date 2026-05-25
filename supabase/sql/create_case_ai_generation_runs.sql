create table if not exists public.case_ai_generation_runs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete set null,
  status text not null check (
    status in ('running', 'failed', 'completed', 'needs_review')
  ),
  current_step text not null check (
    current_step in (
      'generate_case_base',
      'generate_suspects',
      'generate_evidences',
      'generate_statements',
      'generate_contradictions',
      'generate_solution',
      'generate_solve_requirements',
      'generate_investigation_graph',
      'validate_playability'
    )
  ),
  theme text,
  difficulty text check (
    difficulty is null
    or difficulty in ('easy', 'medium', 'hard', 'expert')
  ),
  culprit_suspect_id uuid references public.suspects(id) on delete set null,
  attempts_by_step jsonb not null default '{}'::jsonb,
  generation_options jsonb not null default '{}'::jsonb,
  last_error text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_case_ai_generation_runs_case_created
on public.case_ai_generation_runs(case_id, created_at desc);

create or replace function public.set_case_ai_generation_runs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_case_ai_generation_runs_updated_at
on public.case_ai_generation_runs;

create trigger trg_case_ai_generation_runs_updated_at
before update on public.case_ai_generation_runs
for each row
execute function public.set_case_ai_generation_runs_updated_at();

alter table public.case_ai_generation_runs enable row level security;

revoke all on public.case_ai_generation_runs from public;
grant all on public.case_ai_generation_runs to service_role;

notify pgrst, 'reload schema';
