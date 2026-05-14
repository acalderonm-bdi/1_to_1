# Configs administrables para RH — 4 packs en paralelo

**Fecha:** 2026-05-14
**Autor:** Ariel Calderón
**Estado:** Aprobado (brainstorm) — pendiente plan de implementación

## Objetivo

Convertir las capacidades de configuración de Arquitectura Humana (RH) de mock visuals → editables persistidas, agrupadas en 4 packs implementables en paralelo:

- **Pack 1 — Operación:** cadencia editable, motor de notificaciones, CRUD de departamentos.
- **Pack 2 — Parámetros tuneables:** umbrales y configs hoy hardcoded → almacenados en `org_settings`.
- **Pack 3 — Reportería:** export CSV ad-hoc + reportes programados por email.
- **Pack 4 — Sincronización organizacional:** outline-only (bloqueado por spec externo de Conexiones Humanas).

## No-objetivos

- **No implementar** Pack 4 (queda como contrato/placeholder hasta que Conexiones Humanas entregue su spec).
- **No agregar** bulk reassign manual (decisión del brainstorm: outline-only para Pack 4 completo).
- **No exportar PDF** en Pack 3 — CSV es suficiente. PDF queda como follow-up.
- **No reescribir** flujos del colaborador o líder. Los configs nuevos son consumidos por código existente con accessors retro-compatibles (default = comportamiento actual).
- **No agregar** UI para enums extensibles (ej. `non_realization_reason` extension) — eso requiere migration y queda fuera del scope tuneable JSON.

## Decisiones de stack

| Capa | Decisión |
|---|---|
| Storage de configs simples | Tabla `org_settings (key, value jsonb)` única |
| Storage de configs relacionales | Tablas normalizadas: `notification_rules`, `notification_dispatches`, `scheduled_reports` |
| Tipos | Augmentation manual en `src/types/database.augmentation.ts` (consistent con Pack A+B previos) |
| Validación | Zod schemas por key en `src/lib/org-settings.ts` |
| Auth | `requireHR()` helper en `src/lib/auth-guards.ts`, llamado por TODA action HR |
| Cron | Vercel cron (1 endpoint por job: `/api/cron/check-thresholds`, `/api/cron/send-scheduled-reports`) |
| Notificaciones | In-app primero (tabla `notifications` existente). Email/Slack stubs si las integraciones aún no están |
| Export format | CSV en V1. PDF como follow-up |

---

## Wave 0 — SPEC + page-map (1 agente)

**Output:** `docs/superpowers/specs/2026-05-14-configs-rh-page-map.md` listando:
- Archivos a tocar por pack (cross-check con la sección de ownership de este spec)
- Grep de consumers actuales de los configs hardcoded (para Pack 2 saber qué wirear)
- Inventario de páginas mock en `/arquitectura-humana/configuracion` para no romperlas

**Bloquea:** Wave 1.

---

## Wave 1 — Foundation (1 agente, blocking)

### Migrations

`supabase/migrations/00000000000018_org_settings_table.sql`:

```sql
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

-- Trigger updated_at automático (mismo patrón que el resto)
create trigger update_org_settings_updated_at
  before update on public.org_settings
  for each row execute procedure public.update_updated_at_column();
```

`supabase/migrations/00000000000019_notification_rules.sql`:

```sql
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
```

`supabase/migrations/00000000000020_notification_dispatches.sql`:

```sql
create table public.notification_dispatches (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.notification_rules(id) on delete set null,
  recipient_id uuid not null references public.users(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email', 'slack')),
  context jsonb not null,
  status text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  created_at timestamptz not null default now()
);

-- Cooldown: misma regla + mismo recipient + mismo día = un solo dispatch
create unique index idx_dispatches_cooldown
  on public.notification_dispatches(rule_id, recipient_id, (date_trunc('day', created_at)))
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
```

`supabase/migrations/00000000000021_scheduled_reports.sql`:

```sql
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
```

### Shared helpers

`src/lib/auth-guards.ts`:

```ts
import { createClient } from '@/lib/supabase/server'

export async function requireHR() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'No autenticado' }
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single<{ role: string }>()
  if (data?.role !== 'hr') return { ok: false as const, error: 'Sin permisos' }
  return { ok: true as const, user, supabase }
}
```

`src/lib/org-settings.ts`:

```ts
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const SETTING_SCHEMAS = {
  agreement_quality_threshold: z.number().min(0).max(5).default(3.0),
  collaborator_max_open_agreements: z.number().int().min(1).max(50).default(7),
  warmth_survey_required: z.boolean().default(true),
  warmth_questions: z.array(z.object({
    key: z.string(),
    label: z.string().max(200),
  })).min(3).max(7).default(DEFAULT_WARMTH_QUESTIONS),
  ai_features: z.object({
    extract_agreements: z.boolean().default(true),
    suggest_questions: z.boolean().default(true),
    analyze_patterns: z.boolean().default(true),
    refine_agreement: z.boolean().default(true),
  }).default({ extract_agreements: true, suggest_questions: true, analyze_patterns: true, refine_agreement: true }),
  ai_model: z.enum(['claude-sonnet-4-5', 'claude-haiku-4-5-20251001']).default('claude-sonnet-4-5'),
  ai_monthly_budget_usd: z.number().min(0).default(100),
  non_realization_max_days: z.number().int().min(1).max(90).default(7),
  transfer_banner_enabled: z.boolean().default(true),
} as const

type SettingKey = keyof typeof SETTING_SCHEMAS
type SettingValue<K extends SettingKey> = z.infer<typeof SETTING_SCHEMAS[K]>

const cache = new Map<SettingKey, { value: unknown; at: number }>()
const CACHE_TTL_MS = 30_000  // 30s: balance entre fresh y reducir DB hits

export async function getOrgSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value as SettingValue<K>
  }
  const schema = SETTING_SCHEMAS[key]
  const supabase = createClient()
  const { data } = await supabase.from('org_settings').select('value').eq('key', key).maybeSingle<{ value: unknown }>()
  const parsed = schema.safeParse(data?.value)
  const value = (parsed.success ? parsed.data : schema.parse(undefined)) as SettingValue<K>
  cache.set(key, { value, at: Date.now() })
  return value
}

export async function setOrgSetting<K extends SettingKey>(key: K, value: SettingValue<K>, userId: string) {
  const schema = SETTING_SCHEMAS[key]
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new Error(`Invalid value for ${key}: ${parsed.error.message}`)
  const supabase = createClient()
  const { error } = await supabase.from('org_settings').upsert({
    key,
    value: parsed.data,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  } as never)
  if (error) throw error
  cache.delete(key)
}

const DEFAULT_WARMTH_QUESTIONS = [
  { key: 'felt_heard', label: 'Me sentí escuchada/o en esta sesión' },
  { key: 'comfortable_sharing', label: 'Me sentí cómoda/o compartiendo lo que pensaba' },
  { key: 'leader_engaged', label: 'Sentí que mi líder estuvo presente y enfocada/o' },
  { key: 'conversation_quality', label: 'La conversación fue significativa para mí' },
  { key: 'clarity_after_session', label: 'Salí con claridad de los próximos pasos' },
]
```

### Tipos augmentation

Agregar a `src/types/database.augmentation.ts`:

```ts
export interface OrgSettingRow {
  key: string
  value: unknown
  updated_by: string | null
  updated_at: string
}

export interface NotificationRuleRow {
  id: string
  name: string
  enabled: boolean
  trigger_type: 'cumplimiento_bajo' | 'acuerdo_vencido' | 'vobo_pendiente' | 'calidez_baja' | 'disputa_nueva' | 'reminder_pre_1to1'
  threshold: { value?: number; unit?: string; scope?: string; days?: number } | null
  audience: Array<'leader' | 'collaborator' | 'hr'>
  channels: Array<'in_app' | 'email' | 'slack'>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface NotificationDispatchRow {
  id: string
  rule_id: string | null
  recipient_id: string
  channel: 'in_app' | 'email' | 'slack'
  context: Record<string, unknown>
  status: 'sent' | 'failed' | 'skipped'
  created_at: string
}

export interface ScheduledReportRow {
  id: string
  name: string
  enabled: boolean
  report_type: 'cumplimiento_mensual' | 'acuerdos_baja_calidad' | 'calidez_por_lider'
  schedule_cron: string
  recipients: string[]
  format: 'csv'
  filters: Record<string, unknown> | null
  last_run_at: string | null
  next_run_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
```

### Sidebar update

Agregar items a `src/components/layout/sidebar.tsx` bajo el role `hr`:
- `Cadencias` (ya existe)
- `Notificaciones` (NEW Pack 1)
- `Parámetros` (NEW Pack 2)
- `Exportes` (NEW Pack 3)
- `Sincronización` (NEW Pack 4 placeholder)

**Commit:** `feat(foundation): schema + helpers para configs admin (packs 1-3)`

---

## Wave 2 — Big bang paralelo (4 agentes)

### Agente A — Pack 1: Cadencia + Notificaciones + Departments

**Archivos exclusivos:**

```
src/app/(dashboard)/arquitectura-humana/cadencias/page.tsx                  (modify: editable)
src/app/(dashboard)/arquitectura-humana/notificaciones/page.tsx             (NEW)
src/lib/actions/cadence.ts                                                  (NEW)
src/lib/actions/notification-rules.ts                                       (NEW)
src/lib/actions/departments.ts                                              (NEW)
src/components/arquitectura-humana/cadence-editor.tsx                       (NEW)
src/components/arquitectura-humana/notification-rule-card.tsx               (NEW)
src/components/arquitectura-humana/notification-rule-modal.tsx              (NEW)
src/components/arquitectura-humana/department-manager.tsx                   (NEW)
src/app/api/cron/check-thresholds/route.ts                                  (NEW)
src/app/(dashboard)/arquitectura-humana/usuarios/[id]/page.tsx              (modify: agregar "Cambiar depto")
```

**Server actions firma:**

```ts
// cadence.ts
export async function upsertGlobalCadence(input: { frequencyDays: number }): Promise<ActionResult>
export async function upsertDepartmentCadence(input: { departmentId: string; frequencyDays: number }): Promise<ActionResult>
export async function removeDepartmentCadence(id: string): Promise<ActionResult>

// notification-rules.ts
export async function createNotificationRule(input: NotificationRuleInput): Promise<ActionResult<{ id: string }>>
export async function updateNotificationRule(id: string, input: NotificationRuleInput): Promise<ActionResult>
export async function toggleNotificationRule(id: string, enabled: boolean): Promise<ActionResult>
export async function deleteNotificationRule(id: string): Promise<ActionResult>
export async function testFireRule(id: string): Promise<ActionResult<{ dispatched: number }>>

// departments.ts
export async function createDepartment(input: { name: string; parentId?: string }): Promise<ActionResult<{ id: string }>>
export async function renameDepartment(id: string, name: string): Promise<ActionResult>
export async function deleteDepartment(id: string): Promise<ActionResult>  // bloquea si tiene users
```

**Cron `/api/cron/check-thresholds`:**

- Protección: header `Authorization: Bearer ${CRON_SECRET}`
- Frecuencia: cada 30 min (`vercel.json` schedule)
- Logic:
  1. Listar `notification_rules` con `enabled = true`
  2. Por cada regla, evaluar trigger:
     - `cumplimiento_bajo`: query `compliance_metrics` view, comparar contra threshold
     - `acuerdo_vencido`: query agreements with `due_date < today and status = 'pendiente'`, dispatch a responsible_id
     - `vobo_pendiente`: 1:1s `status = 'agendada'` y `scheduled_at < now - threshold.days`
     - `calidez_baja`: `warmth_metrics_by_leader.avg_overall < threshold.value` últimos 30 días
     - `disputa_nueva`: cualquier `one_on_ones` con `status = 'en_disputa'` y sin dispatch previo para esa misma 1:1
     - `reminder_pre_1to1`: 1:1s `status = 'agendada'` con `scheduled_at between now and now + threshold.days`
  3. Por cada match, intentar `INSERT INTO notification_dispatches` (el unique index sobre cooldown previene duplicados del mismo día)
  4. Para in_app: nada extra. Para email: stub call a un service (futuro). Para slack: idem.

### Agente B — Pack 2: Tunable params

**Archivos exclusivos:**

```
src/app/(dashboard)/arquitectura-humana/parametros/page.tsx                 (NEW)
src/lib/actions/org-settings.ts                                             (NEW: server-action wrapper sobre lib/org-settings.ts)
src/components/arquitectura-humana/params-section.tsx                       (NEW: card reutilizable)
src/components/arquitectura-humana/warmth-questions-editor.tsx              (NEW)
src/components/arquitectura-humana/ai-features-config.tsx                   (NEW)
src/components/arquitectura-humana/agreement-quality-tuner.tsx              (NEW)
```

**Archivos a modificar (consumers de configs):**

```
src/lib/agreement-quality.ts                                                (modify: max_open via getOrgSetting)
src/components/one-on-one/warmth-survey.tsx                                 (modify: questions via getOrgSetting)
src/lib/ai/extract-agreements.ts                                            (modify: model + feature flag)
src/lib/ai/suggest-questions.ts                                             (modify: model + feature flag)
src/lib/ai/followup-plan.ts                                                 (modify: feature flag)
src/app/api/ai/agreement-quality/route.ts                                   (modify: model + feature flag)
src/app/api/ai/analyze-patterns/route.ts                                    (modify: feature flag)
src/app/(dashboard)/arquitectura-humana/reportes/page.tsx                   (modify: threshold via getOrgSetting)
src/lib/actions/one-on-ones.ts                                              (modify: markNonRealization respeta non_realization_max_days)
```

**Carga inicial:** la page `/parametros` lee TODAS las configs en server-side y las pasa como props a un client component que tiene cards editables. Cada save dispara `setOrgSetting` via server action.

### Agente C — Pack 3: Reportería

**Archivos exclusivos:**

```
src/app/(dashboard)/arquitectura-humana/reportes/page.tsx                   (modify: agregar export buttons + scheduler card al final)
src/app/(dashboard)/arquitectura-humana/exportes/page.tsx                   (NEW: hub centralizado)
src/lib/actions/exports.ts                                                  (NEW)
src/lib/actions/scheduled-reports.ts                                        (NEW)
src/app/api/exports/[type]/route.ts                                         (NEW: download)
src/app/api/cron/send-scheduled-reports/route.ts                            (NEW)
src/components/arquitectura-humana/export-card.tsx                          (NEW)
src/components/arquitectura-humana/scheduled-report-list.tsx                (NEW)
src/components/arquitectura-humana/scheduled-report-modal.tsx               (NEW)
src/lib/exports/cumplimiento-csv.ts                                         (NEW)
src/lib/exports/acuerdos-csv.ts                                             (NEW)
src/lib/exports/calidez-csv.ts                                              (NEW)
```

**Generators de CSV:** server actions que devuelven `{ filename, content: string }`. La ruta API `/api/exports/[type]` consume el action, agrega headers `Content-Type: text/csv` + `Content-Disposition: attachment; filename=...`, returnea el contenido.

**Cron `/api/cron/send-scheduled-reports`:**

- Protección: `Authorization: Bearer ${CRON_SECRET}`
- Frecuencia: cada hora
- Logic:
  1. `SELECT * FROM scheduled_reports WHERE enabled = true AND next_run_at <= now()`
  2. Por cada report:
     - Generar CSV via el generator correspondiente
     - Enviar email a `recipients[]` con el CSV adjunto (stub via Resend o SMTP, según integración disponible)
     - Update `last_run_at = now()` y recalcular `next_run_at` usando la lib `cron-parser` o equivalente
  3. Log a `notification_dispatches` con `channel = 'email'` por cada recipient.

### Agente D — Pack 4: Outline doc + UI placeholder

**Archivos exclusivos:**

```
docs/superpowers/specs/2026-05-14-pack-4-org-sync-extended.md               (NEW)
src/app/(dashboard)/arquitectura-humana/sincronizacion/page.tsx             (NEW: placeholder)
src/components/arquitectura-humana/sync-placeholder.tsx                     (NEW: card "EN DESARROLLO")
```

**Doc extiende** `docs/superpowers/specs/2026-05-13-pack-c-conexiones-humanas-contract.md` (referenciado) con:
- Wireframe textual del flujo upload CSV → preview diff → confirmar
- Spec de bulk reassign manual (alternativa sin spec externo, queda outline)
- Lista de pre-condiciones que Conexiones Humanas debe entregar

**Placeholder UI:** card con banner amarillo (`bg-warning/12`), título "Sincronización organizacional", body "En desarrollo — esperando spec de Conexiones Humanas. Mientras tanto los cambios de líder se hacen desde `/usuarios/[id]`.", link al doc.

---

## Wave 3 — Integration review (2 reviewers paralelos)

### Reviewer 1 — Cross-pack consistency

Verifica:
- Sidebar muestra todas las rutas nuevas en orden lógico (Operación → Parámetros → Exportes → Sincronización)
- Page heads consistentes (`page__eyebrow + page__title + page__subtitle`)
- Loading/empty states usan `<EmptyState>` shared
- Botón "Guardar" en `ui-btn--accent` con estado disabled cuando no hay cambios, toast post-save
- Confirm modals para destructivos (delete regla, delete reporte, delete depto)
- No duplicación de `getOrgSetting` wrappers entre packs
- i18n en español, sin mezcla con inglés salvo nombres técnicos

Output: findings en `docs/superpowers/specs/2026-05-14-configs-rh-page-map.md` sección "Wave 3 — Cross-pack findings". Fix inline.

### Reviewer 2 — Security & RLS

Verifica:
- Cada server action nueva llama `requireHR()` al inicio
- RLS policies aplicadas en las 4 tablas nuevas (org_settings, notification_rules, notification_dispatches, scheduled_reports)
- Endpoints API protegidos:
  - `/api/cron/check-thresholds` y `/api/cron/send-scheduled-reports`: header `Authorization: Bearer ${CRON_SECRET}`
  - `/api/exports/[type]`: requiere `requireHR()`
- Inputs sanitizados con Zod schemas (length limits, formato email)
- Feature flags de IA cierran hard fail antes de Anthropic call (`if (!ai_features.extract) return { agreements: [] }`)
- Test de queries manualmente: HR can read/write own tables, leaders/colabs NO

Output: report + fixes.

---

## Wave 4 — Zero-error gate + polish

- `pnpm tsc -b` exit 0
- `pnpm build` exit 0, sin warnings
- `pnpm tsx scripts/review-all.ts` corre limpio (todas las rutas nuevas capturadas sin error visual)
- Dark mode parity sobre las 4 nuevas rutas (`/notificaciones`, `/parametros`, `/exportes`, `/sincronizacion`)
- A11y básico: labels asociados, modales con `role="dialog"`, botones de iconos con `aria-label`
- Smoke funcional manual:
  - Editar cadencia global → verificar persiste en `cadence_configs`
  - Crear regla "calidez_baja" → fire test → verificar dispatch en `notification_dispatches`
  - Cambiar `agreement_quality_threshold` a 3.5 → recargar `reportes` y verificar filtro recalculado
  - Crear scheduled report mensual, ejecutar manualmente, verificar email enviado (stub si no hay SMTP real)
- Squash merge `feat/configs-rh` → `main`, push a origin con consent de Ariel

---

## Riesgos + mitigaciones

1. **Vercel hobby cron limit (max 1/hora).** Mitigación: si Forbes está en hobby, agrupar `check-thresholds` + `send-scheduled-reports` en un solo endpoint `/api/cron/tick` que llama ambos. Pro plan resuelve.

2. **Reglas de notificación con loops.** Mitigación: unique index sobre `(rule_id, recipient_id, date_trunc('day', created_at))` en `notification_dispatches`.

3. **`org_settings` JSON sin schema = bugs de tipo.** Mitigación: `getOrgSetting` valida con Zod por key. Si la fila tiene basura, devuelve el default.

4. **Delete de departamento con users asignados.** Mitigación: server action `deleteDepartment` verifica `count(users) where department_id = x` y bloquea si > 0. UI muestra el count antes.

5. **Pack 4 placeholder confunde.** Mitigación: banner amarillo grande en `/sincronizacion` con texto "EN DESARROLLO" + link al doc.

6. **Migrations 18-21 colisionan con drift de remote.** Mitigación: aplicar `migration repair` patron como hicimos con 12-17 si la CLI rechaza, o renumerar a 22-25 si remote ya tiene 18+.

7. **Cache de `org_settings` en memoria (Map global).** Mitigación: TTL 30s. Para invalidación immediate tras `setOrgSetting`, el setter borra la entry del cache. Multi-instance: cada Vercel function instance tiene su propio cache pero TTL corto basta.

8. **Conflictos paralelos en `src/types/database.augmentation.ts`.** Mitigación: Wave 1 escribe TODOS los tipos nuevos antes de Wave 2. Wave 2 solo importa.

9. **Feature flag desactiva IA pero el botón sigue clickeable.** Mitigación: el endpoint IA devuelve 503 si flag off, frontend muestra toast "IA desactivada por RH".

---

## Aceptación

### Pack 1
- AH edita cadencia global desde UI (cambio persistido en `cadence_configs`)
- AH crea cadencia por área y la elimina sin tocar global
- AH crea regla "calidez_baja → email HR" y al disparar test, aparece en `notification_dispatches`
- AH toggle on/off de una regla sin perder config
- AH CRUD de departamentos respetando integridad referencial
- Cron `/api/cron/check-thresholds` corre cada 30 min y dispatcha sin duplicados

### Pack 2
- AH ajusta umbral de baja calidad de 3.0 a 3.5 desde `/parametros` → reporte `arquitectura-humana/reportes` recalcula al recargar
- AH cambia las 5 preguntas Likert → colab ve las nuevas en la próxima 1:1
- AH desactiva `extract_agreements` → guardar minuta no extrae nada, toast informa
- AH cambia model a haiku → siguientes calls IA usan haiku

### Pack 3
- AH baja CSV de cumplimiento del mes en 1 click
- AH baja CSV de acuerdos con filtros (estado, área)
- AH crea reporte programado mensual → al pasar `next_run_at`, llega email
- AH ejecuta reporte manualmente desde la UI

### Pack 4
- Doc de spec extendido committeado
- `/arquitectura-humana/sincronizacion` muestra placeholder claro

### Gates globales
- `pnpm tsc -b` + `pnpm build` zero-error
- Visual regression OK vía `pnpm tsx scripts/review-all.ts`
- RLS verificado manualmente
- Dark mode parity en las 4 rutas nuevas
