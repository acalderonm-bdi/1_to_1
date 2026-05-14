-- Wave 1 (Configs RH foundation) — Migration 19
-- Table: notification_rules
-- HR-managed rules that trigger notifications when thresholds/events occur.

create table public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) <= 100),
  enabled boolean not null default true,
  trigger_type text not null check (trigger_type in (
    'cumplimiento_bajo',
    'acuerdo_vencido',
    'vobo_pendiente',
    'calidez_baja',
    'disputa_nueva',
    'reminder_pre_1to1'
  )),
  threshold jsonb,
  audience text[] not null default '{}'::text[],
  channels text[] not null default '{in_app}'::text[],
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_notification_rules_enabled
  on public.notification_rules(enabled)
  where enabled = true;

alter table public.notification_rules enable row level security;

create policy "notification_rules_hr_all"
  on public.notification_rules
  for all
  to authenticated
  using ((select role from public.users where id = auth.uid()) = 'hr')
  with check ((select role from public.users where id = auth.uid()) = 'hr');

create trigger update_notification_rules_updated_at
  before update on public.notification_rules
  for each row execute procedure public.update_updated_at_column();
