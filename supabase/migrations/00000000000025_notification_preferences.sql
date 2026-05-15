-- Wave 7.A (Hardening Plan) — Migration 25
-- Table: notification_preferences
-- Per-user × trigger × channel opt-out for notifications dispatched by
-- `check-thresholds`. Defaults to ENABLED for every combination; rows are
-- only created when the user actively toggles a preference, so a missing row
-- means "use default (enabled)".
--
-- The `trigger_type` column intentionally has no FK: it mirrors the union
-- documented in `src/types/database.augmentation.ts` (NotificationTriggerType)
-- and is enforced at the action layer with zod. Channels follow the same
-- 'in_app' | 'email' | 'slack' set used by notification_rules.

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  trigger_type text not null,
  channel text not null check (channel in ('in_app', 'email', 'slack')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, trigger_type, channel)
);

create index idx_notification_preferences_user
  on public.notification_preferences(user_id);

alter table public.notification_preferences enable row level security;

-- A user can only read their own preferences.
create policy "notification_preferences_select_own"
  on public.notification_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

-- A user can only insert preferences for themselves.
create policy "notification_preferences_insert_own"
  on public.notification_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- A user can only update their own preferences (and cannot reassign
-- `user_id` to someone else thanks to the WITH CHECK clause).
create policy "notification_preferences_update_own"
  on public.notification_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- A user can only delete their own preferences.
create policy "notification_preferences_delete_own"
  on public.notification_preferences
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Keep updated_at fresh on every UPDATE (replicates migration 19's pattern).
create trigger update_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute procedure public.update_updated_at_column();
