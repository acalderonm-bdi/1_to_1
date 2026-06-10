-- ============================================================================
-- Migration 28: Performance indexes — Fase 6.1 audit
-- ============================================================================
-- Indexes identified by cross-referencing server actions + cron queries with
-- the pg_stat_user_tables seq_scan counts.
-- All indexes use IF NOT EXISTS for idempotency.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- one_on_ones
-- ---------------------------------------------------------------------------

-- Cron check-thresholds: queries `status='agendada' + lt/gte scheduled_at`
-- (vobo_pendiente, reminder_pre_1to1 triggers).  The existing idx_oneonones_status
-- is single-column; adding (status, scheduled_at) covers both predicates in one
-- index scan instead of a filter pass.
CREATE INDEX IF NOT EXISTS idx_oneonones_status_scheduled
  ON public.one_on_ones (status, scheduled_at);

-- check-cadence cron: per-relation query filters by
-- (leader_id, collaborator_id, status='realizada') + ORDER BY scheduled_at DESC LIMIT 1.
-- The existing idx_oneonones_leader_collab_scheduled covers (leader_id, collaborator_id,
-- scheduled_at DESC) but does NOT include status — adding a partial index on realizada
-- lets Postgres satisfy the status predicate without a heap filter.
CREATE INDEX IF NOT EXISTS idx_oneonones_leader_collab_realizada
  ON public.one_on_ones (leader_id, collaborator_id, scheduled_at DESC)
  WHERE status = 'realizada';

-- ---------------------------------------------------------------------------
-- agreements
-- ---------------------------------------------------------------------------

-- saveMinute: DELETE WHERE one_on_one_id = X AND ai_generated = true AND status = 'pendiente'.
-- idx_agreements_oneonone covers one_on_one_id but the DB must then filter the
-- remaining rows for ai_generated + status.  A partial index eliminates that.
CREATE INDEX IF NOT EXISTS idx_agreements_oneonone_ai_pending
  ON public.agreements (one_on_one_id)
  WHERE ai_generated = true AND status = 'pendiente';

-- due-agreements cron: SELECT WHERE status='pendiente' AND due_date = tomorrowStr.
-- idx_agreements_due_date is already a partial index on status='pendiente' + due_date,
-- so this is already covered — no new index needed here.

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

-- Paginated notification lists ordered by created_at DESC.  The existing
-- idx_notifications_user covers (user_id, read) but the ORDER BY created_at
-- still requires a sort or a fallback seq scan when read IS NULL / all are fetched.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- notification_dispatches
-- ---------------------------------------------------------------------------

-- HR dispatch matrix and rule-based lookups query by rule_id.
-- The only current index is the unique cooldown index (rule_id, recipient_id,
-- channel, date_trunc) which is functional and doesn't support plain rule_id
-- lookups efficiently.  A plain (rule_id, created_at DESC) covers "show
-- dispatches for rule X ordered by date".
CREATE INDEX IF NOT EXISTS idx_dispatches_rule_created
  ON public.notification_dispatches (rule_id, created_at DESC)
  WHERE rule_id IS NOT NULL;

-- Status-based filtering (failed dispatches monitoring, retry logic).
CREATE INDEX IF NOT EXISTS idx_dispatches_status
  ON public.notification_dispatches (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------

-- Actions look up audit trail by (resource_type, resource_id) — e.g., when HR
-- reviews a dispute history.  No index exists for this access pattern.
CREATE INDEX IF NOT EXISTS idx_audit_resource
  ON public.audit_logs (resource_type, resource_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- leadership_relations
-- ---------------------------------------------------------------------------

-- check-cadence loads ALL active relations (.is('ended_at', null)) — 313 rows,
-- 344 seq_scans.  The existing idx_relations_active_collaborator is a partial
-- unique index by collaborator_id, and idx_relations_leader is partial by
-- leader_id.  A general partial index covering all active rows avoids a seq
-- scan when fetching the full set for the cadence loop.
CREATE INDEX IF NOT EXISTS idx_relations_active_all
  ON public.leadership_relations (leader_id, collaborator_id)
  WHERE ended_at IS NULL;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

-- check-thresholds: getHrUserIds() does SELECT id WHERE role='hr'.
-- check-cadence + vobo loop: lookups by role with is_active filter.
-- idx_users_role already exists (non-partial). Adding a compound partial index
-- for active users optimises the is_active=true + role lookups that are common.
CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON public.users (role)
  WHERE is_active = true;
