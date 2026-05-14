-- Wave 1 (Configs RH foundation) — Migration 18
-- Table: org_settings
-- Key-value JSONB store for organization-wide settings managed by HR.
-- Schemas per key are validated in code (src/lib/org-settings.ts) via Zod.

create table public.org_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now()
);

alter table public.org_settings enable row level security;

create policy "org_settings_hr_all"
  on public.org_settings
  for all
  to authenticated
  using ((select role from public.users where id = auth.uid()) = 'hr')
  with check ((select role from public.users where id = auth.uid()) = 'hr');

create policy "org_settings_authenticated_read"
  on public.org_settings
  for select
  to authenticated
  using (true);

create trigger update_org_settings_updated_at
  before update on public.org_settings
  for each row execute procedure public.update_updated_at_column();
