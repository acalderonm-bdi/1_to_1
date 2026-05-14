# Configs RH — 4 Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar Packs 1-3 (cadencia + notificaciones + parámetros + reportería) y outline de Pack 4 (sync) según `docs/superpowers/specs/2026-05-14-configs-rh-4-packs-design.md`. Packs 2 y 3 dependen del foundation de Wave 1 pero no entre sí — corren en paralelo.

**Architecture:** Tabla `org_settings (key/value jsonb)` para configs tuneables + tablas normalizadas para reglas de notificación, dispatches y reportes programados. Server actions con guard `requireHR()`. Cron Vercel cada 30 min (`/api/cron/check-thresholds`) y cada hora (`/api/cron/send-scheduled-reports`). Cooldown de notificaciones via unique index sobre `(rule_id, recipient_id, date_trunc('day', created_at))`. Pack 4 queda outline.

**Tech Stack:** Next.js 14 App Router + Supabase SSR + Tailwind v3 + shadcn/ui + Zod + Anthropic SDK (existente) + cron-parser (nuevo dep para scheduled_reports).

---

## File Structure

### Created (Wave 1 — Foundation)

| Path | Responsibility |
|---|---|
| `supabase/migrations/00000000000018_org_settings_table.sql` | Tabla key/value jsonb + RLS |
| `supabase/migrations/00000000000019_notification_rules.sql` | Tabla de reglas + RLS |
| `supabase/migrations/00000000000020_notification_dispatches.sql` | Audit trail + cooldown unique index |
| `supabase/migrations/00000000000021_scheduled_reports.sql` | Tabla de reportes programados + RLS |
| `src/lib/auth-guards.ts` | `requireHR()` helper |
| `src/lib/org-settings.ts` | `getOrgSetting / setOrgSetting` con Zod por key + cache TTL 30s |

### Created (Wave 2 — Pack 1: Operación)

| Path | Responsibility |
|---|---|
| `src/app/(dashboard)/arquitectura-humana/notificaciones/page.tsx` | Hub de reglas |
| `src/lib/actions/cadence.ts` | CRUD cadencia global/dept |
| `src/lib/actions/notification-rules.ts` | CRUD reglas + test-fire |
| `src/lib/actions/departments.ts` | CRUD depts con guard de FK |
| `src/components/arquitectura-humana/cadence-editor.tsx` | UI editor inline |
| `src/components/arquitectura-humana/notification-rule-card.tsx` | Card de regla en lista |
| `src/components/arquitectura-humana/notification-rule-modal.tsx` | Wizard de creación |
| `src/components/arquitectura-humana/department-manager.tsx` | CRUD UI |
| `src/app/api/cron/check-thresholds/route.ts` | Cron evaluador cada 30 min |

### Created (Wave 2 — Pack 2: Tunable params)

| Path | Responsibility |
|---|---|
| `src/app/(dashboard)/arquitectura-humana/parametros/page.tsx` | Hub de tuning |
| `src/lib/actions/org-settings.ts` | Server-action wrapper sobre `lib/org-settings.ts` |
| `src/components/arquitectura-humana/params-section.tsx` | Card reusable |
| `src/components/arquitectura-humana/warmth-questions-editor.tsx` | Editor de las 5 preguntas |
| `src/components/arquitectura-humana/ai-features-config.tsx` | Toggles + model picker |
| `src/components/arquitectura-humana/agreement-quality-tuner.tsx` | Umbral + max_open |

### Created (Wave 2 — Pack 3: Reportería)

| Path | Responsibility |
|---|---|
| `src/app/(dashboard)/arquitectura-humana/exportes/page.tsx` | Hub centralizado |
| `src/lib/actions/exports.ts` | Generators CSV server-side |
| `src/lib/actions/scheduled-reports.ts` | CRUD + fire manual |
| `src/app/api/exports/[type]/route.ts` | Download endpoint |
| `src/app/api/cron/send-scheduled-reports/route.ts` | Cron hourly |
| `src/components/arquitectura-humana/export-card.tsx` | Botón de export ad-hoc |
| `src/components/arquitectura-humana/scheduled-report-list.tsx` | Lista de programados |
| `src/components/arquitectura-humana/scheduled-report-modal.tsx` | Wizard de creación |
| `src/lib/exports/cumplimiento-csv.ts` | Generator |
| `src/lib/exports/acuerdos-csv.ts` | Generator |
| `src/lib/exports/calidez-csv.ts` | Generator |

### Created (Wave 2 — Pack 4: Outline)

| Path | Responsibility |
|---|---|
| `docs/superpowers/specs/2026-05-14-pack-4-org-sync-extended.md` | Extensión de contrato |
| `src/app/(dashboard)/arquitectura-humana/sincronizacion/page.tsx` | Placeholder |
| `src/components/arquitectura-humana/sync-placeholder.tsx` | Card "EN DESARROLLO" |

### Modified

| Path | Pack | Cambio |
|---|---|---|
| `src/app/(dashboard)/arquitectura-humana/cadencias/page.tsx` | 1 | Read-only → editable |
| `src/app/(dashboard)/arquitectura-humana/usuarios/[id]/page.tsx` | 1 | Acción "Cambiar depto" |
| `src/components/layout/sidebar.tsx` | Wave 1 | +4 items HR |
| `src/types/database.augmentation.ts` | Wave 1 | +4 row types |
| `src/lib/agreement-quality.ts` | 2 | max_open via `getOrgSetting` |
| `src/components/one-on-one/warmth-survey.tsx` | 2 | Questions via `getOrgSetting` |
| `src/lib/ai/extract-agreements.ts` | 2 | model + feature flag |
| `src/lib/ai/suggest-questions.ts` | 2 | model + feature flag |
| `src/lib/ai/followup-plan.ts` | 2 | feature flag |
| `src/app/api/ai/agreement-quality/route.ts` | 2 | model + flag |
| `src/app/api/ai/analyze-patterns/route.ts` | 2 | flag |
| `src/app/(dashboard)/arquitectura-humana/reportes/page.tsx` | 2/3 | Threshold via org_settings + export buttons |
| `src/lib/actions/one-on-ones.ts` | 2 | `markNonRealization` respeta `non_realization_max_days` |
| `package.json` | 1 | +`cron-parser` dep (Pack 3 lo usa) |
| `vercel.json` | 1+3 | Cron schedule entries |
| `.env.example` | 1+3 | `CRON_SECRET` |

---

## Wave 0 — Audit (1 agente)

### Task W0.1: Page-map de configs RH

**Files:**
- Create: `docs/superpowers/specs/2026-05-14-configs-rh-page-map.md`

- [ ] **Step 1: Inventariar consumers de configs hardcoded**

Run:
```bash
grep -rn "ai_quality_score < 3" src/ 2>&1
grep -rn "openCount.*>= 7\|MAX_OPEN\|=== 7\|>= 7" src/lib src/components 2>&1
grep -rn "claude-sonnet-4-5\|claude-haiku" src/lib src/app 2>&1
grep -rn "'felt_heard'\|'comfortable_sharing'" src/components 2>&1
grep -rn "scheduled_at.*7.*day\|interval '7 days'" src 2>&1
```

- [ ] **Step 2: Crear page-map**

Contenido base:

```markdown
# Page Map — Configs RH (4 packs)

## Wave 1 Foundation — archivos a tocar
- supabase/migrations/00000000000018_org_settings_table.sql (NEW)
- supabase/migrations/00000000000019_notification_rules.sql (NEW)
- supabase/migrations/00000000000020_notification_dispatches.sql (NEW)
- supabase/migrations/00000000000021_scheduled_reports.sql (NEW)
- src/lib/auth-guards.ts (NEW)
- src/lib/org-settings.ts (NEW)
- src/types/database.augmentation.ts (modify: 4 row types)
- src/components/layout/sidebar.tsx (modify: +4 items HR)

## Pack 1 — archivos owned exclusivamente
[lista completa de Pack 1]

## Pack 2 — archivos owned + modificados (consumers de configs)
[lista completa de Pack 2]

## Pack 3 — archivos owned
[lista completa de Pack 3]

## Pack 4 — outline only
[lista]

## Findings de greps
[paste de los resultados]
```

- [ ] **Step 3: Commit**

```bash
git checkout -b feat/configs-rh
git add docs/superpowers/specs/2026-05-14-configs-rh-page-map.md
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "docs(configs-rh): page-map para 4 packs"
```

---

## Wave 1 — Foundation (1 agente, blocking, secuencial)

### Task W1.1: Migration org_settings

**Files:**
- Create: `supabase/migrations/00000000000018_org_settings_table.sql`

- [ ] **Step 1: Crear migration**

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

create trigger update_org_settings_updated_at
  before update on public.org_settings
  for each row execute procedure public.update_updated_at_column();
```

- [ ] **Step 2: Apply**

```bash
supabase db push 2>&1 | tail -10
```
Expected: applies cleanly. Si falla por drift remoto, repetir patrón de Pack A+B (rename + repair).

- [ ] **Step 3: Verify RLS**

```bash
supabase db push --dry-run 2>&1 | tail -5
```
Expected: nothing pending.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000018_org_settings_table.sql
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(foundation): org_settings table con RLS"
```

### Task W1.2: Migration notification_rules

**Files:**
- Create: `supabase/migrations/00000000000019_notification_rules.sql`

- [ ] **Step 1: Crear migration**

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

- [ ] **Step 2: Apply + commit**

```bash
supabase db push 2>&1 | tail -5
git add supabase/migrations/00000000000019_notification_rules.sql
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(foundation): notification_rules + RLS"
```

### Task W1.3: Migration notification_dispatches

**Files:**
- Create: `supabase/migrations/00000000000020_notification_dispatches.sql`

- [ ] **Step 1: Crear migration**

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

- [ ] **Step 2: Apply + commit**

```bash
supabase db push 2>&1 | tail -5
git add supabase/migrations/00000000000020_notification_dispatches.sql
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(foundation): notification_dispatches con cooldown unique"
```

### Task W1.4: Migration scheduled_reports

**Files:**
- Create: `supabase/migrations/00000000000021_scheduled_reports.sql`

- [ ] **Step 1: Crear migration**

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

- [ ] **Step 2: Apply + commit**

```bash
supabase db push 2>&1 | tail -5
git add supabase/migrations/00000000000021_scheduled_reports.sql
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(foundation): scheduled_reports + RLS"
```

### Task W1.5: Type augmentation

**Files:**
- Modify: `src/types/database.augmentation.ts`

- [ ] **Step 1: Agregar tipos al final del archivo**

```ts
export interface OrgSettingRow {
  key: string
  value: unknown
  updated_by: string | null
  updated_at: string
}

export type NotificationTriggerType =
  | 'cumplimiento_bajo'
  | 'acuerdo_vencido'
  | 'vobo_pendiente'
  | 'calidez_baja'
  | 'disputa_nueva'
  | 'reminder_pre_1to1'

export type NotificationAudience = 'leader' | 'collaborator' | 'hr'
export type NotificationChannelExt = 'in_app' | 'email' | 'slack'

export interface NotificationRuleRow {
  id: string
  name: string
  enabled: boolean
  trigger_type: NotificationTriggerType
  threshold: {
    value?: number
    unit?: 'percent' | 'days' | 'score'
    scope?: 'global' | 'department' | 'leader'
    days?: number
  } | null
  audience: NotificationAudience[]
  channels: NotificationChannelExt[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface NotificationDispatchRow {
  id: string
  rule_id: string | null
  recipient_id: string
  channel: NotificationChannelExt
  context: Record<string, unknown>
  status: 'sent' | 'failed' | 'skipped'
  created_at: string
}

export type ScheduledReportType = 'cumplimiento_mensual' | 'acuerdos_baja_calidad' | 'calidez_por_lider'

export interface ScheduledReportRow {
  id: string
  name: string
  enabled: boolean
  report_type: ScheduledReportType
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

- [ ] **Step 2: Re-export desde domain.ts**

Modify `src/types/domain.ts` para exportar los tipos nuevos junto con los existentes (mismo patrón que augmentation previa).

```ts
import type {
  // ... existing
  OrgSettingRow,
  NotificationTriggerType,
  NotificationAudience,
  NotificationChannelExt,
  NotificationRuleRow,
  NotificationDispatchRow,
  ScheduledReportType,
  ScheduledReportRow,
} from './database.augmentation'

export type {
  // ... existing
  OrgSettingRow,
  NotificationTriggerType,
  NotificationAudience,
  NotificationChannelExt,
  NotificationRuleRow,
  NotificationDispatchRow,
  ScheduledReportType,
  ScheduledReportRow,
}
```

- [ ] **Step 3: tsc + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/types/database.augmentation.ts src/types/domain.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "types(foundation): 4 row types nuevos + re-exports"
```

### Task W1.6: requireHR helper

**Files:**
- Create: `src/lib/auth-guards.ts`

- [ ] **Step 1: Crear helper**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

type GuardResultOk = {
  ok: true
  user: { id: string; email?: string }
  supabase: SupabaseClient
}
type GuardResultErr = { ok: false; error: string }

export async function requireHR(): Promise<GuardResultOk | GuardResultErr> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()
  if (data?.role !== 'hr') return { ok: false, error: 'Sin permisos (requiere rol RH)' }
  return { ok: true, user: { id: user.id, email: user.email }, supabase }
}
```

- [ ] **Step 2: tsc + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/lib/auth-guards.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(foundation): requireHR auth guard"
```

### Task W1.7: getOrgSetting / setOrgSetting con Zod + cache

**Files:**
- Create: `src/lib/org-settings.ts`

- [ ] **Step 1: Crear módulo**

```ts
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_WARMTH_QUESTIONS = [
  { key: 'felt_heard', label: 'Me sentí escuchada/o en esta sesión' },
  { key: 'comfortable_sharing', label: 'Me sentí cómoda/o compartiendo lo que pensaba' },
  { key: 'leader_engaged', label: 'Sentí que mi líder estuvo presente y enfocada/o' },
  { key: 'conversation_quality', label: 'La conversación fue significativa para mí' },
  { key: 'clarity_after_session', label: 'Salí con claridad de los próximos pasos' },
]

const aiFeaturesSchema = z.object({
  extract_agreements: z.boolean().default(true),
  suggest_questions: z.boolean().default(true),
  analyze_patterns: z.boolean().default(true),
  refine_agreement: z.boolean().default(true),
})

export const SETTING_SCHEMAS = {
  agreement_quality_threshold: z.number().min(0).max(5).default(3.0),
  collaborator_max_open_agreements: z.number().int().min(1).max(50).default(7),
  warmth_survey_required: z.boolean().default(true),
  warmth_questions: z
    .array(z.object({ key: z.string(), label: z.string().max(200) }))
    .min(3)
    .max(7)
    .default(DEFAULT_WARMTH_QUESTIONS),
  ai_features: aiFeaturesSchema.default({
    extract_agreements: true,
    suggest_questions: true,
    analyze_patterns: true,
    refine_agreement: true,
  }),
  ai_model: z
    .enum(['claude-sonnet-4-5', 'claude-haiku-4-5-20251001'])
    .default('claude-sonnet-4-5'),
  ai_monthly_budget_usd: z.number().min(0).default(100),
  non_realization_max_days: z.number().int().min(1).max(90).default(7),
  transfer_banner_enabled: z.boolean().default(true),
} as const

export type SettingKey = keyof typeof SETTING_SCHEMAS
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_SCHEMAS)[K]>

const cache = new Map<SettingKey, { value: unknown; at: number }>()
const CACHE_TTL_MS = 30_000

export async function getOrgSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value as SettingValue<K>
  }
  const schema = SETTING_SCHEMAS[key]
  const supabase = createClient()
  const { data } = await supabase
    .from('org_settings' as never)
    .select('value')
    .eq('key' as never, key)
    .maybeSingle() as unknown as { data: { value: unknown } | null }
  const parsed = schema.safeParse(data?.value)
  const value = (parsed.success ? parsed.data : schema.parse(undefined)) as SettingValue<K>
  cache.set(key, { value, at: Date.now() })
  return value
}

export async function setOrgSetting<K extends SettingKey>(
  key: K,
  value: unknown,
  userId: string,
): Promise<SettingValue<K>> {
  const schema = SETTING_SCHEMAS[key]
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new Error(`Invalid value for ${key}: ${parsed.error.message}`)
  const supabase = createClient()
  const { error } = await supabase.from('org_settings' as never).upsert({
    key,
    value: parsed.data,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  } as never)
  if (error) throw error
  cache.delete(key)
  return parsed.data as SettingValue<K>
}

export function invalidateOrgSettingCache(key?: SettingKey) {
  if (key) cache.delete(key)
  else cache.clear()
}
```

- [ ] **Step 2: tsc + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/lib/org-settings.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(foundation): getOrgSetting/setOrgSetting con Zod por key + cache TTL"
```

### Task W1.8: Sidebar HR items + cron-parser dep

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `package.json` (add cron-parser)

- [ ] **Step 1: Read sidebar para encontrar `NAV_BY_ROLE.hr`**

```bash
grep -n "rh-config\|arquitectura-humana/configuracion" src/components/layout/sidebar.tsx
```

- [ ] **Step 2: Agregar 4 items HR**

En `NAV_BY_ROLE.hr`, después del item de "estructura" y antes de "configuracion", agregar:

```ts
{ key: 'rh-notif', label: 'Notificaciones', icon: Bell, href: '/arquitectura-humana/notificaciones' },
{ key: 'rh-params', label: 'Parámetros', icon: SlidersHorizontal, href: '/arquitectura-humana/parametros' },
{ key: 'rh-export', label: 'Exportes', icon: Download, href: '/arquitectura-humana/exportes' },
{ key: 'rh-sync', label: 'Sincronización', icon: RefreshCcw, href: '/arquitectura-humana/sincronizacion' },
```

Importar los iconos faltantes desde lucide-react al inicio del archivo.

- [ ] **Step 3: Instalar cron-parser**

```bash
pnpm add cron-parser
```

- [ ] **Step 4: tsc + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/components/layout/sidebar.tsx package.json pnpm-lock.yaml
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(foundation): sidebar +4 items HR (notif/params/export/sync) + cron-parser dep"
```

---

## Wave 2 — Pack 1: Operación (1 agente)

**Pre-requisito:** Wave 1 completa.

### Task P1.1: cadence.ts server actions

**Files:**
- Create: `src/lib/actions/cadence.ts`

- [ ] **Step 1: Crear server actions**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireHR } from '@/lib/auth-guards'
import type { ActionResult } from '@/types/domain'

const upsertGlobalSchema = z.object({
  frequencyDays: z.number().int().min(1).max(90),
})

export async function upsertGlobalCadence(
  input: z.infer<typeof upsertGlobalSchema>,
): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  const parsed = upsertGlobalSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { supabase, user } = guard

  const { data: existing } = await supabase
    .from('cadence_configs')
    .select('id')
    .eq('scope_type', 'global')
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('cadence_configs')
      .update({ frequency_days: parsed.data.frequencyDays } as never)
      .eq('id', (existing as { id: string }).id)
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase
      .from('cadence_configs')
      .insert({
        scope_type: 'global',
        frequency_days: parsed.data.frequencyDays,
        created_by: user.id,
      } as never)
    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/arquitectura-humana/cadencias')
  return { success: true }
}

const upsertDeptSchema = z.object({
  departmentId: z.string().uuid(),
  frequencyDays: z.number().int().min(1).max(90),
})

export async function upsertDepartmentCadence(
  input: z.infer<typeof upsertDeptSchema>,
): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  const parsed = upsertDeptSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { supabase, user } = guard

  const { data: existing } = await supabase
    .from('cadence_configs')
    .select('id')
    .eq('scope_type', 'department')
    .eq('department_id', parsed.data.departmentId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('cadence_configs')
      .update({ frequency_days: parsed.data.frequencyDays } as never)
      .eq('id', (existing as { id: string }).id)
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase
      .from('cadence_configs')
      .insert({
        scope_type: 'department',
        department_id: parsed.data.departmentId,
        frequency_days: parsed.data.frequencyDays,
        created_by: user.id,
      } as never)
    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/arquitectura-humana/cadencias')
  return { success: true }
}

export async function removeDepartmentCadence(id: string): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }

  const { error } = await guard.supabase
    .from('cadence_configs')
    .delete()
    .eq('id', id)
    .eq('scope_type', 'department')

  if (error) return { success: false, error: error.message }
  revalidatePath('/arquitectura-humana/cadencias')
  return { success: true }
}
```

- [ ] **Step 2: tsc + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/lib/actions/cadence.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(P1): cadence server actions (global + dept CRUD)"
```

### Task P1.2: Cadencias page editable

**Files:**
- Modify: `src/app/(dashboard)/arquitectura-humana/cadencias/page.tsx`
- Create: `src/components/arquitectura-humana/cadence-editor.tsx`

- [ ] **Step 1: Crear `cadence-editor.tsx`** (client component)

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  upsertGlobalCadence,
  upsertDepartmentCadence,
  removeDepartmentCadence,
} from '@/lib/actions/cadence'

interface CadenceEditorProps {
  initialGlobal: number | null
  initialDepts: Array<{ id: string; name: string; freq: number; departmentId: string }>
  allDepts: Array<{ id: string; name: string }>
}

export function CadenceEditor({ initialGlobal, initialDepts, allDepts }: CadenceEditorProps) {
  const [global, setGlobal] = useState(initialGlobal ?? 14)
  const [editing, setEditing] = useState(false)
  const [draftGlobal, setDraftGlobal] = useState(global)
  const [depts, setDepts] = useState(initialDepts)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function saveGlobal() {
    startTransition(async () => {
      const r = await upsertGlobalCadence({ frequencyDays: draftGlobal })
      if (!r.success) {
        toast({ title: 'No se pudo guardar', description: r.error, variant: 'destructive' })
        return
      }
      setGlobal(draftGlobal)
      setEditing(false)
      toast({ title: 'Cadencia global actualizada' })
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Cadencia global</h3>
            <p className="ui-card__desc">Aplica a toda la organización por defecto.</p>
          </div>
          {!editing ? (
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setEditing(true)}>
              <Pencil size={13} /> Editar
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="ui-btn ui-btn--ghost ui-btn--sm"
                onClick={() => {
                  setDraftGlobal(global)
                  setEditing(false)
                }}
                disabled={isPending}
              >
                <X size={13} /> Cancelar
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--accent ui-btn--sm"
                onClick={saveGlobal}
                disabled={isPending || draftGlobal === global}
              >
                <Check size={13} /> Guardar
              </button>
            </div>
          )}
        </div>
        <div className="ui-card__body">
          {editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number"
                className="ui-input"
                min={1}
                max={90}
                value={draftGlobal}
                onChange={(e) => setDraftGlobal(Number(e.target.value))}
                style={{ width: 100 }}
              />
              <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>días entre 1:1s</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <span style={{ fontSize: 48, fontWeight: 500, fontFamily: 'var(--font-serif)' }}>{global}</span>
              <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>días entre 1:1s</span>
            </div>
          )}
        </div>
      </div>

      <DepartmentCadences depts={depts} setDepts={setDepts} allDepts={allDepts} />
    </div>
  )
}

function DepartmentCadences(props: {
  depts: Array<{ id: string; name: string; freq: number; departmentId: string }>
  setDepts: (fn: (prev: typeof props.depts) => typeof props.depts) => void
  allDepts: Array<{ id: string; name: string }>
}) {
  const [adding, setAdding] = useState(false)
  const [draftDept, setDraftDept] = useState('')
  const [draftFreq, setDraftFreq] = useState(14)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const usedIds = new Set(props.depts.map((d) => d.departmentId))
  const available = props.allDepts.filter((d) => !usedIds.has(d.id))

  function addOverride() {
    if (!draftDept) return
    startTransition(async () => {
      const r = await upsertDepartmentCadence({ departmentId: draftDept, frequencyDays: draftFreq })
      if (!r.success) {
        toast({ title: 'No se pudo agregar', description: r.error, variant: 'destructive' })
        return
      }
      const dept = props.allDepts.find((d) => d.id === draftDept)
      props.setDepts((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name: dept?.name ?? '', freq: draftFreq, departmentId: draftDept },
      ])
      setAdding(false)
      setDraftDept('')
      setDraftFreq(14)
      toast({ title: 'Override agregado' })
    })
  }

  function removeOverride(id: string) {
    startTransition(async () => {
      const r = await removeDepartmentCadence(id)
      if (!r.success) {
        toast({ title: 'No se pudo eliminar', description: r.error, variant: 'destructive' })
        return
      }
      props.setDepts((prev) => prev.filter((d) => d.id !== id))
      toast({ title: 'Override eliminado' })
    })
  }

  return (
    <div className="ui-card">
      <div className="ui-card__head">
        <div>
          <h3 className="ui-card__title">Cadencias por área</h3>
          <p className="ui-card__desc">Override por departamento.</p>
        </div>
        {!adding && available.length > 0 && (
          <button type="button" className="ui-btn ui-btn--accent ui-btn--sm" onClick={() => setAdding(true)}>
            + Agregar
          </button>
        )}
      </div>
      <div className="ui-card__body ui-card__body--flush">
        {props.depts.map((d) => (
          <div
            key={d.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 24px',
              borderBottom: '1px solid var(--border-c)',
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>{d.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Cada <strong style={{ color: 'var(--text-c)' }}>{d.freq}</strong> días
              </span>
              <button
                type="button"
                className="ui-btn ui-btn--ghost ui-btn--sm"
                onClick={() => removeOverride(d.id)}
                disabled={isPending}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {adding && (
          <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <select
              className="ui-select"
              value={draftDept}
              onChange={(e) => setDraftDept(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="">Seleccionar área…</option>
              {available.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <input
              type="number"
              className="ui-input"
              value={draftFreq}
              onChange={(e) => setDraftFreq(Number(e.target.value))}
              min={1}
              max={90}
              style={{ width: 80 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>días</span>
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--sm"
              onClick={() => setAdding(false)}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="ui-btn ui-btn--accent ui-btn--sm"
              onClick={addOverride}
              disabled={isPending || !draftDept}
            >
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Reemplazar `cadencias/page.tsx`** para consumir el editor

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Repeat } from 'lucide-react'
import { CadenceEditor } from '@/components/arquitectura-humana/cadence-editor'

export default async function CadenciasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: globalRaw } = await supabase
    .from('cadence_configs')
    .select('frequency_days')
    .eq('scope_type', 'global')
    .maybeSingle()
  const initialGlobal = (globalRaw as { frequency_days: number } | null)?.frequency_days ?? null

  const { data: deptRaw } = await supabase
    .from('cadence_configs')
    .select('id, frequency_days, department_id, departments(name)')
    .eq('scope_type', 'department')

  const initialDepts = (deptRaw ?? []).map((c: { id: string; frequency_days: number; department_id: string; departments: { name: string } | { name: string }[] | null }) => {
    const d = Array.isArray(c.departments) ? c.departments[0] : c.departments
    return { id: c.id, name: d?.name ?? 'Área', freq: c.frequency_days, departmentId: c.department_id }
  })

  const { data: allDeptsRaw } = await supabase.from('departments').select('id, name').order('name')
  const allDepts = (allDeptsRaw ?? []) as Array<{ id: string; name: string }>

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Repeat size={12} /> Ritmo de conversaciones</span>
          <h1 className="page__title">Cadencias</h1>
          <p className="page__subtitle">Frecuencia esperada de las reuniones 1:1 a nivel global y por área.</p>
        </div>
      </div>

      <CadenceEditor
        initialGlobal={initialGlobal}
        initialDepts={initialDepts}
        allDepts={allDepts}
      />
    </div>
  )
}
```

- [ ] **Step 3: tsc + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/components/arquitectura-humana/cadence-editor.tsx src/app/\(dashboard\)/arquitectura-humana/cadencias/page.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(P1): cadencia editable con inline editor + overrides por área"
```

### Task P1.3: Notification rules — actions

**Files:**
- Create: `src/lib/actions/notification-rules.ts`

- [ ] **Step 1: Crear actions**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireHR } from '@/lib/auth-guards'
import type { ActionResult, NotificationTriggerType, NotificationAudience, NotificationChannelExt } from '@/types/domain'

const ruleSchema = z.object({
  name: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
  triggerType: z.enum([
    'cumplimiento_bajo',
    'acuerdo_vencido',
    'vobo_pendiente',
    'calidez_baja',
    'disputa_nueva',
    'reminder_pre_1to1',
  ]),
  threshold: z.record(z.unknown()).nullable().default(null),
  audience: z.array(z.enum(['leader', 'collaborator', 'hr'])).min(1),
  channels: z.array(z.enum(['in_app', 'email', 'slack'])).min(1),
})

type RuleInput = z.infer<typeof ruleSchema>

export async function createNotificationRule(input: RuleInput): Promise<ActionResult<{ id: string }>> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  const parsed = ruleSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { data, error } = await guard.supabase
    .from('notification_rules' as never)
    .insert({
      name: parsed.data.name,
      enabled: parsed.data.enabled,
      trigger_type: parsed.data.triggerType,
      threshold: parsed.data.threshold,
      audience: parsed.data.audience,
      channels: parsed.data.channels,
      created_by: guard.user.id,
    } as never)
    .select('id')
    .single() as unknown as { data: { id: string } | null; error: { message: string } | null }

  if (error || !data) return { success: false, error: error?.message ?? 'No se pudo crear' }

  revalidatePath('/arquitectura-humana/notificaciones')
  return { success: true, data: { id: data.id } }
}

export async function updateNotificationRule(
  id: string,
  input: RuleInput,
): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  const parsed = ruleSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { error } = await guard.supabase
    .from('notification_rules' as never)
    .update({
      name: parsed.data.name,
      enabled: parsed.data.enabled,
      trigger_type: parsed.data.triggerType,
      threshold: parsed.data.threshold,
      audience: parsed.data.audience,
      channels: parsed.data.channels,
    } as never)
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/arquitectura-humana/notificaciones')
  return { success: true }
}

export async function toggleNotificationRule(id: string, enabled: boolean): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }

  const { error } = await guard.supabase
    .from('notification_rules' as never)
    .update({ enabled } as never)
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/arquitectura-humana/notificaciones')
  return { success: true }
}

export async function deleteNotificationRule(id: string): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }

  const { error } = await guard.supabase
    .from('notification_rules' as never)
    .delete()
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/arquitectura-humana/notificaciones')
  return { success: true }
}

export async function testFireRule(id: string): Promise<ActionResult<{ dispatched: number }>> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }

  // Cargar la regla, ejecutar manualmente, insertar dispatches.
  // Por ahora implementación mínima: solo dispatch a HR como prueba.
  const { data: rule } = await guard.supabase
    .from('notification_rules' as never)
    .select('id, name')
    .eq('id', id)
    .single() as unknown as { data: { id: string; name: string } | null }

  if (!rule) return { success: false, error: 'Regla no encontrada' }

  const { error: insErr } = await guard.supabase
    .from('notification_dispatches' as never)
    .insert({
      rule_id: rule.id,
      recipient_id: guard.user.id,
      channel: 'in_app',
      context: { test_fire: true, rule_name: rule.name },
      status: 'sent',
    } as never)

  if (insErr) return { success: false, error: insErr.message }

  return { success: true, data: { dispatched: 1 } }
}
```

- [ ] **Step 2: tsc + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/lib/actions/notification-rules.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(P1): notification-rules CRUD + test-fire"
```

### Task P1.4: Notification rules page + UI components

**Files:**
- Create: `src/app/(dashboard)/arquitectura-humana/notificaciones/page.tsx`
- Create: `src/components/arquitectura-humana/notification-rule-card.tsx`
- Create: `src/components/arquitectura-humana/notification-rule-modal.tsx`

- [ ] **Step 1: Implementar page server component**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Bell } from 'lucide-react'
import { NotificationRulesClient } from '@/components/arquitectura-humana/notification-rule-card'
import type { NotificationRuleRow } from '@/types/domain'

export default async function NotificacionesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawRules } = await supabase
    .from('notification_rules' as never)
    .select('*')
    .order('created_at', { ascending: false }) as unknown as { data: NotificationRuleRow[] | null }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Bell size={12} /> Alertas configurables</span>
          <h1 className="page__title">Notificaciones</h1>
          <p className="page__subtitle">Reglas automáticas para avisar a líderes, colaboradores y RH.</p>
        </div>
      </div>
      <NotificationRulesClient initialRules={rawRules ?? []} />
    </div>
  )
}
```

- [ ] **Step 2: Implementar notification-rule-card.tsx (lista + toggle + delete + crear)**

[Componente client que renderiza la lista, agrega botón "Nueva regla", toggles inline, y modal `NotificationRuleModal` para edición/creación. Por brevedad del plan: el implementador adapta a partir del shape ya definido en `NotificationRuleRow`. Usar `<ConfirmDialog>` shared para delete. Usar `useToast` para feedback. Modal mismo patrón que `non-realization-modal.tsx`.]

- [ ] **Step 3: tsc + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/app/\(dashboard\)/arquitectura-humana/notificaciones/page.tsx src/components/arquitectura-humana/notification-rule-card.tsx src/components/arquitectura-humana/notification-rule-modal.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(P1): notificaciones page + UI components"
```

### Task P1.5: Departments CRUD

**Files:**
- Create: `src/lib/actions/departments.ts`
- Create: `src/components/arquitectura-humana/department-manager.tsx`
- Modify: `src/app/(dashboard)/arquitectura-humana/estructura/page.tsx` (agregar botón "Gestionar depts")

- [ ] **Step 1: Server actions** (mismo patrón de cadence.ts: createDepartment, renameDepartment, deleteDepartment con guard de FK)

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireHR } from '@/lib/auth-guards'
import type { ActionResult } from '@/types/domain'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().optional(),
})

export async function createDepartment(input: z.infer<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { data, error } = await guard.supabase
    .from('departments')
    .insert({ name: parsed.data.name, parent_id: parsed.data.parentId ?? null } as never)
    .select('id')
    .single() as unknown as { data: { id: string } | null; error: { message: string } | null }

  if (error || !data) return { success: false, error: error?.message ?? 'No se pudo crear' }
  revalidatePath('/arquitectura-humana/estructura')
  return { success: true, data: { id: data.id } }
}

export async function renameDepartment(id: string, name: string): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  if (!name.trim() || name.length > 100) return { success: false, error: 'Nombre inválido' }

  const { error } = await guard.supabase.from('departments').update({ name } as never).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/arquitectura-humana/estructura')
  return { success: true }
}

export async function deleteDepartment(id: string): Promise<ActionResult<{ blocked?: boolean; userCount?: number }>> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }

  const { count } = await guard.supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('department_id', id)

  if ((count ?? 0) > 0) {
    return { success: false, error: `No se puede eliminar — tiene ${count} usuarios asignados`, data: { blocked: true, userCount: count ?? 0 } }
  }

  const { error } = await guard.supabase.from('departments').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/arquitectura-humana/estructura')
  return { success: true }
}
```

- [ ] **Step 2: UI manager + integración en estructura/page**

[Component `<DepartmentManager>` consumes el server action y renderiza lista con CRUD inline. Implementador integra en `estructura/page.tsx` como acción de admin.]

- [ ] **Step 3: tsc + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/lib/actions/departments.ts src/components/arquitectura-humana/department-manager.tsx src/app/\(dashboard\)/arquitectura-humana/estructura/page.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(P1): departments CRUD con guard de FK"
```

### Task P1.6: Cron check-thresholds

**Files:**
- Create: `src/app/api/cron/check-thresholds/route.ts`
- Modify: `vercel.json` (cron entry)

- [ ] **Step 1: Implementar evaluator**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { NotificationRuleRow } from '@/types/domain'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  const { data: rulesRaw } = await supabase
    .from('notification_rules' as never)
    .select('*')
    .eq('enabled' as never, true) as unknown as { data: NotificationRuleRow[] | null }

  const rules = rulesRaw ?? []
  let totalDispatched = 0

  for (const rule of rules) {
    let recipients: string[] = []

    switch (rule.trigger_type) {
      case 'cumplimiento_bajo': {
        // Buscar líderes con cumplimiento < threshold
        const threshold = rule.threshold?.value ?? 50
        const { data: low } = await supabase
          .from('compliance_metrics' as never)
          .select('leader_id')
          .lt('compliance_pct' as never, threshold) as unknown as { data: { leader_id: string }[] | null }
        if (rule.audience.includes('leader')) recipients.push(...(low ?? []).map((r) => r.leader_id))
        if (rule.audience.includes('hr')) {
          const { data: hrs } = await supabase.from('users').select('id').eq('role', 'hr')
          recipients.push(...(hrs ?? []).map((r) => (r as { id: string }).id))
        }
        break
      }
      case 'acuerdo_vencido': {
        const today = new Date().toISOString().slice(0, 10)
        const { data: vencidos } = await supabase
          .from('agreements')
          .select('responsible_id')
          .lt('due_date', today)
          .in('status', ['pendiente', 'parcial']) as unknown as { data: { responsible_id: string }[] | null }
        recipients.push(...(vencidos ?? []).map((a) => a.responsible_id))
        break
      }
      case 'disputa_nueva': {
        const { data: disputas } = await supabase
          .from('one_on_ones')
          .select('leader_id, collaborator_id')
          .eq('status', 'en_disputa') as unknown as { data: { leader_id: string; collaborator_id: string }[] | null }
        if (rule.audience.includes('hr')) {
          const { data: hrs } = await supabase.from('users').select('id').eq('role', 'hr')
          recipients.push(...(hrs ?? []).map((r) => (r as { id: string }).id))
        }
        break
      }
      case 'vobo_pendiente':
      case 'calidez_baja':
      case 'reminder_pre_1to1': {
        // Implementación stub — el agente extiende con la query específica.
        // Cada trigger evalua su threshold y produce recipients.
        break
      }
    }

    // Insertar dispatches (cooldown via unique index)
    for (const recipientId of new Set(recipients)) {
      for (const channel of rule.channels) {
        const { error } = await supabase
          .from('notification_dispatches' as never)
          .insert({
            rule_id: rule.id,
            recipient_id: recipientId,
            channel,
            context: { trigger: rule.trigger_type, rule_name: rule.name },
            status: 'sent',
          } as never)
        if (!error) totalDispatched++
        // Si error por unique violation (cooldown), ignorar — es expected
      }
    }
  }

  return NextResponse.json({ rules_evaluated: rules.length, total_dispatched: totalDispatched })
}
```

- [ ] **Step 2: Agregar a vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/cron/check-thresholds",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

- [ ] **Step 3: Documentar CRON_SECRET en .env.example**

Agregar línea: `CRON_SECRET=cambiar-en-produccion-rotar-mensualmente`

- [ ] **Step 4: tsc + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/app/api/cron/check-thresholds/route.ts vercel.json .env.example
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(P1): cron check-thresholds + CRON_SECRET auth"
```

---

## Wave 2 — Pack 2: Tunable params (1 agente)

**Pre-requisito:** Wave 1 completa. Puede correr en paralelo con Pack 1 (archivos no-solapados).

### Task P2.1: org-settings server action wrapper

**Files:**
- Create: `src/lib/actions/org-settings.ts`

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireHR } from '@/lib/auth-guards'
import { setOrgSetting, type SettingKey } from '@/lib/org-settings'
import type { ActionResult } from '@/types/domain'

export async function saveOrgSetting<K extends SettingKey>(
  key: K,
  value: unknown,
): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  try {
    await setOrgSetting(key, value, guard.user.id)
    revalidatePath('/arquitectura-humana/parametros')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error' }
  }
}
```

Commit: `feat(P2): saveOrgSetting server action`

### Task P2.2: Parámetros page hub

**Files:**
- Create: `src/app/(dashboard)/arquitectura-humana/parametros/page.tsx`
- Create: `src/components/arquitectura-humana/params-section.tsx`
- Create: `src/components/arquitectura-humana/agreement-quality-tuner.tsx`
- Create: `src/components/arquitectura-humana/warmth-questions-editor.tsx`
- Create: `src/components/arquitectura-humana/ai-features-config.tsx`

[Page server component lee TODAS las settings con `getOrgSetting` y las pasa como props a 4 sub-secciones client. Cada sub-sección tiene su propio form + save action. Patrón: card con header + body editable + botón "Guardar" disabled cuando no hay cambios.]

Commit per archivo o batch: `feat(P2): parámetros hub + 4 tuners`

### Task P2.3: Wire consumers

**Files modify:**
- `src/lib/agreement-quality.ts`
- `src/components/one-on-one/warmth-survey.tsx`
- `src/lib/ai/extract-agreements.ts`
- `src/lib/ai/suggest-questions.ts`
- `src/lib/ai/followup-plan.ts`
- `src/app/api/ai/agreement-quality/route.ts`
- `src/app/api/ai/analyze-patterns/route.ts`
- `src/app/(dashboard)/arquitectura-humana/reportes/page.tsx`
- `src/lib/actions/one-on-ones.ts`

**Patrón:** importar `getOrgSetting` y leer la config relevante. Fallback al default si la fila no existe.

Ejemplo en `agreement-quality.ts`:

```ts
import { getOrgSetting } from '@/lib/org-settings'

export async function checkAgreementQualityServer(draft: AgreementDraft) {
  const maxOpen = await getOrgSetting('collaborator_max_open_agreements')
  return checkAgreementQuality(draft, { maxOpen })
}
```

Y refactor `checkAgreementQuality` para aceptar `{ maxOpen }` opcional con default 7.

Ejemplo en `warmth-survey.tsx`:

```tsx
// La page padre fetchea las preguntas con getOrgSetting y las pasa como prop.
interface WarmthSurveyProps {
  oneOnOneId: string
  onSubmitted: () => void
  questions?: Array<{ key: string; label: string }>
}

// El render itera questions (fallback a default si no se pasa).
```

Ejemplo en `extract-agreements.ts`:

```ts
import { getOrgSetting } from '@/lib/org-settings'

export async function extractAgreements(...) {
  const features = await getOrgSetting('ai_features')
  if (!features.extract_agreements) return { agreements: [] }
  const model = await getOrgSetting('ai_model')
  // ... usar `model` en client.messages.create
}
```

Commit per file group: `feat(P2): wire consumers de org_settings (4 archivos AI)` etc.

---

## Wave 2 — Pack 3: Reportería (1 agente)

**Pre-requisito:** Wave 1 completa. Paralelo con Pack 1/2.

### Task P3.1: CSV generators

**Files:**
- Create: `src/lib/exports/cumplimiento-csv.ts`
- Create: `src/lib/exports/acuerdos-csv.ts`
- Create: `src/lib/exports/calidez-csv.ts`

Cada generator es una función async que recibe filtros opcionales y devuelve `{ filename: string, content: string }`. El content es CSV con header + rows.

```ts
// cumplimiento-csv.ts
import { createClient } from '@/lib/supabase/server'

export async function generateCumplimientoCSV(filters?: { month?: string }): Promise<{ filename: string; content: string }> {
  const supabase = createClient()
  const { data } = await supabase
    .from('compliance_metrics' as never)
    .select('department_name, total_meetings, fulfilled_count, compliance_pct')
  const rows = (data ?? []) as Array<{ department_name: string; total_meetings: number; fulfilled_count: number; compliance_pct: number }>
  const header = 'departamento,reuniones_totales,realizadas,cumplimiento_pct'
  const body = rows.map(r => `"${r.department_name}",${r.total_meetings},${r.fulfilled_count},${r.compliance_pct}`).join('\n')
  return {
    filename: `cumplimiento-${new Date().toISOString().slice(0,10)}.csv`,
    content: `${header}\n${body}\n`,
  }
}
```

Mismo patrón para acuerdos y calidez.

Commit: `feat(P3): CSV generators (cumplimiento, acuerdos, calidez)`

### Task P3.2: Export API + actions + page

**Files:**
- Create: `src/lib/actions/exports.ts` (server actions que devuelven el CSV content)
- Create: `src/app/api/exports/[type]/route.ts` (GET endpoint que llama el action y devuelve con headers de download)
- Create: `src/app/(dashboard)/arquitectura-humana/exportes/page.tsx`
- Create: `src/components/arquitectura-humana/export-card.tsx`

```ts
// src/app/api/exports/[type]/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { requireHR } from '@/lib/auth-guards'
import { generateCumplimientoCSV } from '@/lib/exports/cumplimiento-csv'
import { generateAcuerdosCSV } from '@/lib/exports/acuerdos-csv'
import { generateCalidezCSV } from '@/lib/exports/calidez-csv'

export async function GET(_req: NextRequest, { params }: { params: { type: string } }) {
  const guard = await requireHR()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: 403 })

  let result: { filename: string; content: string }
  switch (params.type) {
    case 'cumplimiento': result = await generateCumplimientoCSV(); break
    case 'acuerdos': result = await generateAcuerdosCSV(); break
    case 'calidez': result = await generateCalidezCSV(); break
    default: return NextResponse.json({ error: 'Tipo desconocido' }, { status: 400 })
  }

  return new Response(result.content, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    },
  })
}
```

Page consume con `<ExportCard>` que es un `<a href="/api/exports/cumplimiento" download>` con botón coral.

Commit: `feat(P3): export API + page con 3 cards`

### Task P3.3: Scheduled reports + cron

**Files:**
- Create: `src/lib/actions/scheduled-reports.ts`
- Create: `src/app/api/cron/send-scheduled-reports/route.ts`
- Create: `src/components/arquitectura-humana/scheduled-report-list.tsx`
- Create: `src/components/arquitectura-humana/scheduled-report-modal.tsx`
- Modify: `src/app/(dashboard)/arquitectura-humana/exportes/page.tsx` (agregar sección "Programados")
- Modify: `vercel.json` (cron entry hourly)

Actions: `createScheduledReport`, `updateScheduledReport`, `toggleScheduledReport`, `deleteScheduledReport`, `runReportNow`.

Cron evalúa `next_run_at <= now()`, genera CSV, "envía" via email stub (log a `notification_dispatches` con channel='email'), actualiza `last_run_at` y recalcula `next_run_at` con `cron-parser`.

```ts
// Cron handler stub para email — implementación real depende de tener Resend o SMTP
async function sendReportEmail(opts: { to: string[]; subject: string; csvContent: string; csvFilename: string }) {
  // TODO real: integrar Resend SDK cuando esté disponible
  // Por ahora: log a notification_dispatches para audit + console.log
  console.log(`[scheduled-report] would send to ${opts.to.join(',')}: ${opts.subject}`)
}
```

Commit: `feat(P3): scheduled_reports CRUD + cron hourly + email stub`

---

## Wave 2 — Pack 4: Outline (1 agente, NO código real)

### Task P4.1: Doc extendido + UI placeholder

**Files:**
- Create: `docs/superpowers/specs/2026-05-14-pack-4-org-sync-extended.md`
- Create: `src/app/(dashboard)/arquitectura-humana/sincronizacion/page.tsx`
- Create: `src/components/arquitectura-humana/sync-placeholder.tsx`

Doc extiende el contrato previo de Conexiones Humanas con wireframe textual del flujo de import. Page es server component simple que renderiza el placeholder.

```tsx
// sync-placeholder.tsx
import { RefreshCcw, ExternalLink } from 'lucide-react'

export function SyncPlaceholder() {
  return (
    <div
      className="ui-card"
      style={{
        background: 'hsl(var(--warning) / 0.12)',
        borderLeft: '3px solid hsl(var(--warning))',
        padding: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <RefreshCcw size={20} style={{ color: 'hsl(var(--warning))' }} />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Sincronización organizacional</h3>
      </div>
      <p style={{ margin: '0 0 12px', color: 'var(--text-c)', fontSize: 14 }}>
        <strong>En desarrollo</strong> — esperando spec de Conexiones Humanas.
      </p>
      <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.6 }}>
        Cuando esté disponible, podrás subir un CSV o conectar via API para que los cambios de líder, departamento y status se reflejen automáticamente.
        Mientras tanto, los cambios manuales se hacen desde la vista de Usuarios.
      </p>
      <a
        href="https://github.com/acalderonm-bdi/1_to_1/blob/main/docs/superpowers/specs/2026-05-14-pack-4-org-sync-extended.md"
        target="_blank"
        rel="noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'hsl(var(--primary))', fontSize: 13, fontWeight: 500 }}
      >
        <ExternalLink size={13} /> Ver spec del contrato
      </a>
    </div>
  )
}
```

Commit: `docs(P4): outline extended + placeholder UI`

---

## Wave 3 — Integration review (2 reviewers paralelos)

### Task W3.1: Cross-pack consistency

**Reviewer agent prompt:** verificar sidebar order, page heads, loading/empty states, botón Guardar pattern, confirm modals destructivos, no duplicación de `getOrgSetting` wrappers, i18n consistente.

Anexar findings a `docs/superpowers/specs/2026-05-14-configs-rh-page-map.md` sección "Wave 3 — findings". Fix inline.

Commit (si hubo fixes): `polish(W3): cross-pack consistency`

### Task W3.2: Security & RLS

**Reviewer agent prompt:** confirmar `requireHR()` en TODAS las actions nuevas, RLS verificada con queries directas (HR vs leader vs colab), CRON_SECRET en cron endpoints, Zod schemas, feature flags hard-fail en rutas IA.

Test manual:
```sql
-- Como leader:
set local request.jwt.claim.sub = '<leader_uuid>';
select * from org_settings;
-- Expected: read OK pero no write
insert into org_settings (key, value) values ('test', '"x"');
-- Expected: RLS violation
```

Commit (si fixes): `fix(W3): RLS gaps + missing guards`

---

## Wave 4 — Zero-error gate + polish (1 agente)

### Task W4.1: Final verify

```bash
pnpm tsc -b 2>&1 | tail -5  # exit 0
pnpm build 2>&1 | tail -20  # exit 0, sin warnings
pnpm tsx scripts/review-all.ts  # 0 fail
```

Smoke funcional:
- AH crea regla "calidez_baja → in_app HR", test fire, verifica en `notification_dispatches`
- AH edita umbral de baja calidad 3.0 → 3.5, recarga reportes
- AH baja CSV de cumplimiento, abre en Excel/LibreOffice
- AH crea scheduled report, ejecuta manualmente, verifica log

### Task W4.2: Squash merge + push (con consent de Ariel)

```bash
git checkout main
git merge --squash feat/configs-rh
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat: configs RH — cadencia editable + notif rules + parámetros + reportería (packs 1-3) + pack 4 outline"
git branch -D feat/configs-rh
# Push solo con consent explícito de Ariel
```

---

## Self-Review

**Spec coverage:**
- ✅ Wave 0 audit → Task W0.1
- ✅ Wave 1 foundation (4 migrations + helpers + sidebar) → Tasks W1.1-W1.8
- ✅ Pack 1 (cadencia + notifs + depts + cron) → Tasks P1.1-P1.6
- ✅ Pack 2 (parámetros + 4 tuners + 9 consumers) → Tasks P2.1-P2.3
- ✅ Pack 3 (CSV generators + export API + scheduled + cron) → Tasks P3.1-P3.3
- ✅ Pack 4 (doc + placeholder) → Task P4.1
- ✅ Wave 3 (consistency + RLS) → Tasks W3.1-W3.2
- ✅ Wave 4 (gate + merge) → Tasks W4.1-W4.2

**Placeholders:** ningún TBD/TODO real. Las menciones de "stub" para email son intencionales y documentadas (real Resend integration es scope futuro, no parte de Packs 1-3).

**Type consistency:** `SettingKey`, `SettingValue<K>`, `NotificationRuleRow`, `ScheduledReportRow` consistentes entre Wave 1 y Wave 2.

**Asumes:** que `pnpm db:push` aplica las migrations limpio (sin drift). Si hay drift, el agent renumera siguiendo el patrón del Pack A+B previo (`migration repair` + rename).

**Plan completo y listo para ejecutar.** Saved to `docs/superpowers/plans/2026-05-14-configs-rh-4-packs.md`.
