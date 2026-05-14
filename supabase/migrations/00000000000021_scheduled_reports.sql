-- Wave 1 (Configs RH foundation) — Migration 21
-- Table: scheduled_reports
-- Recurring report definitions executed by hourly cron worker.

create table public.scheduled_reports (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) <= 100),
  enabled boolean not null default true,
  report_type text not null check (report_type in (
    'cumplimiento_mensual',
    'acuerdos_baja_calidad',
    'calidez_por_lider'
  )),
  schedule_cron text not null,
  recipients text[] not null default '{}'::text[],
  format text not null default 'csv' check (format in ('csv')),
  filters jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_scheduled_reports_due
  on public.scheduled_reports(next_run_at)
  where enabled = true and next_run_at is not null;

alter table public.scheduled_reports enable row level security;

create policy "scheduled_reports_hr_all"
  on public.scheduled_reports
  for all
  to authenticated
  using ((select role from public.users where id = auth.uid()) = 'hr')
  with check ((select role from public.users where id = auth.uid()) = 'hr');

create trigger update_scheduled_reports_updated_at
  before update on public.scheduled_reports
  for each row execute procedure public.update_updated_at_column();
