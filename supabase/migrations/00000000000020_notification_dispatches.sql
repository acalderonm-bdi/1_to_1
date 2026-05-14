-- Wave 1 (Configs RH foundation) — Migration 20
-- Table: notification_dispatches
-- Audit log + cooldown ledger for notifications dispatched by rule engine.
-- Unique cooldown index: (rule_id, recipient_id, day) prevents spam.

create table public.notification_dispatches (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.notification_rules(id) on delete set null,
  recipient_id uuid not null references public.users(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email', 'slack')),
  context jsonb not null,
  status text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  created_at timestamptz not null default now()
);

-- Cooldown: at most one dispatch per (rule, recipient, day-UTC).
-- date_trunc(text, timestamptz) is STABLE, so it cannot be used directly in an
-- index expression. `created_at AT TIME ZONE 'UTC'` returns timestamp (without
-- tz) and is IMMUTABLE for a literal tz, so date_trunc on the result is also
-- IMMUTABLE and valid in an index expression.
create unique index idx_dispatches_cooldown
  on public.notification_dispatches(
    rule_id,
    recipient_id,
    (date_trunc('day', (created_at at time zone 'UTC')))
  )
  where rule_id is not null;

create index idx_dispatches_recipient_recent
  on public.notification_dispatches(recipient_id, created_at desc);

alter table public.notification_dispatches enable row level security;

create policy "dispatches_hr_all"
  on public.notification_dispatches
  for select
  to authenticated
  using ((select role from public.users where id = auth.uid()) = 'hr');

create policy "dispatches_recipient_select_own"
  on public.notification_dispatches
  for select
  to authenticated
  using (recipient_id = auth.uid());
