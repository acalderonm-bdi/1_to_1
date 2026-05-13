# Mejoras 1to1 — Design Spec

**Fecha:** 2026-05-13
**Autor:** Ariel Calderón
**Estado:** Aprobado (brainstorm) — pendiente plan de implementación
**Origen:** acuerdos de sesión de cliente, 6 features solicitadas

## Objetivo

Incorporar a la plataforma 1to1 seis mejoras solicitadas por el cliente, distribuidas en tres packs entregables incrementalmente:

- **Pack A — Quick wins data layer:** justificación de sesiones (F2) y visibilidad del histórico de acuerdos en cambios de líder (F4).
- **Pack B — Calidad de la sesión:** lineamientos para acuerdos SMART (F1), guía de enfoque 1:1 vs operativo (F5), encuesta de calidez post-sesión (F6).
- **Pack C — Sync externo (outline):** integración con la base de datos de Conexiones Humanas para gestión de cambios de área y líder (F3). Detalle de implementación queda en espera del schema/formato de la fuente externa.

## No-objetivos

- **No reescribir** los flujos existentes de agendado, ejecución, VoBo o disputas. Las mejoras se ENCIMAN sobre el modelo y UI actuales.
- **No bloquear** la creación de acuerdos por falta de criterios SMART. Warnings blandos solamente.
- **No implementar** Pack C hasta tener spec de la fuente externa. Sólo se documenta el contrato esperado.
- **No introducir** detección AI en agenda (F5 es solo template/guidance — decisión explícita del brainstorm).
- **No agregar** survey general semanal (F6 va atado a cada sesión, no a un cron de pulse).

---

## Pack A — Data layer wins

### F2 — Justificación de sesiones

#### Schema

Migration `00000000000007_session_justification.sql`:

```sql
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

El enum `non_realization_reason` se extiende con 2 valores para cubrir casos reales no contemplados:

```sql
alter type public.non_realization_reason add value if not exists 'emergencia';
alter type public.non_realization_reason add value if not exists 'vacaciones';
```

Catálogo final (6 valores): `reagendada`, `cancelada_cargas`, `ausencia`, `emergencia`, `vacaciones`, `sin_justificacion`. El último queda como catch-all para casos que AH revisará manualmente.

**Importante:** `alter type … add value` no puede correr dentro de la misma transacción que el `alter table` siguiente. La migration ejecuta los `add value` primero, hace commit, luego corre el `alter table`. Implementar como dos archivos: `00000000000007a_extend_non_realization_enum.sql` y `00000000000007b_session_justification_columns.sql`, o usar `BEGIN`/`COMMIT` explícitos.

#### Server action

`src/lib/actions/one-on-ones.ts`:

```ts
export async function markNonRealization(input: {
  oneOnOneId: string
  reason: NonRealizationReason
  note?: string
}): Promise<ActionResult<{ status: MeetingStatus }>>
```

Lógica:
1. Verificar que el caller es líder o colaborador de la sesión, o tiene rol `hr`.
2. Si la sesión ya tenía `non_realization_reason` distinto del que se intenta marcar → setear `status = 'en_disputa'` (flujo existente).
3. Si no había marca previa o coincide → setear `status = 'no_realizada'`, `non_realization_reason`, `note`, `marked_by = caller`, `marked_at = now()`.
4. Audit log entry vía `audit_logs` (patrón existente).
5. Revalidate paths relevantes.

#### UI

- `src/components/one-on-one/meeting-card.tsx`: si `status === 'agendada'` y `scheduled_at < now()`, mostrar botón "Marcar como no realizada".
- Nuevo componente `src/components/one-on-one/non-realization-modal.tsx`:
  - Select de `non_realization_reason` (4 opciones, labels en español)
  - Textarea opcional, 500 char max, counter visible
  - Botón "Guardar" → llama `markNonRealization`
  - Si la sesión queda en disputa, redirige a `/arquitectura-humana/disputas/[id]` o muestra toast con link.
- En la vista detalle (`colaborador/1to1/[id]`, `lider/1to1/[id]`) cuando `status === 'no_realizada'`: bloque informativo con el motivo, la nota, quién lo marcó y cuándo.

#### Actor / RLS

RLS policy ya existe sobre `one_on_ones` (líder, colaborador, hr). El server action confía en RLS y agrega validación de status transitions.

---

### F4 — Histórico de acuerdos al cambio de líder

#### Schema

Migration `00000000000008_open_agreements_view.sql`:

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

-- Allow the same roles that read agreements:
grant select on public.open_agreements_by_collaborator to authenticated;
```

RLS se hereda de las tablas base (vista no-security-invoker en Postgres por defecto delega).

#### UI

- `src/app/(dashboard)/lider/colaborador/[id]/page.tsx`: sección "Acuerdos abiertos" usa la nueva view filtrada por `collaborator_id = params.id`. Cada item con `is_transferred = true` muestra badge "Transferido del líder anterior" (color `bg-warning text-warning-foreground`).
- Banner discreto al primer login del nuevo líder con un colaborador transferido: ver detalle abajo.
- `src/app/(dashboard)/arquitectura-humana/usuarios/[id]/page.tsx`: misma sección visible para AH.

#### Banner "primer login con colaborador transferido"

Mecanismo:
- Al cargar `lider/colaborador/[id]`, si:
  - existe relación `(leader_id = current_user, collaborator_id = params.id, ended_at is null)`,
  - hay ≥1 acuerdo abierto transferido del líder anterior,
  - `leadership_relations.transfer_banner_dismissed_at is null`,
  - el líder no ha dado VoBo en ninguna sesión con este colaborador aún (señal de "primer contacto"),
- entonces mostrar banner: "Heredaste N acuerdos abiertos de [Nombre líder anterior] sobre [Nombre colaborador]."

**Sin timeout temporal:** el banner persiste hasta cumplirse una de dos condiciones (lo primero que ocurra):
1. El líder lo dismissea explícitamente (botón X).
2. El líder da su primer VoBo en una sesión con ese colaborador (señal implícita de "ya tomé conocimiento").

Cualquiera de las dos condiciones llena `transfer_banner_dismissed_at` vía server action.

Dismissal:
- Columna `transfer_banner_dismissed_at timestamptz` en `leadership_relations`. Updated vía server action `dismissTransferBanner(relationId)` o automáticamente por el trigger de VoBo (ver abajo).
- Trigger SQL: cuando se inserta un `vobo` con `(meeting.leader_id = current_relation.leader_id AND meeting.collaborator_id = current_relation.collaborator_id)`, set `transfer_banner_dismissed_at = now()` en la relación activa si aún era null.

Migration `00000000000009_transfer_banner_dismissal.sql`:

```sql
alter table public.leadership_relations
  add column transfer_banner_dismissed_at timestamptz;
```

---

## Pack B — Calidad de la sesión

### F1 — Lineamientos de acuerdos (warning blando + AI refine)

#### Schema

Migration `00000000000010_agreement_quality.sql`:

```sql
alter table public.agreements
  add column ai_quality_score numeric(2,1) check (ai_quality_score between 0 and 5),
  add column ai_quality_warnings text[] default '{}'::text[];
```

#### Reglas SMART (cliente)

Implementadas en `src/lib/agreement-quality.ts`:

```ts
export interface AgreementDraft {
  description: string
  responsibleId: string | null
  dueDate: string | null
  collaboratorOpenAgreementsCount: number
}

export interface QualityCheck {
  passed: boolean
  warnings: Array<{
    code: 'too_short' | 'no_due_date' | 'past_due_date' | 'no_responsible'
        | 'overloaded_collaborator' | 'ambiguous_wording'
        | 'no_measurable_outcome' | 'unrealistic_deadline'
    message: string
    suggestion?: string
  }>
  score: number
}

export function checkAgreementQuality(draft: AgreementDraft): QualityCheck
```

Reglas cliente (sin AI):
1. `description.length >= 12` → si no → `too_short`.
2. `responsibleId` set → `no_responsible` si null (UI debería forzarlo).
3. `dueDate` set y >= today → `no_due_date` / `past_due_date`.
4. `collaboratorOpenAgreementsCount < 7` → `overloaded_collaborator` si ya tiene 7+.
5. Regex sobre descripción: si NO contiene patrón de entregable verificable (verbo + sustantivo concreto: "entregar reporte", "presentar plan", "completar curso") → `no_measurable_outcome`. Patrón laxo, mejor false-positive que false-negative.
6. `dueDate` < `today + 1 day` → `unrealistic_deadline` (warning, no error). IA puede afinar con contexto.

Las reglas 5 y 6 son verificables sin IA (regex + date math). IA agrega `ambiguous_wording` y refina `unrealistic_deadline` con contexto del colaborador.

#### AI route — calidad y refinamiento

`src/app/api/ai/agreement-quality/route.ts` (nuevo):

POST body:
```ts
{ description: string, responsibleName: string, dueDate: string | null }
```

Response:
```ts
{
  quality_score: number,
  warnings: Array<{ code: 'ambiguous_wording', message: string, suggestion?: string }>,
  refined_description: string | null  // sugerencia mejorada
}
```

Implementación: prompt a Anthropic Claude con criterios SMART y few-shot examples. Saved score + warnings se persisten en `agreements.ai_quality_*` al guardar.

#### UI

- `src/components/one-on-one/minute-editor.tsx` o donde se agreguen acuerdos:
  - Mientras se escribe → checks cliente inline (chips de warning).
  - Botón "Validar con IA" (opcional, no automático para evitar costo) → llama `/api/ai/agreement-quality`.
  - Si IA devuelve `refined_description`, mostrar diff y botón "Aplicar sugerencia".
- En lista de acuerdos del colaborador y vista AH: badge de calidad ("Alta", "Media", "Baja") según `ai_quality_score`.

#### Reporte AH

`arquitectura-humana/reportes` agrega tarjeta "Acuerdos con baja calidad" (score < 3.0). Lista paginada.

---

### F5 — Enfoque de la sesión (template guidance)

#### Sin schema

Solo contenido estático y UI.

#### Contenido

`src/content/guia-1to1.md` (nuevo): markdown corto explicando qué es y qué no es un 1:1.

```markdown
# Qué es y qué no es un 1:1

## Sí es...
- Un espacio para tu desarrollo, no para entregables.
- Conversación sobre cómo te sentís, qué te bloquea, qué necesitás.
- Tiempo para feedback bidireccional.
- Momento para acuerdos sobre TU carrera y bienestar.

## No es...
- Status update operativo (eso va en tu reunión de equipo).
- Lista de pendientes que tu líder te asigna.
- Revisión de KPIs (eso va en tu evaluación).

## Buenas preguntas para una agenda 1:1
- ¿Cómo me siento con mi carga actual?
- ¿Qué me energiza esta semana? ¿Qué me desgasta?
- ¿Qué bloqueos necesito que mi líder ayude a remover?
- ¿Qué feedback necesito o quiero dar?
- ¿Cómo veo mi crecimiento próximo?
```

#### UI

- `src/components/one-on-one/meeting-form.tsx`: arriba del campo de agenda, bloque destacado (border-l-4 border-primary) con la regla de oro y un link "Ver guía completa" → abre modal con el markdown.
- Placeholders de agenda items rotan entre 4 ejemplos buenos (de la lista de "buenas preguntas").
- Nuevo componente `src/components/one-on-one/focus-guidance.tsx`.

---

### F6 — Calidez de la reunión (3-5 preguntas requeridas)

#### Schema

Migration `00000000000011_warmth_survey.sql`:

```sql
-- Opt-in del colaborador para compartir comentarios libres con AH
alter table public.users
  add column allow_share_warmth_comments boolean not null default false;

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
  with check (collaborator_id = (select id from public.users where id = auth.uid()));

create policy "warmth_collaborator_select_own"
  on public.meeting_warmth_responses
  for select
  using (collaborator_id = (select id from public.users where id = auth.uid()));

create policy "warmth_hr_select_all"
  on public.meeting_warmth_responses
  for select
  using ((select role from public.users where id = auth.uid()) = 'hr');

-- Líder NO ve respuestas individuales — solo agregados a través de la view.
```

#### Preguntas (5 Likert + 1 texto opcional)

1. "Me sentí escuchada/o en esta sesión" → `felt_heard`
2. "Me sentí cómodo/a compartiendo lo que pensaba" → `comfortable_sharing`
3. "Sentí que mi líder estuvo presente y enfocado/a" → `leader_engaged`
4. "La conversación fue significativa para mí" → `conversation_quality`
5. "Salí con claridad de los próximos pasos" → `clarity_after_session`
6. Comentario libre (opcional) → `free_comment`

El brief original pedía "3 a 5 preguntas" — se usan las 5 para cobertura completa de las dimensiones humanas (escucha, seguridad, presencia, significado) más la dimensión accionable (claridad). AH puede ajustar los textos sin tocar schema.

#### Vistas agregadas

```sql
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
```

Acceso a `warmth_metrics_by_leader` y `warmth_metrics_by_department` se restringe a `role = 'hr'` en una policy o consumiéndolas solo desde server actions con verificación.

#### Server action

`src/lib/actions/warmth.ts`:

```ts
export async function submitWarmthResponse(input: {
  oneOnOneId: string
  feltHeard: number
  comfortableSharing: number
  leaderEngaged: number
  conversationQuality: number
  freeComment?: string
}): Promise<ActionResult<{ id: string }>>
```

Lógica:
1. Verificar que caller es el colaborador de la sesión.
2. Insertar fila (constraint uniq previene duplicados).
3. Audit log.

#### UI

- `src/components/one-on-one/warmth-survey.tsx` (nuevo): card con 5 sliders Likert 1-5 + textarea opcional + botón "Guardar".
- En `minute-editor.tsx`: bloque se muestra al colaborador cuando `status === 'realizada'` y aún no envió VoBo. Si la encuesta no está completa, el botón "Dar VoBo" queda disabled con tooltip "Completá las 5 preguntas de calidez".
- AH ve nuevos widgets en `arquitectura-humana/mapa-calor`:
  - Heatmap de calidez por líder (`warmth_metrics_by_leader`)
  - Heatmap por departamento (`warmth_metrics_by_department`)
- AH ve sección "Comentarios libres recientes" (con consentimiento — colaborador opta-in en su perfil).

#### Privacidad

- Líder **nunca** ve respuestas individuales del colaborador (ni en su dashboard ni en la sesión específica).
- Líder ve solo sus propios agregados en `lider/configuracion`: promedio histórico de las 5 dimensiones + trend (line chart de avg_overall por mes, últimos 6 meses) consumido de `warmth_metrics_by_leader`. Esto le da feedback accionable sin romper la psychological safety del colaborador.
- AH ve agregados completos (por líder y por departamento) en `mapa-calor`.
- AH ve **comentarios libres solo si el colaborador opt-in** (`users.allow_share_warmth_comments = true`). Default opt-out.
- Política RLS específica para `free_comment`: la vista para AH se filtra para incluir comments solo cuando el colaborador opt-in. Se implementa con una vista adicional `warmth_comments_visible_to_hr`.

---

## Pack C — Sync Conexiones Humanas (outline)

### Contrato esperado de la fuente externa

Cuando se reciba el schema definitivo, la fuente debería proveer al menos:

| Campo | Tipo | Notas |
|---|---|---|
| `employee_id` | string | identificador estable de Conexiones Humanas |
| `email` | string | matching con `users.email` |
| `full_name` | string | |
| `department_name` o `department_id` | string | matching contra `departments.name` |
| `leader_email` | string | matching con `users.email` del líder |
| `effective_date` | date | cuándo aplica el cambio |
| `status` | enum ('active','inactive') | bajas también |

### Componentes a construir (cuando llegue spec)

- `src/lib/sync/conexiones-humanas/`:
  - `parser.ts` — leer CSV/JSON/API según formato
  - `differ.ts` — comparar contra estado actual, producir diff `(create, update, terminate)`
  - `applier.ts` — aplicar diffs en transacción
- `src/app/api/admin/sync-org/route.ts` — endpoint manual, requiere rol hr
- `src/app/api/cron/sync-org/route.ts` — opcional, ejecución programada
- UI en `arquitectura-humana/estructura`: botón "Sincronizar desde Conexiones Humanas" → preview de diff → "Aplicar".

### Reglas de transición de líder

Cuando el sync detecta cambio de líder para un colaborador:

1. Cerrar `leadership_relations` activa con `ended_at = effective_date`.
2. Crear nueva `leadership_relations` con `started_at = effective_date`.
3. Disparar notificaciones (in-app + email):
   - Al nuevo líder: "Tenés un nuevo colaborador: [Nombre], con N acuerdos abiertos transferidos".
   - Al líder anterior: "[Nombre] ya no está en tu equipo".
   - Al colaborador: "Tu nuevo líder es [Nombre]".
4. Las queries de F4 (Histórico) ya devuelven los acuerdos transferidos automáticamente.

### Estado del Pack C

- Spec de la fuente externa: **pendiente** (acceso bloqueado al momento del brainstorm).
- Diseño técnico: documentado arriba como interfaz.
- Implementación: **no inicia** hasta tener el spec del payload y método de transferencia (API vs archivo vs replica).

---

## Plan de migración (waves para Pack A + Pack B)

### Wave 0 — Spec audit (1 agente)

- Mapear componentes existentes que tocan: `meeting-card`, `meeting-form`, `minute-editor`, `agreement-list`, `vobo-button`, vistas detalle 1:1, dashboard líder/AH.
- Producir `docs/superpowers/specs/2026-05-13-mejoras-1to1-page-map.md` con qué archivos hay que tocar por feature.

### Wave 1 — Schema migrations (1 agente, blocking)

- Crear migrations 00000000000007 (F2), 00000000000008 (F4 view), 00000000000009 (F4 dismissal), 00000000000010 (F1), 00000000000011 (F6).
- Regenerar types con `pnpm db:types` (o usar Supabase CLI manual si no hay credenciales).
- Verificar `pnpm tsc -b` zero-error.

### Wave 2 — Implementación paralela (4 agentes)

| Agente | Scope |
|---|---|
| A | F2 — modal motivo + server action + UI vista detalle |
| B | F4 — view consumer + badge transferido + banner dismissal |
| C | F1 — checks cliente + AI quality endpoint + UI warnings + report AH |
| D | F5 + F6 — guía de enfoque + warmth-survey component + heatmap calidez |

Cada agente trabaja en archivos independientes (sin conflicto cross-feature) y commitea por feature.

### Wave 3 — Integración + AH dashboards

- Reviewer 1: cross-feature consistency (badge styling, modal patterns, RLS verificada).
- Reviewer 2: AH dashboards (mapa-calor calidez, reporte acuerdos bajos, transferencias recientes).

### Wave 4 — Zero-error gate + commit + push

- `pnpm tsc -b` + `pnpm build` limpios.
- Manual QA: simular 1:1 no realizada, cambio de líder, acuerdo vago, sesión completada con warmth survey.
- Squash merge `feat/mejoras-1to1` → `main`.

---

## Riesgos y mitigaciones

1. **Migration en producción sin downtime.** Las 5 migrations son `add column` / `create table` / `create view` — todas no-disruptivas. Mitigación: aplicar en orden, validar con `pnpm db:push` en staging si existe.

2. **RLS para warmth survey.** El líder NO debe ver respuestas individuales. Las policies declaradas arriba son la mitigación; reviewer de Wave 3 debe verificarlas explícitamente con queries de testing.

3. **AI cost por agreement-quality.** Cada llamada a Anthropic suma. Mitigación: NO automático, solo bajo botón "Validar con IA". Cache resultados en la fila del acuerdo.

4. **Banner de transferencia spam.** Si un líder hereda 10 colaboradores el mismo día, ve 10 banners. Mitigación: banner consolida en uno solo "Heredaste N colaboradores con M acuerdos abiertos en total — ver detalle".

5. **Privacidad de comentarios libres en warmth.** Solo AH los ve agregados. Mitigación: opt-in del colaborador en su perfil; si no opta-in, AH ve solo numéricas.

6. **Pack C bloqueado.** No bloquea Pack A + B. Mitigación: deliverable A + B independiente; C arranca cuando llegue spec.

---

## Aceptación

### Pack A

- Líder o colaborador puede marcar un 1:1 como no realizado con motivo + nota opcional desde la vista detalle.
- En disputa funciona como antes.
- Nuevo líder de un colaborador ve sus acuerdos abiertos heredados con badge "Transferido".
- Banner de bienvenida aparece al primer login con colaborador transferido; dismissable.

### Pack B

- Acuerdos muestran warnings inline cuando incumplen criterios cliente. No bloquean save.
- Botón "Validar con IA" devuelve score + warnings + refined_description sugerida.
- Meeting form muestra bloque de guía 1:1 con link a modal explicativo.
- Colaborador completa 4 preguntas Likert + comentario opcional antes de poder dar VoBo.
- AH ve mapa de calor de calidez por líder/departamento.

### Pack C

- Spec entregado y revisado por Conexiones Humanas + Arquitectura Humana.
- No requiere código en esta entrega.

### Gates zero-error

- `pnpm tsc -b` y `pnpm build` zero-error.
- RLS testing manual confirma privacy de warmth.
- A11y: contraste warning chips, labels asociados a sliders.
