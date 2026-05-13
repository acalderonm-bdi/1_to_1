# Mejoras 1to1 (Pack A + Pack B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar las 5 features de Pack A (F2 justificación + F4 histórico) y Pack B (F1 lineamientos + F5 enfoque + F6 calidez) del spec `docs/superpowers/specs/2026-05-13-mejoras-1to1-design.md`. Pack C queda outline-only — no se implementa hasta tener spec de Conexiones Humanas.

**Architecture:** 5 migrations SQL aditivas (no downtime), 3 server actions nuevas, 4 componentes UI nuevos, 1 ruta AI nueva, 1 helper de validación cliente, 2 views SQL agregadas. Cambios encimados sobre el modelo existente sin reescribir flujos. Privacy-first en F6 (warmth) vía RLS policies estrictas.

**Tech Stack:** Next.js 14 App Router, Supabase SSR + RLS, Tailwind v3, shadcn/ui, Anthropic SDK (existing), Zod (existing), `@supabase/ssr` server client.

---

## File Structure

### New files (10)

| Path | Responsibility |
|---|---|
| `supabase/migrations/00000000000007a_extend_non_realization_enum.sql` | Add `emergencia` + `vacaciones` to enum (must run before column adds) |
| `supabase/migrations/00000000000007b_session_justification_columns.sql` | F2 — note + marked_by + marked_at cols on `one_on_ones` |
| `supabase/migrations/00000000000008_open_agreements_view.sql` | F4 — view `open_agreements_by_collaborator` |
| `supabase/migrations/00000000000009_transfer_banner_dismissal.sql` | F4 — `transfer_banner_dismissed_at` col + auto-dismiss trigger on VoBo |
| `supabase/migrations/00000000000010_agreement_quality.sql` | F1 — `ai_quality_score` + `ai_quality_warnings` cols on `agreements` |
| `supabase/migrations/00000000000011_warmth_survey.sql` | F6 — `meeting_warmth_responses` table, RLS, views, opt-in col on `users` |
| `src/lib/agreement-quality.ts` | F1 — client-side SMART rules checker |
| `src/lib/actions/warmth.ts` | F6 — `submitWarmthResponse` server action |
| `src/app/api/ai/agreement-quality/route.ts` | F1 — AI-based quality scoring + refinement |
| `src/content/guia-1to1.md` | F5 — static content for focus guidance modal |
| `src/components/one-on-one/non-realization-modal.tsx` | F2 — modal to mark meeting as not realized |
| `src/components/one-on-one/focus-guidance.tsx` | F5 — inline guidance + modal trigger in meeting form |
| `src/components/one-on-one/warmth-survey.tsx` | F6 — 5-Likert + comment card in minute editor |
| `src/components/shared/transfer-banner.tsx` | F4 — banner for new leader with inherited agreements |
| `src/components/arquitectura-humana/warmth-heatmap.tsx` | F6 — AH heatmap widget by leader/department |

### Modified files (~8)

| Path | What changes |
|---|---|
| `src/lib/actions/one-on-ones.ts` | Add `markNonRealization`, `dismissTransferBanner` server actions |
| `src/lib/actions/agreements.ts` | Update create/update to persist `ai_quality_*` fields |
| `src/lib/actions/vobos.ts` | Verify warmth response exists before allowing collaborator VoBo |
| `src/components/one-on-one/meeting-card.tsx` | Add "Marcar como no realizada" button when past + agendada |
| `src/components/one-on-one/meeting-form.tsx` | Embed `<FocusGuidance />` above agenda field |
| `src/components/one-on-one/minute-editor.tsx` | Embed `<WarmthSurvey />` before collaborator VoBo button; show quality warnings on agreements |
| `src/components/one-on-one/agreement-list.tsx` | Show "Transferido" badge when `is_transferred = true`; show quality badge |
| `src/app/(dashboard)/lider/colaborador/[id]/page.tsx` | Show transferred agreements section + banner mount |
| `src/app/(dashboard)/lider/configuracion/page.tsx` | Add "Tu calidez histórica" widget (line chart) |
| `src/app/(dashboard)/arquitectura-humana/mapa-calor/page.tsx` | Add warmth heatmap widget |
| `src/app/(dashboard)/arquitectura-humana/reportes/page.tsx` | Add "Acuerdos de baja calidad" card |
| `src/types/domain.ts` | Re-export new types after `pnpm db:types` regen |

---

## Phase A — Schema migrations (1 agente, secuencial, blocking)

Cada migration es additive (no downtime). Tras cada commit corre `pnpm tsc -b` para validar que tipos generados (cuando aplique) no rompan.

### Task A1: Page-map audit

**Files:**
- Create: `docs/superpowers/specs/2026-05-13-mejoras-1to1-page-map.md`

- [ ] **Step 1: Inventariar archivos a tocar por feature**

Run estos greps y captura los resultados:

```bash
grep -rln "non_realization\|no_realizada" src/ 2>&1
grep -rln "leadership_relations\|ended_at" src/ 2>&1
grep -rln "agreements\|Agreement" src/components src/app 2>&1 | head -20
grep -rln "meeting-form\|meeting-card\|minute-editor" src/ 2>&1
```

- [ ] **Step 2: Crear page-map**

```markdown
# Page Map — Mejoras 1to1 Pack A + B

## F2 — Justificación
- src/lib/actions/one-on-ones.ts (modify: add markNonRealization)
- src/components/one-on-one/meeting-card.tsx (modify: add CTA)
- src/components/one-on-one/non-realization-modal.tsx (NEW)
- src/app/(dashboard)/colaborador/1to1/[id]/page.tsx (modify: show motivo block)
- src/app/(dashboard)/lider/1to1/[id]/page.tsx (modify: show motivo block)

## F4 — Histórico
- src/lib/actions/one-on-ones.ts (modify: add dismissTransferBanner)
- src/components/shared/transfer-banner.tsx (NEW)
- src/components/one-on-one/agreement-list.tsx (modify: transferred badge)
- src/app/(dashboard)/lider/colaborador/[id]/page.tsx (modify: banner + open agreements section)
- src/app/(dashboard)/arquitectura-humana/usuarios/[id]/page.tsx (modify: same section)

## F1 — Lineamientos
- src/lib/agreement-quality.ts (NEW)
- src/lib/actions/agreements.ts (modify: persist quality on save)
- src/app/api/ai/agreement-quality/route.ts (NEW)
- src/components/one-on-one/minute-editor.tsx (modify: inline warnings)
- src/components/one-on-one/agreement-list.tsx (modify: quality badge)
- src/app/(dashboard)/arquitectura-humana/reportes/page.tsx (modify: low-quality card)

## F5 — Enfoque
- src/content/guia-1to1.md (NEW)
- src/components/one-on-one/focus-guidance.tsx (NEW)
- src/components/one-on-one/meeting-form.tsx (modify: embed component)

## F6 — Calidez
- src/lib/actions/warmth.ts (NEW)
- src/lib/actions/vobos.ts (modify: gate by warmth)
- src/components/one-on-one/warmth-survey.tsx (NEW)
- src/components/one-on-one/minute-editor.tsx (modify: embed survey)
- src/components/arquitectura-humana/warmth-heatmap.tsx (NEW)
- src/app/(dashboard)/lider/configuracion/page.tsx (modify: trend chart)
- src/app/(dashboard)/arquitectura-humana/mapa-calor/page.tsx (modify: heatmap widget)
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-05-13-mejoras-1to1-page-map.md
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "docs(mejoras): page-map de archivos por feature"
```

### Task A2: Migration F2 — Justificación

**Files:**
- Create: `supabase/migrations/00000000000007a_extend_non_realization_enum.sql`
- Create: `supabase/migrations/00000000000007b_session_justification_columns.sql`

- [ ] **Step 1: Migration 7a (enum extension)**

```sql
-- File: supabase/migrations/00000000000007a_extend_non_realization_enum.sql
-- Extiende non_realization_reason con emergencia y vacaciones.
-- ALTER TYPE ADD VALUE no puede correr en la misma transacción que ALTER TABLE,
-- por eso va en archivo separado.

alter type public.non_realization_reason add value if not exists 'emergencia';
alter type public.non_realization_reason add value if not exists 'vacaciones';
```

- [ ] **Step 2: Migration 7b (columns)**

```sql
-- File: supabase/migrations/00000000000007b_session_justification_columns.sql
-- F2 — Captura motivo de no realización con metadata de quién lo marcó.

alter table public.one_on_ones
  add column non_realization_note text,
  add column non_realization_marked_by uuid references public.users(id),
  add column non_realization_marked_at timestamptz,
  add constraint non_realization_note_length check (
    non_realization_note is null or length(non_realization_note) <= 500
  );

create index idx_oneonones_non_realization
  on public.one_on_ones(non_realization_marked_by)
  where non_realization_marked_by is not null;
```

- [ ] **Step 3: Apply migrations**

Si tenés Supabase CLI conectado:

```bash
pnpm db:push
```

Sin CLI, anotá en el page-map que las migrations deben correrse manualmente en producción.

- [ ] **Step 4: Regen types**

```bash
pnpm db:types
```

Si falla por falta de credenciales, anotá como pendiente para QA pre-deploy. Por ahora el agente puede declarar los nuevos campos manualmente en `src/types/domain.ts` si es necesario (mejor: confiar en la regen).

- [ ] **Step 5: Verify**

```bash
pnpm tsc -b 2>&1 | tail -3
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/00000000000007a_extend_non_realization_enum.sql supabase/migrations/00000000000007b_session_justification_columns.sql src/types/database.types.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F2): schema para justificación de sesiones (nota + marked_by + marked_at)"
```

### Task A3: Migration F4 — Histórico view + banner

**Files:**
- Create: `supabase/migrations/00000000000008_open_agreements_view.sql`
- Create: `supabase/migrations/00000000000009_transfer_banner_dismissal.sql`

- [ ] **Step 1: Migration 8 (view)**

```sql
-- File: supabase/migrations/00000000000008_open_agreements_view.sql
-- F4 — Acuerdos abiertos por colaborador, con flag de transferencia.

create or replace view public.open_agreements_by_collaborator as
select
  a.id,
  a.one_on_one_id,
  a.description,
  a.responsible_id,
  a.due_date,
  a.status,
  a.ai_generated,
  a.ai_confidence,
  a.ai_quality_score,
  a.ai_quality_warnings,
  a.created_at,
  a.updated_at,
  o.leader_id as original_leader_id,
  o.collaborator_id,
  current_lr.leader_id as current_leader_id,
  (o.leader_id <> current_lr.leader_id) as is_transferred,
  o.scheduled_at as session_scheduled_at
from public.agreements a
join public.one_on_ones o on o.id = a.one_on_one_id
left join public.leadership_relations current_lr
  on current_lr.collaborator_id = o.collaborator_id
  and current_lr.ended_at is null
where a.status in ('pendiente', 'parcial');

grant select on public.open_agreements_by_collaborator to authenticated;
```

**Nota:** las columnas `ai_quality_score` y `ai_quality_warnings` se agregan en Task A5; por orden temporal, la view se crea PRIMERO y se reemplaza después si Postgres lo requiere. Si Postgres rechaza la referencia (cols inexistentes en `agreements` aún), comentá esas dos líneas del SELECT en esta migration y descomentá en Task A5 con un `create or replace view` repetido.

- [ ] **Step 2: Migration 9 (dismissal column + trigger)**

```sql
-- File: supabase/migrations/00000000000009_transfer_banner_dismissal.sql
-- F4 — Dismissal manual o automático del banner de transferencia.

alter table public.leadership_relations
  add column transfer_banner_dismissed_at timestamptz;

-- Trigger: al crear un VoBo, si existe relación activa entre líder/colaborador
-- de la sesión y aún no fue dismisseada, marcar dismissed_at = now()
create or replace function public.auto_dismiss_transfer_banner()
returns trigger
language plpgsql
security definer
as $$
declare
  v_leader_id uuid;
  v_collaborator_id uuid;
begin
  select leader_id, collaborator_id into v_leader_id, v_collaborator_id
  from public.one_on_ones where id = new.one_on_one_id;

  if v_leader_id is null then
    return new;
  end if;

  update public.leadership_relations
  set transfer_banner_dismissed_at = now()
  where leader_id = v_leader_id
    and collaborator_id = v_collaborator_id
    and ended_at is null
    and transfer_banner_dismissed_at is null;

  return new;
end;
$$;

drop trigger if exists trg_auto_dismiss_transfer_banner on public.vobos;
create trigger trg_auto_dismiss_transfer_banner
  after insert on public.vobos
  for each row execute procedure public.auto_dismiss_transfer_banner();
```

- [ ] **Step 3: Apply + regen types**

```bash
pnpm db:push
pnpm db:types
pnpm tsc -b 2>&1 | tail -3
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000008_open_agreements_view.sql supabase/migrations/00000000000009_transfer_banner_dismissal.sql src/types/database.types.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F4): view open_agreements_by_collaborator + auto-dismiss trigger"
```

### Task A4: Migration F1 — Agreement quality

**Files:**
- Create: `supabase/migrations/00000000000010_agreement_quality.sql`

- [ ] **Step 1: Migration**

```sql
-- File: supabase/migrations/00000000000010_agreement_quality.sql
-- F1 — Persistencia de quality score + warnings sobre acuerdos.

alter table public.agreements
  add column ai_quality_score numeric(2,1) check (ai_quality_score is null or ai_quality_score between 0 and 5),
  add column ai_quality_warnings text[] not null default '{}'::text[];

create index idx_agreements_quality_low
  on public.agreements(ai_quality_score)
  where ai_quality_score is not null and ai_quality_score < 3;
```

- [ ] **Step 2: Reemplazar view 8 si quedó sin las columnas**

Si en Task A3 comentaste `a.ai_quality_score, a.ai_quality_warnings`, corré ahora:

```sql
create or replace view public.open_agreements_by_collaborator as
select
  a.id,
  a.one_on_one_id,
  a.description,
  a.responsible_id,
  a.due_date,
  a.status,
  a.ai_generated,
  a.ai_confidence,
  a.ai_quality_score,
  a.ai_quality_warnings,
  a.created_at,
  a.updated_at,
  o.leader_id as original_leader_id,
  o.collaborator_id,
  current_lr.leader_id as current_leader_id,
  (o.leader_id <> current_lr.leader_id) as is_transferred,
  o.scheduled_at as session_scheduled_at
from public.agreements a
join public.one_on_ones o on o.id = a.one_on_one_id
left join public.leadership_relations current_lr
  on current_lr.collaborator_id = o.collaborator_id
  and current_lr.ended_at is null
where a.status in ('pendiente', 'parcial');
```

Si la migration 8 ya tenía esas cols comentadas, agregá este `create or replace view` al final de la migration 10.

- [ ] **Step 3: Apply + regen types**

```bash
pnpm db:push
pnpm db:types
pnpm tsc -b 2>&1 | tail -3
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000010_agreement_quality.sql src/types/database.types.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F1): schema para quality score y warnings en acuerdos"
```

### Task A5: Migration F6 — Warmth survey + opt-in

**Files:**
- Create: `supabase/migrations/00000000000011_warmth_survey.sql`

- [ ] **Step 1: Migration**

```sql
-- File: supabase/migrations/00000000000011_warmth_survey.sql
-- F6 — Encuesta de calidez post-sesión + opt-in para comentarios + agregados.

-- Opt-in del colaborador para que AH pueda leer sus comentarios libres
alter table public.users
  add column allow_share_warmth_comments boolean not null default false;

-- Tabla principal
create table public.meeting_warmth_responses (
  id uuid primary key default gen_random_uuid(),
  one_on_one_id uuid not null references public.one_on_ones(id) on delete cascade,
  collaborator_id uuid not null references public.users(id),
  felt_heard smallint not null check (felt_heard between 1 and 5),
  comfortable_sharing smallint not null check (comfortable_sharing between 1 and 5),
  leader_engaged smallint not null check (leader_engaged between 1 and 5),
  conversation_quality smallint not null check (conversation_quality between 1 and 5),
  clarity_after_session smallint not null check (clarity_after_session between 1 and 5),
  free_comment text check (free_comment is null or length(free_comment) <= 1000),
  created_at timestamptz not null default now()
);

create unique index idx_warmth_one_per_meeting
  on public.meeting_warmth_responses(one_on_one_id);

create index idx_warmth_collaborator on public.meeting_warmth_responses(collaborator_id);

-- RLS
alter table public.meeting_warmth_responses enable row level security;

create policy "warmth_collaborator_insert"
  on public.meeting_warmth_responses
  for insert
  to authenticated
  with check (collaborator_id = auth.uid());

create policy "warmth_collaborator_select_own"
  on public.meeting_warmth_responses
  for select
  to authenticated
  using (collaborator_id = auth.uid());

create policy "warmth_hr_select_all"
  on public.meeting_warmth_responses
  for select
  to authenticated
  using ((select role from public.users where id = auth.uid()) = 'hr');

-- Líder NO ve respuestas individuales; solo agregados vía views.

-- Vistas agregadas
create or replace view public.warmth_metrics_by_leader as
select
  o.leader_id,
  count(*) as response_count,
  avg(w.felt_heard) as avg_felt_heard,
  avg(w.comfortable_sharing) as avg_comfortable_sharing,
  avg(w.leader_engaged) as avg_leader_engaged,
  avg(w.conversation_quality) as avg_conversation_quality,
  avg(w.clarity_after_session) as avg_clarity_after_session,
  avg((w.felt_heard + w.comfortable_sharing + w.leader_engaged + w.conversation_quality + w.clarity_after_session)::numeric / 5) as avg_overall
from public.meeting_warmth_responses w
join public.one_on_ones o on o.id = w.one_on_one_id
group by o.leader_id;

create or replace view public.warmth_metrics_by_department as
select
  u.department_id,
  d.name as department_name,
  count(*) as response_count,
  avg((w.felt_heard + w.comfortable_sharing + w.leader_engaged + w.conversation_quality + w.clarity_after_session)::numeric / 5) as avg_overall
from public.meeting_warmth_responses w
join public.one_on_ones o on o.id = w.one_on_one_id
join public.users u on u.id = o.collaborator_id
left join public.departments d on d.id = u.department_id
group by u.department_id, d.name;

-- Vista de tendencia mensual por líder (para chart en lider/configuracion)
create or replace view public.warmth_trend_by_leader_month as
select
  o.leader_id,
  date_trunc('month', w.created_at) as month,
  count(*) as response_count,
  avg((w.felt_heard + w.comfortable_sharing + w.leader_engaged + w.conversation_quality + w.clarity_after_session)::numeric / 5) as avg_overall
from public.meeting_warmth_responses w
join public.one_on_ones o on o.id = w.one_on_one_id
group by o.leader_id, date_trunc('month', w.created_at)
order by month desc;

grant select on public.warmth_metrics_by_leader to authenticated;
grant select on public.warmth_metrics_by_department to authenticated;
grant select on public.warmth_trend_by_leader_month to authenticated;
```

- [ ] **Step 2: Apply + regen types**

```bash
pnpm db:push
pnpm db:types
pnpm tsc -b 2>&1 | tail -3
```
Expected: exit 0.

- [ ] **Step 3: Verify RLS manualmente con SQL**

Si tenés acceso al SQL editor, corré estas queries de verificación:

```sql
-- Como un líder (sustituí <leader_uuid>):
set local role authenticated;
set local request.jwt.claim.sub = '<leader_uuid>';
select * from public.meeting_warmth_responses limit 5;
-- Expected: 0 rows. El líder NO ve respuestas individuales.

select * from public.warmth_metrics_by_leader where leader_id = '<leader_uuid>';
-- Expected: 1 row con sus agregados.

-- Como HR:
set local request.jwt.claim.sub = '<hr_uuid>';
select count(*) from public.meeting_warmth_responses;
-- Expected: total de respuestas.

reset role;
```

Documentá los resultados en el page-map.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000011_warmth_survey.sql src/types/database.types.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F6): schema warmth_responses con RLS estricta + agregados por líder/depto"
```

### Task A6: Type verification

**Files:**
- Verify: `src/types/database.types.ts` (regenerated)
- Verify: `src/types/domain.ts` (re-exports stay valid)

- [ ] **Step 1: Confirmar nuevos tipos**

```bash
grep -E "meeting_warmth_responses|open_agreements_by_collaborator|warmth_metrics|ai_quality" src/types/database.types.ts 2>&1 | head -20
```
Expected: matches mostrando los nuevos tipos.

- [ ] **Step 2: Verificar build**

```bash
pnpm tsc -b 2>&1 | tail -3
pnpm build 2>&1 | tail -5
```
Expected: ambos exit 0.

- [ ] **Step 3: (Sin commit si no hay cambios)**

Solo si modificaste `src/types/domain.ts` para exportar tipos derivados nuevos:

```bash
git add src/types/domain.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "types: re-export para mejoras 1to1"
```

---

## Phase B-A — F2 Justificación de sesiones (1 agente, paralelizable con B-B/B-C/B-D)

### Task BA1: Server action `markNonRealization`

**Files:**
- Modify: `src/lib/actions/one-on-ones.ts` (append nueva action)

- [ ] **Step 1: Agregar action al final del archivo**

```ts
const markNonRealizationSchema = z.object({
  oneOnOneId: z.string().uuid(),
  reason: z.enum([
    'reagendada',
    'cancelada_cargas',
    'ausencia',
    'emergencia',
    'vacaciones',
    'sin_justificacion',
  ]),
  note: z.string().max(500).optional(),
})

export async function markNonRealization(
  input: z.infer<typeof markNonRealizationSchema>
): Promise<ActionResult<{ status: 'no_realizada' | 'en_disputa' }>> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = markNonRealizationSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { data: meeting, error: fetchErr } = await supabase
    .from('one_on_ones')
    .select('id, leader_id, collaborator_id, status, non_realization_reason')
    .eq('id', parsed.data.oneOnOneId)
    .single()

  if (fetchErr || !meeting) return { success: false, error: 'Reunión no encontrada' }

  const isParticipant = user.id === meeting.leader_id || user.id === meeting.collaborator_id
  if (!isParticipant) {
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single<{ role: string }>()
    if (profile?.role !== 'hr') return { success: false, error: 'Sin permisos' }
  }

  const previousReason = meeting.non_realization_reason
  const newReason = parsed.data.reason
  const goToDispute = previousReason && previousReason !== newReason

  const updatePayload = {
    status: goToDispute ? 'en_disputa' : 'no_realizada',
    non_realization_reason: newReason,
    non_realization_note: parsed.data.note ?? null,
    non_realization_marked_by: user.id,
    non_realization_marked_at: new Date().toISOString(),
  } as const

  const { error: updateErr } = await supabase
    .from('one_on_ones')
    .update(updatePayload)
    .eq('id', parsed.data.oneOnOneId)

  if (updateErr) return { success: false, error: updateErr.message }

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    entity_type: 'one_on_one',
    entity_id: parsed.data.oneOnOneId,
    action: goToDispute ? 'meeting_marked_disputed' : 'meeting_marked_not_realized',
    metadata: { reason: newReason, has_note: Boolean(parsed.data.note) },
  })

  revalidatePath(`/colaborador/1to1/${parsed.data.oneOnOneId}`)
  revalidatePath(`/lider/1to1/${parsed.data.oneOnOneId}`)

  return { success: true, data: { status: updatePayload.status } }
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm tsc -b 2>&1 | tail -3
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/one-on-ones.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F2): markNonRealization server action"
```

### Task BA2: Component `non-realization-modal.tsx`

**Files:**
- Create: `src/components/one-on-one/non-realization-modal.tsx`

- [ ] **Step 1: Crear componente**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { markNonRealization } from '@/lib/actions/one-on-ones'

const REASON_OPTIONS = [
  { value: 'reagendada', label: 'Reagendada' },
  { value: 'cancelada_cargas', label: 'Cancelada por carga de trabajo' },
  { value: 'ausencia', label: 'Ausencia' },
  { value: 'emergencia', label: 'Emergencia' },
  { value: 'vacaciones', label: 'Vacaciones' },
  { value: 'sin_justificacion', label: 'Sin justificación' },
] as const

type Reason = typeof REASON_OPTIONS[number]['value']

interface NonRealizationModalProps {
  oneOnOneId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NonRealizationModal({ oneOnOneId, open, onOpenChange }: NonRealizationModalProps) {
  const [reason, setReason] = useState<Reason | ''>('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleSubmit() {
    if (!reason) return
    setSubmitting(true)
    const result = await markNonRealization({
      oneOnOneId,
      reason,
      note: note.trim() || undefined,
    })
    setSubmitting(false)

    if (!result.success) {
      toast({ title: 'No se pudo marcar', description: result.error, variant: 'destructive' })
      return
    }

    if (result.data?.status === 'en_disputa') {
      toast({
        title: 'Se generó una disputa',
        description: 'El motivo difiere del marcado por la otra persona. Arquitectura Humana revisará.',
      })
    } else {
      toast({ title: '1:1 marcada como no realizada', description: 'Quedó registrada con motivo.' })
    }

    onOpenChange(false)
    setReason('')
    setNote('')
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar 1:1 como no realizada</DialogTitle>
          <DialogDescription>
            Registrá el motivo. Si la otra persona marca con motivo distinto, la sesión queda en disputa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as Reason)}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Seleccioná un motivo" />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Nota (opcional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Contexto adicional si querés..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">{note.length}/500</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!reason || submitting}>
            {submitting ? 'Guardando…' : 'Guardar motivo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm tsc -b 2>&1 | tail -3
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/one-on-one/non-realization-modal.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F2): non-realization-modal"
```

### Task BA3: Wire en meeting-card + detail pages

**Files:**
- Modify: `src/components/one-on-one/meeting-card.tsx`
- Modify: `src/app/(dashboard)/colaborador/1to1/[id]/page.tsx`
- Modify: `src/app/(dashboard)/lider/1to1/[id]/page.tsx`

- [ ] **Step 1: Read meeting-card actual para conocer estructura**

```bash
cat src/components/one-on-one/meeting-card.tsx | head -40
```

- [ ] **Step 2: Agregar CTA condicional**

En la sección de acciones del card (busca el bloque que renderiza botones según `status`), agregar:

```tsx
import { useState } from 'react'
import { NonRealizationModal } from './non-realization-modal'

// dentro del componente, después de cualquier useState existente:
const [showNonRealization, setShowNonRealization] = useState(false)

// dentro del JSX, cuando status==='agendada' y scheduledAt está en el pasado:
{meeting.status === 'agendada' && new Date(meeting.scheduled_at) < new Date() && (
  <>
    <Button variant="outline" size="sm" onClick={() => setShowNonRealization(true)}>
      Marcar como no realizada
    </Button>
    <NonRealizationModal
      oneOnOneId={meeting.id}
      open={showNonRealization}
      onOpenChange={setShowNonRealization}
    />
  </>
)}
```

Si meeting-card es un Server Component, el botón debe vivir en un Client Component hijo. Crear `meeting-card-actions.tsx` si fuera necesario y mover el wire-up ahí.

- [ ] **Step 3: Bloque informativo en detail pages**

En ambas pages de detalle, agregar al markdown principal del meeting:

```tsx
{meeting.status === 'no_realizada' && meeting.non_realization_reason && (
  <Alert className="mb-4">
    <AlertTitle className="text-foreground">
      Sesión no realizada — {labelForReason(meeting.non_realization_reason)}
    </AlertTitle>
    {meeting.non_realization_note && (
      <AlertDescription className="text-muted-foreground">
        {meeting.non_realization_note}
      </AlertDescription>
    )}
    <AlertDescription className="text-xs text-muted-foreground mt-2">
      Registrado por {meeting.non_realization_marked_by_name ?? 'usuario'} el{' '}
      {new Date(meeting.non_realization_marked_at!).toLocaleDateString('es-MX')}
    </AlertDescription>
  </Alert>
)}
```

Necesitarás:
- Una función `labelForReason` que mapee enum→texto (re-usar `REASON_OPTIONS` del modal o exportarlo de `non-realization-modal.tsx`).
- Hacer JOIN con `users` para obtener `non_realization_marked_by_name` en la query del page.

- [ ] **Step 4: Build verify**

```bash
pnpm tsc -b 2>&1 | tail -3
pnpm build 2>&1 | tail -8
```
Expected: ambos exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/one-on-one/meeting-card.tsx src/components/one-on-one/non-realization-modal.tsx src/app/\(dashboard\)/colaborador/1to1/\[id\]/page.tsx src/app/\(dashboard\)/lider/1to1/\[id\]/page.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F2): CTA + bloque informativo de no-realización en vistas detalle"
```

---

## Phase B-B — F4 Histórico de acuerdos (1 agente, paralelizable)

### Task BB1: Server action `dismissTransferBanner`

**Files:**
- Modify: `src/lib/actions/one-on-ones.ts` (append)

- [ ] **Step 1: Action**

```ts
const dismissTransferBannerSchema = z.object({
  leadershipRelationId: z.string().uuid(),
})

export async function dismissTransferBanner(
  input: z.infer<typeof dismissTransferBannerSchema>
): Promise<ActionResult<undefined>> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = dismissTransferBannerSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  // Solo el líder de la relación puede dismissear
  const { error } = await supabase
    .from('leadership_relations')
    .update({ transfer_banner_dismissed_at: new Date().toISOString() })
    .eq('id', parsed.data.leadershipRelationId)
    .eq('leader_id', user.id)
    .is('transfer_banner_dismissed_at', null)

  if (error) return { success: false, error: error.message }

  revalidatePath('/lider')
  return { success: true }
}
```

- [ ] **Step 2: Build verify + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/lib/actions/one-on-ones.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F4): dismissTransferBanner server action"
```

### Task BB2: Component `transfer-banner.tsx`

**Files:**
- Create: `src/components/shared/transfer-banner.tsx`

- [ ] **Step 1: Componente**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { dismissTransferBanner } from '@/lib/actions/one-on-ones'

interface TransferBannerProps {
  leadershipRelationId: string
  collaboratorName: string
  previousLeaderName: string
  openAgreementsCount: number
}

export function TransferBanner({
  leadershipRelationId,
  collaboratorName,
  previousLeaderName,
  openAgreementsCount,
}: TransferBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (dismissed) return null

  function handleDismiss() {
    startTransition(async () => {
      const result = await dismissTransferBanner({ leadershipRelationId })
      if (result.success) setDismissed(true)
    })
  }

  return (
    <Alert className="border-warning bg-warning/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <AlertTitle className="text-foreground">
            Heredaste {openAgreementsCount} acuerdo{openAgreementsCount === 1 ? '' : 's'} abierto{openAgreementsCount === 1 ? '' : 's'} de {previousLeaderName}
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Estos compromisos quedaron pendientes con {collaboratorName} cuando su líder anterior se desvinculó.
            Repasalos en su próxima 1:1.
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          disabled={isPending}
          aria-label="Cerrar"
        >
          <X size={16} />
        </Button>
      </div>
    </Alert>
  )
}
```

- [ ] **Step 2: Build verify + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/components/shared/transfer-banner.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F4): transfer-banner component"
```

### Task BB3: Agreement-list badge + lider/colaborador wire-up

**Files:**
- Modify: `src/components/one-on-one/agreement-list.tsx`
- Modify: `src/app/(dashboard)/lider/colaborador/[id]/page.tsx`
- Modify: `src/app/(dashboard)/arquitectura-humana/usuarios/[id]/page.tsx`

- [ ] **Step 1: Update agreement-list signature para aceptar `is_transferred`**

```tsx
// En agreement-list.tsx, ampliar el type del item:
interface AgreementWithMeta {
  id: string
  description: string
  due_date: string | null
  status: 'pendiente' | 'cumplido' | 'parcial' | 'no_cumplido'
  is_transferred?: boolean
  ai_quality_score?: number | null  // para Phase B-C, ya queda preparado
}

// En el render de cada item, agregar el badge:
{agreement.is_transferred && (
  <Badge variant="warning" className="text-xs">
    Transferido del líder anterior
  </Badge>
)}
```

Si `agreement-list.tsx` recibe props con un type distinto, extendé el tipo y propagá los datos desde el page.

- [ ] **Step 2: Update lider/colaborador/[id]/page.tsx**

```tsx
// Fetch de acuerdos abiertos usando la view nueva:
const { data: openAgreements } = await supabase
  .from('open_agreements_by_collaborator')
  .select('*')
  .eq('collaborator_id', params.id)
  .order('due_date', { ascending: true, nullsFirst: false })

// Fetch de la relación activa para calcular si hay transfer banner:
const { data: relation } = await supabase
  .from('leadership_relations')
  .select('id, transfer_banner_dismissed_at, leader_id')
  .eq('collaborator_id', params.id)
  .is('ended_at', null)
  .maybeSingle()

const transferredCount = openAgreements?.filter((a) => a.is_transferred).length ?? 0
const shouldShowBanner =
  relation &&
  relation.leader_id === currentUser.id &&
  !relation.transfer_banner_dismissed_at &&
  transferredCount > 0

// Si shouldShowBanner, fetch previousLeader name:
let previousLeaderName: string | null = null
if (shouldShowBanner) {
  const firstTransferred = openAgreements!.find((a) => a.is_transferred)
  if (firstTransferred?.original_leader_id) {
    const { data: prevLeader } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', firstTransferred.original_leader_id)
      .single<{ full_name: string }>()
    previousLeaderName = prevLeader?.full_name ?? 'líder anterior'
  }
}

// En el render:
{shouldShowBanner && (
  <TransferBanner
    leadershipRelationId={relation.id}
    collaboratorName={collaborator.full_name}
    previousLeaderName={previousLeaderName ?? 'líder anterior'}
    openAgreementsCount={transferredCount}
  />
)}

<AgreementList agreements={openAgreements ?? []} />
```

- [ ] **Step 3: Update arquitectura-humana/usuarios/[id]/page.tsx**

Misma sección de acuerdos abiertos (sin banner — el banner es para líder). Solo render de `<AgreementList>` con `is_transferred` propagado.

- [ ] **Step 4: Build verify + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
pnpm build 2>&1 | tail -8
git add src/components/one-on-one/agreement-list.tsx src/app/\(dashboard\)/lider/colaborador/\[id\]/page.tsx src/app/\(dashboard\)/arquitectura-humana/usuarios/\[id\]/page.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F4): badge Transferido + banner en vista colaborador"
```

---

## Phase B-C — F1 Lineamientos de acuerdos (1 agente, paralelizable)

### Task BC1: Helper `agreement-quality.ts`

**Files:**
- Create: `src/lib/agreement-quality.ts`

- [ ] **Step 1: Helper**

```ts
export interface AgreementDraft {
  description: string
  responsibleId: string | null
  dueDate: string | null
  collaboratorOpenAgreementsCount: number
}

export type QualityWarningCode =
  | 'too_short'
  | 'no_due_date'
  | 'past_due_date'
  | 'no_responsible'
  | 'overloaded_collaborator'
  | 'ambiguous_wording'
  | 'no_measurable_outcome'
  | 'unrealistic_deadline'

export interface QualityWarning {
  code: QualityWarningCode
  message: string
  suggestion?: string
}

export interface QualityCheck {
  passed: boolean
  warnings: QualityWarning[]
  score: number  // 0.0 - 5.0
}

const MEASURABLE_VERBS = /\b(entreg|present|complet|enviar|firm|aprobar|implement|escrib|public|capacitar|formaliz|notificar|coordinar|finaliz|cumplir|resolver|estabilizar)\w*\b/i

export function checkAgreementQuality(draft: AgreementDraft): QualityCheck {
  const warnings: QualityWarning[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (draft.description.trim().length < 12) {
    warnings.push({
      code: 'too_short',
      message: 'La descripción es muy corta para que sea accionable.',
    })
  }

  if (!draft.responsibleId) {
    warnings.push({
      code: 'no_responsible',
      message: 'Hay que asignar a alguien responsable.',
    })
  }

  if (!draft.dueDate) {
    warnings.push({
      code: 'no_due_date',
      message: 'Sin fecha límite no se puede dar seguimiento.',
    })
  } else {
    const due = new Date(draft.dueDate)
    if (due < today) {
      warnings.push({
        code: 'past_due_date',
        message: 'La fecha límite ya pasó.',
      })
    } else {
      const oneDay = 24 * 60 * 60 * 1000
      const diff = due.getTime() - today.getTime()
      if (diff < oneDay) {
        warnings.push({
          code: 'unrealistic_deadline',
          message: 'Menos de 24h para cumplir — verificá que sea realista.',
        })
      }
    }
  }

  if (draft.collaboratorOpenAgreementsCount >= 7) {
    warnings.push({
      code: 'overloaded_collaborator',
      message: `Este colaborador ya tiene ${draft.collaboratorOpenAgreementsCount} acuerdos abiertos. Considerá priorizar antes de agregar más.`,
    })
  }

  if (!MEASURABLE_VERBS.test(draft.description)) {
    warnings.push({
      code: 'no_measurable_outcome',
      message: 'No queda claro qué entregable se verificará. Usá un verbo accionable (entregar, presentar, completar…).',
    })
  }

  const passed = warnings.length === 0
  const score = Math.max(0, 5 - warnings.length * 0.7)

  return { passed, warnings, score: Number(score.toFixed(1)) }
}
```

- [ ] **Step 2: Build verify + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/lib/agreement-quality.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F1): client-side SMART rules checker"
```

### Task BC2: AI route `/api/ai/agreement-quality`

**Files:**
- Create: `src/app/api/ai/agreement-quality/route.ts`

- [ ] **Step 1: Route**

```ts
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const requestSchema = z.object({
  description: z.string().min(1).max(1000),
  responsibleName: z.string(),
  dueDate: z.string().nullable(),
})

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const { description, responsibleName, dueDate } = parsed.data

  const prompt = `Sos un asesor que evalúa la calidad de acuerdos en reuniones 1:1 según criterios SMART.

Acuerdo:
- Descripción: "${description}"
- Responsable: ${responsibleName}
- Fecha límite: ${dueDate ?? 'sin fecha'}

Evaluá según estos criterios:
1. ¿Es específico? (descripción clara, no ambigua)
2. ¿Es medible? (hay un entregable verificable)
3. ¿Es realista en el plazo dado?
4. ¿Está bien escrito como compromiso accionable?

Respondé en JSON estricto con este shape:
{
  "quality_score": number (0-5),
  "warnings": [{"code": "ambiguous_wording", "message": "string", "suggestion": "string" | null}],
  "refined_description": "string" | null
}

Códigos válidos para warnings: "ambiguous_wording", "unrealistic_deadline".
Solo agregá refined_description si tenés una mejora concreta. Si el acuerdo está bien, devolvé score 5, warnings vacío, refined_description null.`

  try {
    const completion = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = completion.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'IA no devolvió JSON' }, { status: 500 })

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error IA' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Build verify + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/app/api/ai/agreement-quality/route.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F1): ruta IA agreement-quality con Anthropic"
```

### Task BC3: Persistir quality al guardar acuerdos

**Files:**
- Modify: `src/lib/actions/agreements.ts`

- [ ] **Step 1: Localizar action de save/create**

```bash
grep -n "export async function" src/lib/actions/agreements.ts 2>&1
```

- [ ] **Step 2: Inyectar checkAgreementQuality en server-side**

En las actions que crean o updatean acuerdos, antes del `supabase.from('agreements').insert`/`update`, calcular score y warnings:

```ts
import { checkAgreementQuality } from '@/lib/agreement-quality'

// Antes del insert/update, obtener cantidad de acuerdos abiertos del colaborador:
const { count } = await supabase
  .from('agreements')
  .select('id', { count: 'exact', head: true })
  .eq('responsible_id', input.responsibleId)
  .in('status', ['pendiente', 'parcial'])

const quality = checkAgreementQuality({
  description: input.description,
  responsibleId: input.responsibleId,
  dueDate: input.dueDate,
  collaboratorOpenAgreementsCount: count ?? 0,
})

// Incluir en el payload del insert/update:
const payload = {
  ...existingPayload,
  ai_quality_score: quality.score,
  ai_quality_warnings: quality.warnings.map((w) => w.code),
}
```

- [ ] **Step 3: Build verify + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/lib/actions/agreements.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F1): persistir ai_quality_score al guardar acuerdo"
```

### Task BC4: UI warnings inline en minute-editor

**Files:**
- Modify: `src/components/one-on-one/minute-editor.tsx`

- [ ] **Step 1: Read minute-editor para entender estructura de creación de acuerdos**

```bash
cat src/components/one-on-one/minute-editor.tsx | head -80
```

- [ ] **Step 2: Agregar warnings cliente en el form de acuerdo**

En la sección donde se edita un acuerdo (descripción + responsible + due_date), después de los inputs, agregar:

```tsx
import { checkAgreementQuality, type QualityWarning } from '@/lib/agreement-quality'

// Dentro del form de acuerdo:
const draftQuality = checkAgreementQuality({
  description: draft.description,
  responsibleId: draft.responsibleId,
  dueDate: draft.dueDate,
  collaboratorOpenAgreementsCount: collaboratorOpenCount,
})

{draftQuality.warnings.length > 0 && (
  <div className="space-y-1 mt-2">
    {draftQuality.warnings.map((w) => (
      <div key={w.code} className="flex items-start gap-2 text-xs text-warning">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        <span>{w.message}</span>
      </div>
    ))}
  </div>
)}

<Button
  type="button"
  size="sm"
  variant="outline"
  onClick={async () => {
    const res = await fetch('/api/ai/agreement-quality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: draft.description,
        responsibleName: responsibleName,
        dueDate: draft.dueDate,
      }),
    })
    const aiResult = await res.json()
    setAiSuggestion(aiResult)
  }}
>
  Validar con IA
</Button>

{aiSuggestion?.refined_description && (
  <div className="mt-2 p-3 border border-primary/30 bg-primary/5 rounded-md">
    <p className="text-xs text-muted-foreground mb-1">Sugerencia de IA:</p>
    <p className="text-sm">{aiSuggestion.refined_description}</p>
    <Button
      size="sm"
      variant="ghost"
      className="mt-2"
      onClick={() => setDraft({ ...draft, description: aiSuggestion.refined_description })}
    >
      Aplicar sugerencia
    </Button>
  </div>
)}
```

Necesitarás un useState para `aiSuggestion: { quality_score, warnings, refined_description } | null` y para `collaboratorOpenCount` (lo recibís como prop del page).

- [ ] **Step 3: Build verify + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/components/one-on-one/minute-editor.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F1): warnings inline + Validar con IA en minute-editor"
```

### Task BC5: Reporte AH "Acuerdos de baja calidad"

**Files:**
- Modify: `src/app/(dashboard)/arquitectura-humana/reportes/page.tsx`

- [ ] **Step 1: Agregar card al page**

```tsx
// Fetch:
const { data: lowQuality } = await supabase
  .from('agreements')
  .select(`
    id,
    description,
    ai_quality_score,
    ai_quality_warnings,
    due_date,
    status,
    responsible:users!agreements_responsible_id_fkey(full_name),
    one_on_one:one_on_ones!agreements_one_on_one_id_fkey(leader_id, collaborator_id)
  `)
  .lt('ai_quality_score', 3.0)
  .in('status', ['pendiente', 'parcial'])
  .order('ai_quality_score', { ascending: true })
  .limit(20)

// Render:
<Card className="shadow-neu">
  <CardHeader>
    <CardTitle>Acuerdos de baja calidad</CardTitle>
    <CardDescription>Score IA bajo 3.0 — revisar o reescribir</CardDescription>
  </CardHeader>
  <CardContent>
    <Table>
      <TableBody>
        {(lowQuality ?? []).map((a) => (
          <TableRow key={a.id}>
            <TableCell>{a.description.slice(0, 80)}…</TableCell>
            <TableCell>
              <Badge variant="destructive">{a.ai_quality_score?.toFixed(1)}</Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {a.ai_quality_warnings.join(', ')}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

- [ ] **Step 2: Build verify + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
pnpm build 2>&1 | tail -8
git add src/app/\(dashboard\)/arquitectura-humana/reportes/page.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F1): reporte AH de acuerdos con score IA bajo"
```

---

## Phase B-D — F5 Enfoque + F6 Calidez (1 agente, paralelizable)

### Task BD1: Contenido `guia-1to1.md`

**Files:**
- Create: `src/content/guia-1to1.md`

- [ ] **Step 1: Contenido**

```markdown
# Qué es y qué no es un 1:1

## Sí es...
- Un espacio para tu desarrollo personal y profesional, no para entregables operativos.
- Conversación sobre cómo te sentís, qué te bloquea, qué necesitás.
- Tiempo para feedback bidireccional (vos podés dar feedback a tu líder también).
- Momento para acuerdos sobre TU carrera, bienestar y crecimiento.

## No es...
- Status update operativo (eso va en tu reunión de equipo o standup).
- Lista de pendientes que tu líder te asigna como tareas.
- Revisión de KPIs (eso va en tu evaluación de desempeño).
- Sesión correctiva o de feedback negativo unidireccional.

## Buenas preguntas para abrir tu agenda
- ¿Cómo me siento con mi carga actual?
- ¿Qué me energiza esta semana? ¿Qué me desgasta?
- ¿Qué bloqueos necesito que mi líder ayude a remover?
- ¿Qué feedback necesito o quiero dar?
- ¿Cómo veo mi crecimiento en los próximos 3 a 6 meses?

## Tips para que sea valiosa
- Llegá con 2-3 temas que querés abordar.
- Si vas a hablar de algo difícil, pedí espacio: "necesito tu opinión sobre…".
- Cerrá con acuerdos claros: qué, quién, cuándo.
```

- [ ] **Step 2: Commit**

```bash
git add src/content/guia-1to1.md
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F5): guía 1:1 vs operativo en markdown"
```

### Task BD2: Component `focus-guidance.tsx` + integración en meeting-form

**Files:**
- Create: `src/components/one-on-one/focus-guidance.tsx`
- Modify: `src/components/one-on-one/meeting-form.tsx`

- [ ] **Step 1: focus-guidance.tsx**

```tsx
'use client'

import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const GUIDE_CONTENT = `... (markdown del contenido en guia-1to1.md, opcionalmente import con next-mdx o fetch del archivo) ...`

export function FocusGuidance() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="border-l-4 border-primary bg-accent/30 p-4 rounded-md mb-4">
        <div className="flex items-start gap-3">
          <BookOpen size={20} className="text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Recordá: esto es 1:1, no un seguimiento operativo.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Hablamos de cómo estás, qué te bloquea, qué necesitás. Los pendientes operativos van en tu reunión de equipo.
            </p>
            <Button
              variant="link"
              size="sm"
              className="px-0 h-auto text-xs text-primary mt-1"
              onClick={() => setOpen(true)}
            >
              Ver guía completa →
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Qué es y qué no es un 1:1</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none">
            <h2>Sí es...</h2>
            <ul>
              <li>Un espacio para tu desarrollo personal y profesional, no para entregables operativos.</li>
              <li>Conversación sobre cómo te sentís, qué te bloquea, qué necesitás.</li>
              <li>Tiempo para feedback bidireccional.</li>
              <li>Momento para acuerdos sobre tu carrera, bienestar y crecimiento.</li>
            </ul>
            <h2>No es...</h2>
            <ul>
              <li>Status update operativo (va en tu standup).</li>
              <li>Lista de pendientes que tu líder asigna como tareas.</li>
              <li>Revisión de KPIs (va en tu evaluación).</li>
              <li>Sesión correctiva o de feedback negativo unidireccional.</li>
            </ul>
            <h2>Buenas preguntas para abrir tu agenda</h2>
            <ul>
              <li>¿Cómo me siento con mi carga actual?</li>
              <li>¿Qué me energiza esta semana? ¿Qué me desgasta?</li>
              <li>¿Qué bloqueos necesito que mi líder ayude a remover?</li>
              <li>¿Qué feedback necesito o quiero dar?</li>
              <li>¿Cómo veo mi crecimiento en los próximos 3 a 6 meses?</li>
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Embed en meeting-form.tsx**

```tsx
// Arriba del campo de agenda items:
<FocusGuidance />
```

Si meeting-form es server component, importar `FocusGuidance` que es client por su `'use client'`. Funciona.

- [ ] **Step 3: Build verify + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/components/one-on-one/focus-guidance.tsx src/components/one-on-one/meeting-form.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F5): focus-guidance embebido en meeting-form"
```

### Task BD3: Server action `submitWarmthResponse`

**Files:**
- Create: `src/lib/actions/warmth.ts`

- [ ] **Step 1: Action**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types/domain'

const submitSchema = z.object({
  oneOnOneId: z.string().uuid(),
  feltHeard: z.number().int().min(1).max(5),
  comfortableSharing: z.number().int().min(1).max(5),
  leaderEngaged: z.number().int().min(1).max(5),
  conversationQuality: z.number().int().min(1).max(5),
  clarityAfterSession: z.number().int().min(1).max(5),
  freeComment: z.string().max(1000).optional(),
})

export async function submitWarmthResponse(
  input: z.infer<typeof submitSchema>
): Promise<ActionResult<{ id: string }>> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = submitSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  // Verificar que el caller es el colaborador de la sesión
  const { data: meeting } = await supabase
    .from('one_on_ones')
    .select('collaborator_id')
    .eq('id', parsed.data.oneOnOneId)
    .single<{ collaborator_id: string }>()

  if (!meeting) return { success: false, error: 'Reunión no encontrada' }
  if (meeting.collaborator_id !== user.id) return { success: false, error: 'Solo el colaborador puede responder' }

  const { data, error } = await supabase
    .from('meeting_warmth_responses')
    .insert({
      one_on_one_id: parsed.data.oneOnOneId,
      collaborator_id: user.id,
      felt_heard: parsed.data.feltHeard,
      comfortable_sharing: parsed.data.comfortableSharing,
      leader_engaged: parsed.data.leaderEngaged,
      conversation_quality: parsed.data.conversationQuality,
      clarity_after_session: parsed.data.clarityAfterSession,
      free_comment: parsed.data.freeComment ?? null,
    })
    .select('id')
    .single<{ id: string }>()

  if (error) return { success: false, error: error.message }

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    entity_type: 'meeting_warmth_response',
    entity_id: data!.id,
    action: 'warmth_submitted',
  })

  revalidatePath(`/colaborador/1to1/${parsed.data.oneOnOneId}`)
  return { success: true, data: { id: data!.id } }
}
```

- [ ] **Step 2: Build verify + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/lib/actions/warmth.ts
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F6): submitWarmthResponse server action"
```

### Task BD4: Component `warmth-survey.tsx`

**Files:**
- Create: `src/components/one-on-one/warmth-survey.tsx`

- [ ] **Step 1: Componente**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { submitWarmthResponse } from '@/lib/actions/warmth'

const QUESTIONS = [
  { key: 'feltHeard', label: 'Me sentí escuchada/o en esta sesión' },
  { key: 'comfortableSharing', label: 'Me sentí cómoda/o compartiendo lo que pensaba' },
  { key: 'leaderEngaged', label: 'Sentí que mi líder estuvo presente y enfocada/o' },
  { key: 'conversationQuality', label: 'La conversación fue significativa para mí' },
  { key: 'clarityAfterSession', label: 'Salí con claridad de los próximos pasos' },
] as const

type QuestionKey = typeof QUESTIONS[number]['key']

interface WarmthSurveyProps {
  oneOnOneId: string
  onSubmitted: () => void
}

export function WarmthSurvey({ oneOnOneId, onSubmitted }: WarmthSurveyProps) {
  const [responses, setResponses] = useState<Record<QuestionKey, number>>({
    feltHeard: 3,
    comfortableSharing: 3,
    leaderEngaged: 3,
    conversationQuality: 3,
    clarityAfterSession: 3,
  })
  const [comment, setComment] = useState('')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  function handleSubmit() {
    startTransition(async () => {
      const result = await submitWarmthResponse({
        oneOnOneId,
        feltHeard: responses.feltHeard,
        comfortableSharing: responses.comfortableSharing,
        leaderEngaged: responses.leaderEngaged,
        conversationQuality: responses.conversationQuality,
        clarityAfterSession: responses.clarityAfterSession,
        freeComment: comment.trim() || undefined,
      })

      if (!result.success) {
        toast({ title: 'No se pudo guardar', description: result.error, variant: 'destructive' })
        return
      }

      toast({ title: 'Gracias por tu feedback', description: 'Ya podés dar tu VoBo.' })
      onSubmitted()
      router.refresh()
    })
  }

  return (
    <Card className="shadow-neu">
      <CardHeader>
        <CardTitle>Calidez de la sesión</CardTitle>
        <CardDescription>
          Tu líder verá solo agregados, nunca respuestas individuales. Es seguro ser honesta/o.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {QUESTIONS.map((q) => (
          <div key={q.key} className="space-y-2">
            <Label className="text-sm font-medium">{q.label}</Label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">1</span>
              <Slider
                value={[responses[q.key]]}
                onValueChange={([v]) => setResponses((r) => ({ ...r, [q.key]: v }))}
                min={1}
                max={5}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground">5</span>
              <span className="text-sm font-semibold text-primary w-6 text-right">
                {responses[q.key]}
              </span>
            </div>
          </div>
        ))}

        <div className="space-y-2">
          <Label className="text-sm font-medium">Comentario libre (opcional)</Label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Cualquier cosa que quieras agregar…"
          />
          <p className="text-xs text-muted-foreground text-right">{comment.length}/1000</p>
        </div>

        <Button onClick={handleSubmit} disabled={isPending} className="w-full">
          {isPending ? 'Guardando…' : 'Guardar y habilitar VoBo'}
        </Button>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Build verify + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/components/one-on-one/warmth-survey.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F6): warmth-survey component con 5 Likert + textarea"
```

### Task BD5: Gate de VoBo en minute-editor + vobos action

**Files:**
- Modify: `src/lib/actions/vobos.ts`
- Modify: `src/components/one-on-one/minute-editor.tsx`

- [ ] **Step 1: Modificar vobo action para verificar warmth**

En `src/lib/actions/vobos.ts`, en la función que crea VoBo del colaborador:

```ts
// Antes del insert del vobo:
const { data: meeting } = await supabase
  .from('one_on_ones')
  .select('collaborator_id')
  .eq('id', input.oneOnOneId)
  .single<{ collaborator_id: string }>()

if (meeting?.collaborator_id === user.id) {
  // Es el colaborador dando VoBo — debe tener warmth response
  const { count: warmthCount } = await supabase
    .from('meeting_warmth_responses')
    .select('id', { count: 'exact', head: true })
    .eq('one_on_one_id', input.oneOnOneId)
    .eq('collaborator_id', user.id)

  if (!warmthCount || warmthCount === 0) {
    return { success: false, error: 'Completá la encuesta de calidez antes de dar VoBo' }
  }
}
```

- [ ] **Step 2: Embed survey en minute-editor**

En `minute-editor.tsx`, antes del bloque de VoBo del colaborador:

```tsx
import { WarmthSurvey } from './warmth-survey'

// Estado:
const [warmthSubmitted, setWarmthSubmitted] = useState(props.hasWarmthResponse)

// En el render, si meeting.status==='realizada' y el caller es colaborador y warmth no está submitted:
{isCollaborator && meeting.status === 'realizada' && !warmthSubmitted && (
  <WarmthSurvey
    oneOnOneId={meeting.id}
    onSubmitted={() => setWarmthSubmitted(true)}
  />
)}

// El botón de VoBo se renderiza solo si warmthSubmitted o si no es colaborador:
{(warmthSubmitted || !isCollaborator) && <VoBoButton ... />}
```

El page padre fetchea si ya existe warmth response:

```ts
const { count: warmthCount } = await supabase
  .from('meeting_warmth_responses')
  .select('id', { count: 'exact', head: true })
  .eq('one_on_one_id', meeting.id)

const hasWarmthResponse = (warmthCount ?? 0) > 0
```

Y lo pasa como prop a `<MinuteEditor hasWarmthResponse={hasWarmthResponse} />`.

- [ ] **Step 3: Build verify + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
pnpm build 2>&1 | tail -8
git add src/lib/actions/vobos.ts src/components/one-on-one/minute-editor.tsx src/app/\(dashboard\)/colaborador/1to1/\[id\]/page.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F6): gate VoBo del colaborador por warmth response"
```

### Task BD6: Trend del líder en /lider/configuracion

**Files:**
- Modify: `src/app/(dashboard)/lider/configuracion/page.tsx`

- [ ] **Step 1: Fetch + render**

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// Fetch:
const { data: agg } = await supabase
  .from('warmth_metrics_by_leader')
  .select('*')
  .eq('leader_id', user.id)
  .maybeSingle()

const { data: trend } = await supabase
  .from('warmth_trend_by_leader_month')
  .select('month, avg_overall, response_count')
  .eq('leader_id', user.id)
  .order('month', { ascending: true })
  .limit(6)

// Render:
{agg && (
  <Card className="shadow-neu">
    <CardHeader>
      <CardTitle>Tu calidez histórica</CardTitle>
      <CardDescription>
        Promedio de las 5 dimensiones de tus colaboradores. Privado para vos.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div>
          <p className="text-xs text-muted-foreground">Escucha</p>
          <p className="text-2xl font-semibold">{Number(agg.avg_felt_heard).toFixed(1)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Confianza</p>
          <p className="text-2xl font-semibold">{Number(agg.avg_comfortable_sharing).toFixed(1)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Presencia</p>
          <p className="text-2xl font-semibold">{Number(agg.avg_leader_engaged).toFixed(1)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Significado</p>
          <p className="text-2xl font-semibold">{Number(agg.avg_conversation_quality).toFixed(1)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Claridad</p>
          <p className="text-2xl font-semibold">{Number(agg.avg_clarity_after_session).toFixed(1)}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-2">Tendencia últimos 6 meses</p>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend ?? []}>
            <XAxis
              dataKey="month"
              tickFormatter={(m) => new Date(m).toLocaleDateString('es-MX', { month: 'short' })}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
            />
            <YAxis domain={[1, 5]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="avg_overall"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 2: Build verify + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
git add src/app/\(dashboard\)/lider/configuracion/page.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F6): widget de calidez histórica + trend en lider/configuracion"
```

### Task BD7: Heatmap calidez en AH/mapa-calor

**Files:**
- Create: `src/components/arquitectura-humana/warmth-heatmap.tsx`
- Modify: `src/app/(dashboard)/arquitectura-humana/mapa-calor/page.tsx`

- [ ] **Step 1: Componente heatmap**

```tsx
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface WarmthCell {
  label: string
  avg: number
  count: number
}

interface WarmthHeatmapProps {
  rows: WarmthCell[]
  title: string
  description: string
}

function cellColor(avg: number): string {
  // 1 = destructive, 3 = warning, 5 = success
  if (avg >= 4) return 'bg-success/30 text-success-foreground'
  if (avg >= 3) return 'bg-warning/30 text-warning-foreground'
  return 'bg-destructive/30 text-destructive-foreground'
}

export function WarmthHeatmap({ rows, title, description }: WarmthHeatmapProps) {
  return (
    <Card className="shadow-neu">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="text-sm w-40 truncate">{row.label}</span>
              <div className={`flex-1 rounded px-3 py-2 text-sm font-semibold ${cellColor(row.avg)}`}>
                {row.avg.toFixed(1)} <span className="text-xs opacity-70">({row.count} respuestas)</span>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Aún no hay respuestas para mostrar.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Wire en mapa-calor page**

```tsx
import { WarmthHeatmap } from '@/components/arquitectura-humana/warmth-heatmap'

// Fetch:
const { data: byLeader } = await supabase
  .from('warmth_metrics_by_leader')
  .select(`
    leader_id,
    response_count,
    avg_overall,
    leader:users!warmth_metrics_by_leader_leader_id_fkey(full_name)
  `)
  .order('avg_overall', { ascending: true })

const { data: byDept } = await supabase
  .from('warmth_metrics_by_department')
  .select('*')
  .order('avg_overall', { ascending: true })

// Render:
<WarmthHeatmap
  title="Calidez por líder"
  description="Promedio de las 5 dimensiones, ordenado de menor a mayor"
  rows={(byLeader ?? []).map((r) => ({
    label: r.leader?.full_name ?? 'Sin nombre',
    avg: Number(r.avg_overall),
    count: r.response_count,
  }))}
/>

<WarmthHeatmap
  title="Calidez por departamento"
  description="Promedio de calidez por área organizacional"
  rows={(byDept ?? []).map((r) => ({
    label: r.department_name ?? 'Sin departamento',
    avg: Number(r.avg_overall),
    count: r.response_count,
  }))}
/>
```

- [ ] **Step 3: Build verify + commit**

```bash
pnpm tsc -b 2>&1 | tail -3
pnpm build 2>&1 | tail -8
git add src/components/arquitectura-humana/warmth-heatmap.tsx src/app/\(dashboard\)/arquitectura-humana/mapa-calor/page.tsx
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "feat(F6): heatmap de calidez por líder y depto en AH/mapa-calor"
```

---

## Phase C — Integration + Polish

### Task C1: Cross-feature consistency review

**Files:**
- No modifica nada inicialmente — solo verifica.

- [ ] **Step 1: Greps de consistencia**

```bash
# Sin TODOs
grep -rn "TODO\|FIXME\|XXX" src/components/one-on-one src/components/shared src/lib/actions/warmth.ts src/lib/agreement-quality.ts 2>&1 | head -10

# Imports rotos
pnpm tsc -b 2>&1 | tail -5

# Build limpio
pnpm build 2>&1 | tail -10
```

- [ ] **Step 2: Verificar que `is_transferred` propaga correctamente**

```bash
grep -rn "is_transferred" src 2>&1
```
Expected: matches en agreement-list, lider/colaborador, AH/usuarios.

- [ ] **Step 3: Verificar warmth privacy**

```bash
grep -rn "meeting_warmth_responses" src 2>&1
```
El líder no debería tener queries sobre la tabla cruda — solo sobre las views. Inspeccionar matches.

- [ ] **Step 4: Documentar findings**

Anexar al page-map sección "C1 — Cross-feature findings". Si hay issues, abrirlos como tasks de fix.

- [ ] **Step 5: Commit del page-map actualizado (si hubo cambios)**

```bash
git add docs/superpowers/specs/2026-05-13-mejoras-1to1-page-map.md
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "docs(mejoras): findings de cross-feature review"
```

### Task C2: RLS testing manual

**Files:**
- No modifica código. Documenta resultados en page-map.

- [ ] **Step 1: Si tenés Supabase Studio o SQL editor, correr queries de Task A5 Step 3**

Validar que:
- Líder NO puede leer `meeting_warmth_responses` (rows = 0 desde su contexto auth).
- Líder SÍ puede leer `warmth_metrics_by_leader` (1 row).
- HR puede leer ambos.

- [ ] **Step 2: Documentar resultados**

Anexar a page-map: "RLS verification ✅" o "❌ con detalle".

### Task C3: A11y sweep

**Files:**
- Verificar sliders y dialogs.

- [ ] **Step 1: Sliders en warmth-survey tienen Label asociado**

Inspeccionar `<Slider>` — confirma que recibe `aria-label` o que el `<Label>` adyacente apunta correctamente.

- [ ] **Step 2: Modal de non-realization tiene focus management**

Abrir modal → focus inicial debería estar en el Select. Esc cierra.

- [ ] **Step 3: Contraste de badges `Transferido` y `quality low`**

Warning chips usan `text-warning` sobre `bg-warning/10`. Verificar contraste mínimo AA.

- [ ] **Step 4: Documentar y fixar si hace falta**

### Task C4: Final zero-error gate

**Files:**
- No modifica nada — verifica todo.

- [ ] **Step 1: Build limpio final**

```bash
pnpm tsc -b 2>&1 | tail -5
pnpm build 2>&1 | tail -30
```
Expected: ambos exit 0, zero warnings.

- [ ] **Step 2: Smoke manual (si dev server disponible)**

`pnpm dev` y navegar:
- `/colaborador` — ver dashboard
- `/colaborador/1to1/<algún_id_pasado>` — ver bloque de no-realización si aplica
- `/colaborador/1to1/<id_realizada>` — ver warmth survey + bloqueo VoBo
- `/lider/colaborador/<id>` — ver acuerdos abiertos (idealmente con un transferred)
- `/lider/configuracion` — ver calidez histórica del líder
- `/arquitectura-humana/mapa-calor` — ver heatmaps de calidez
- `/arquitectura-humana/reportes` — ver card de acuerdos baja calidad

- [ ] **Step 3: Commit final (si hubo polish changes)**

```bash
git status --short
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "polish(mejoras): final zero-error gate"
```

### Task C5: Squash merge prep (sin push)

**Files:**
- Branch op.

- [ ] **Step 1: Verificar branch + commits**

```bash
git log --oneline main..HEAD | wc -l
git log --oneline main..HEAD | head -30
```

- [ ] **Step 2: NO mergear ni pushear**

Ariel decide cuándo squash-mergear y pushear. Deja el branch con commits pequeños listos para review.

---

## Pack C — Sync Conexiones Humanas (NO implementar)

### Task PC1: Documentar contrato esperado

**Files:**
- Create: `docs/superpowers/specs/2026-05-13-pack-c-conexiones-humanas-contract.md`

- [ ] **Step 1: Crear doc con el contrato**

```markdown
# Pack C — Contrato esperado de Conexiones Humanas

**Status:** outline / waiting on external spec

## Lo que necesitamos del lado de Conexiones Humanas

### Datos requeridos por colaborador

| Campo | Tipo | Notas |
|---|---|---|
| employee_id | string | identificador estable |
| email | string | matching con users.email |
| full_name | string | |
| department_name o department_id | string | matching contra departments |
| leader_email | string | matching con users.email del líder |
| effective_date | date | cuándo aplica el cambio |
| status | enum | 'active' / 'inactive' |

### Métodos de transferencia (a definir con su equipo)

- Opción A: archivo CSV/Excel subido manualmente cada N días
- Opción B: endpoint REST que les podamos consultar
- Opción C: webhook que disparan ellos cuando hay cambio
- Opción D: replica de su DB (acceso read-only a una vista)

## Lo que dispara automáticamente este lado cuando se aplica un cambio

1. Cerrar leadership_relations activa con ended_at = effective_date
2. Crear nueva leadership_relations con started_at = effective_date
3. Notificación in-app + email a:
   - Nuevo líder ("heredaste N colaboradores")
   - Líder anterior ("ya no tenés a X en tu equipo")
   - Colaborador ("tu nuevo líder es Y")
4. F4 banner se activa automáticamente en el primer login del nuevo líder con ese colaborador

## Decisiones pendientes con su equipo

- [ ] Método de transferencia (A/B/C/D)
- [ ] Frecuencia (diario / on-demand / event-driven)
- [ ] Reconciliación inicial: ¿hay un dump histórico para alinear estado base?
- [ ] Edge cases: ¿qué pasa si un líder se va de la empresa pero sus colaboradores no se reasignan automáticamente?
- [ ] Quién recibe las notificaciones de baja completa (status='inactive')?

## Cuando se resuelvan estas decisiones, expandir este doc a spec ejecutable y crear plan correspondiente.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-13-pack-c-conexiones-humanas-contract.md
git -c user.email="acalderonm@b-drive.com.mx" -c user.name="Ariel Calderón" commit -m "docs(pack-c): contrato esperado de sync con Conexiones Humanas"
```

---

## Self-Review

**Spec coverage:**
- ✅ Pack A · F2 (3 sub-tasks: action + modal + wire) → Phase B-A
- ✅ Pack A · F4 (3 sub-tasks: action + banner + agreement-list) → Phase B-B
- ✅ Pack B · F1 (5 sub-tasks: helper + AI route + persist + UI + AH report) → Phase B-C
- ✅ Pack B · F5 (2 sub-tasks: content + component+wire) → Phase B-D Task BD1, BD2
- ✅ Pack B · F6 (5 sub-tasks: action + component + gate + trend + heatmap) → Phase B-D Tasks BD3-BD7
- ✅ Pack C outline-only → Phase PC1
- ✅ 5 migrations (F2 split en 2, F4 split en 2 — view + dismissal, F1, F6) → Phase A
- ✅ RLS testing → Phase C2
- ✅ A11y sweep → Phase C3
- ✅ Zero-error gate final → Phase C4

**Placeholder scan:** ningún TBD/TODO en steps. Las decisiones de scope deferidas (Pack C) se etiquetan explícitamente como "outline".

**Type consistency:**
- `markNonRealization` con enum exhaustivo (6 valores).
- `dismissTransferBanner` con `leadershipRelationId`.
- `submitWarmthResponse` con 5 Likert + freeComment, matchea schema SQL.
- `QualityWarningCode` define 8 valores que matchean `ai_quality_warnings` columna text[].
- `checkAgreementQuality` consume `AgreementDraft` con shape consistente.

**Migration ordering safety:**
- 7a antes que 7b (enum ADD VALUE no puede convivir con ALTER TABLE en misma TX).
- 8 (view) declara `ai_quality_*` cols opcionalmente. Task A4 incluye fallback `create or replace view` si A3 las dejó comentadas.

---

**Plan completo y listo para ejecutar.** Saved to `docs/superpowers/plans/2026-05-13-mejoras-1to1-pack-a-b.md`.

Dos opciones de ejecución:

1. **Subagent-Driven (recomendado)** — fresh subagent por phase, review entre tasks. Calza con tu método de waves paralelas.
2. **Inline Execution** — ejecuto las tasks en esta sesión con checkpoints.
