# Performance Audit — Fase 6.1

**Fecha:** 2026-06-10  
**Proyecto:** mlmpjeneeckfdyqavwgj  
**Usuarios activos:** ~314  
**Migración aplicada:** `00000000000028_performance_indexes.sql`

---

## 1. Índices existentes antes de la auditoría

| Tabla | Índice | Tipo | Columnas / Condición |
|---|---|---|---|
| agenda_items | idx_agenda_oneonone | btree | one_on_one_id |
| agreement_followups | idx_followups_agreement | btree | agreement_id |
| agreements | idx_agreements_due_date | btree partial | due_date WHERE status='pendiente' |
| agreements | idx_agreements_oneonone | btree | one_on_one_id |
| agreements | idx_agreements_quality_low | btree partial | ai_quality_score WHERE score < 3 |
| agreements | idx_agreements_responsible | btree | responsible_id |
| agreements | idx_agreements_responsible_status | btree | (responsible_id, status) |
| agreements | idx_agreements_status | btree | status |
| ai_reports | idx_reports_severity | btree | (severity, reviewed) |
| audit_logs | idx_audit_user | btree | (user_id, created_at DESC) |
| cadence_configs | idx_cadence_global | unique partial | (1) WHERE scope_type='global' |
| cadence_configs | idx_cadence_scope | unique partial | (scope_type, scope_id) WHERE scope_id IS NOT NULL |
| leadership_relations | idx_relations_active_collaborator | unique partial | collaborator_id WHERE ended_at IS NULL |
| leadership_relations | idx_relations_leader | btree partial | leader_id WHERE ended_at IS NULL |
| meeting_warmth_responses | idx_warmth_collaborator | btree | collaborator_id |
| meeting_warmth_responses | idx_warmth_one_per_meeting | unique | one_on_one_id |
| minutes | idx_minutes_oneonone | unique | one_on_one_id |
| notification_dispatches | idx_dispatches_cooldown | unique partial | (rule_id, recipient_id, channel, day) WHERE rule_id IS NOT NULL |
| notification_dispatches | idx_dispatches_recipient_recent | btree | (recipient_id, created_at DESC) |
| notification_preferences | idx_notification_preferences_user | btree | user_id |
| notification_rules | idx_notification_rules_enabled | btree partial | enabled WHERE enabled=true |
| notifications | idx_notifications_user | btree | (user_id, read) |
| one_on_ones | idx_oneonones_collaborator | btree | collaborator_id |
| one_on_ones | idx_oneonones_leader | btree | leader_id |
| one_on_ones | idx_oneonones_leader_collab_scheduled | btree | (leader_id, collaborator_id, scheduled_at DESC) |
| one_on_ones | idx_oneonones_non_realization | btree partial | non_realization_marked_by WHERE NOT NULL |
| one_on_ones | idx_oneonones_scheduled | btree | scheduled_at |
| one_on_ones | idx_oneonones_status | btree | status |
| pending_alerts | idx_pending_alerts_severity_type | btree | (severity, alert_type) |
| scheduled_reports | idx_scheduled_reports_due | btree partial | next_run_at WHERE enabled=true AND next_run_at IS NOT NULL |
| users | idx_users_department | btree | department_id |
| users | idx_users_email | btree | email |
| users | idx_users_role | btree | role |
| vobos | idx_vobos_unique | unique | (one_on_one_id, user_id) |

---

## 2. Diagnóstico — seq_scan por tabla

Datos de `pg_stat_user_tables` al momento de la auditoría:

| Tabla | seq_scan | seq_tup_read | idx_scan | Señal |
|---|---|---|---|---|
| one_on_ones | 798 | 48 228 | 20 880 | Alto volumen de scans — cron loops |
| agreements | 410 | 20 643 | 11 417 | Frecuente — múltiples actions + cron |
| leadership_relations | 344 | 49 608 | 641 | 313 filas; todo el tabla en cada cadence tick |
| users | 334 | 4 772 | 32 876 | Mayormente cubierto; getHrUserIds sin is_active |
| departments | 168 | 989 | 3 352 | Tabla pequeña, aceptable |
| vobos | 89 | 6 630 | 1 463 | Revisado; cubiertas por unique index |
| audit_logs | 44 | 361 | 4 | Lookups por resource_type/resource_id sin índice |

---

## 3. Índices agregados — migración 28

### 3.1 `one_on_ones` — `idx_oneonones_status_scheduled`
```sql
CREATE INDEX IF NOT EXISTS idx_oneonones_status_scheduled
  ON public.one_on_ones (status, scheduled_at);
```
**Query beneficiada:** cron `check-thresholds` → triggers `vobo_pendiente` y `reminder_pre_1to1`:
```
.eq('status', 'agendada').lt('scheduled_at', cutoff)
.eq('status', 'agendada').gte('scheduled_at', now).lte('scheduled_at', windowEnd)
```
El índice existente `idx_oneonones_status` era single-column; la consulta de rango en `scheduled_at` requería un filter pass adicional. El índice compuesto elimina esa pasada.

---

### 3.2 `one_on_ones` — `idx_oneonones_leader_collab_realizada`
```sql
CREATE INDEX IF NOT EXISTS idx_oneonones_leader_collab_realizada
  ON public.one_on_ones (leader_id, collaborator_id, scheduled_at DESC)
  WHERE status = 'realizada';
```
**Query beneficiada:** cron `check-cadence` — por cada relación activa (313 iteraciones):
```
.eq('leader_id', rel.leader_id)
.eq('collaborator_id', rel.collaborator_id)
.eq('status', 'realizada')
.order('scheduled_at', { ascending: false })
.limit(1)
```
El índice existente `idx_oneonones_leader_collab_scheduled` no filtraba por status; Postgres debía hacer heap filter en cada una de las 313 iteraciones del loop.

---

### 3.3 `agreements` — `idx_agreements_oneonone_ai_pending`
```sql
CREATE INDEX IF NOT EXISTS idx_agreements_oneonone_ai_pending
  ON public.agreements (one_on_one_id)
  WHERE ai_generated = true AND status = 'pendiente';
```
**Query beneficiada:** `saveMinute` action — idempotencia de extracción IA:
```
.from('agreements').delete()
.eq('one_on_one_id', oneOnOneId)
.eq('ai_generated', true)
.eq('status', 'pendiente')
```
`idx_agreements_oneonone` cubre `one_on_one_id` pero luego hace filter por los predicados adicionales. Este índice parcial contiene solo las filas relevantes.

---

### 3.4 `notifications` — `idx_notifications_user_created`
```sql
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);
```
**Query beneficiada:** listas de notificaciones paginadas ordenadas por fecha. El índice existente `idx_notifications_user (user_id, read)` no incluye `created_at`, por lo que un `ORDER BY created_at DESC` requería sort en memoria.

---

### 3.5 `notification_dispatches` — `idx_dispatches_rule_created`
```sql
CREATE INDEX IF NOT EXISTS idx_dispatches_rule_created
  ON public.notification_dispatches (rule_id, created_at DESC)
  WHERE rule_id IS NOT NULL;
```
**Query beneficiada:** HR dispatch matrix — lookup de historial por regla. El único índice existente era el unique de cooldown (funcional, no adecuado para scans simples por rule_id).

---

### 3.6 `notification_dispatches` — `idx_dispatches_status`
```sql
CREATE INDEX IF NOT EXISTS idx_dispatches_status
  ON public.notification_dispatches (status, created_at DESC);
```
**Query beneficiada:** monitoring de dispatches fallidos (`status='failed'`), lógica de retry futura. Sin este índice, un filtro por status implica seq scan completo.

---

### 3.7 `audit_logs` — `idx_audit_resource`
```sql
CREATE INDEX IF NOT EXISTS idx_audit_resource
  ON public.audit_logs (resource_type, resource_id, created_at DESC);
```
**Query beneficiada:** revisión de historial de un recurso específico (una disputa, un acuerdo, un usuario). Patrón implícito en el código y en vistas HR. Solo existía `idx_audit_user (user_id, created_at)`, sin cobertura de resource_type/resource_id.

---

### 3.8 `leadership_relations` — `idx_relations_active_all`
```sql
CREATE INDEX IF NOT EXISTS idx_relations_active_all
  ON public.leadership_relations (leader_id, collaborator_id)
  WHERE ended_at IS NULL;
```
**Query beneficiada:** cron `check-cadence` carga TODAS las relaciones activas:
```
.from('leadership_relations')
.select('leader_id, collaborator_id, ...')
.is('ended_at', null)
```
Con 313 filas activas y 344 seq_scans, este era el mayor problema proporcional. Los índices existentes son partial por `collaborator_id` o `leader_id` individualmente — no cubren el fetch completo de todas las relaciones activas.

---

### 3.9 `users` — `idx_users_role_active`
```sql
CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON public.users (role)
  WHERE is_active = true;
```
**Query beneficiada:** `getHrUserIds()` en cron `check-thresholds` (llamado por cada regla):
```
.from('users').select('id').eq('role', 'hr')
```
También beneficia queries de líderes activos con filtro `is_active`. `idx_users_role` existe pero no es partial — filtra filas inactivas en cada lookup.

---

## 4. Queries que aún podrían optimizarse (requieren refactor, no solo índice)

### 4.1 N+1 en cron `check-cadence`
El cron ejecuta una query por relación activa para buscar el último meeting:
```typescript
for (const rel of relations ?? []) {
  const { data: lastMeeting } = await admin
    .from('one_on_ones')
    .select('scheduled_at')
    .eq('leader_id', rel.leader_id)
    .eq('collaborator_id', rel.collaborator_id)
    .eq('status', 'realizada')
    .order('scheduled_at', { ascending: false })
    .limit(1)
```
Con 313 relaciones = 313 queries por ejecución de cron. Refactor recomendado: single query con `DISTINCT ON (leader_id, collaborator_id)` o una vista materializada `latest_meeting_per_pair`.

### 4.2 N+1 en cron `check-thresholds` — vobo_pendiente y reminder_pre_1to1
Por cada meeting pendiente se hacen queries individuales de `users` (recipient + partner):
```typescript
for (const row of voboRows) {
  const { data: collabRow } = await admin.from('users').select(...).eq('id', row.collaborator_id)
  const { data: leaderRow } = await admin.from('users').select('full_name').eq('id', row.leader_id)
```
Refactor: un JOIN en la query principal de `one_on_ones` (`.select('..., collaborator:users!..., leader:users!...')`) elimina las N queries de usuario.

### 4.3 N+1 en `scheduled-reports` — lookup de user por email
```typescript
for (const recipient of report.recipients) {
  const { data: userRow } = await admin.from('users').select('id').eq('email', recipient)
```
Refactor: traer todos los IDs en una sola query `.in('email', report.recipients)` antes del loop.

### 4.4 Vistas sin índices subyacentes
`compliance_metrics` y `warmth_metrics_by_leader` son vistas. Si hacen aggregations sobre `one_on_ones` sin filtros selectivos, se beneficiarían de materializarse (o de un índice `CONCURRENTLY` sobre las columnas base). Evaluar con `EXPLAIN ANALYZE` en producción cuando haya datos suficientes.

---

## 5. Estado del push

- **Migración:** `00000000000028_performance_indexes.sql`
- **Aplicada:** sí (directamente vía Supabase Management API)
- **Registrada en schema_migrations:** sí (`version='00000000000028'`)
- **Índices verificados en `pg_indexes`:** 9/9 confirmados
