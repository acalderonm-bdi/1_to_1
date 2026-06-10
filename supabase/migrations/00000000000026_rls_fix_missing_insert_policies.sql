-- Wave 7.B (RLS Hardening) — Migration 26
-- Adds missing INSERT policies identified in the RLS audit (docs/rls-audit.md).
-- RLS is already enabled on all three tables (migration 02); this migration only
-- adds the missing policies.
--
-- M1: audit_logs — any authenticated user can insert their own log entry.
--     Without this, every INSERT from createClient() (agreements.ts,
--     disputes.ts, one-on-ones.ts, warmth.ts) fails silently.
--     The `user_id is null` branch covers the vobo_invalidation trigger
--     (migration 06) which inserts with user_id = null.
--     INSERTs via createAdminClient() bypass RLS and are unaffected.
--
-- M2: ai_reports — only HR can insert AI reports via authenticated client.
--     The pipeline currently uses admin client (bypasses RLS), so this is
--     defence-in-depth; if any server action ever creates reports via
--     createClient() it will work for HR users.
--
-- M3: notifications — HR can insert notifications for any user (batch/system),
--     and any user can insert a notification for themselves.
--     Workers that use createAdminClient() bypass RLS and remain unaffected.

-- =============================================================================
-- M1: audit_logs INSERT
-- =============================================================================
create policy "audit_logs_insert_authenticated"
  on public.audit_logs
  for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- =============================================================================
-- M2: ai_reports INSERT
-- =============================================================================
create policy "ai_reports_insert_hr"
  on public.ai_reports
  for insert
  to authenticated
  with check (public.is_hr());

-- =============================================================================
-- M3: notifications INSERT
-- =============================================================================
create policy "notifications_insert_service"
  on public.notifications
  for insert
  to authenticated
  with check (
    public.is_hr()
    or user_id = auth.uid()
  );
