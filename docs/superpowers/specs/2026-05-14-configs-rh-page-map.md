# Page Map — Configs RH (4 packs)

> Wave 0 audit (Task W0.1). Inventario de archivos a tocar y consumers de configs hardcoded detectados vía grep en `src/`. Base SHA: `7a24561`.

## Wave 1 Foundation

Archivos compartidos por todos los packs. Se aterrizan **antes** del big bang paralelo de packs.

- `supabase/migrations/00000000000018_org_settings_table.sql` (NEW)
- `supabase/migrations/00000000000019_notification_rules.sql` (NEW)
- `supabase/migrations/00000000000020_notification_dispatches.sql` (NEW)
- `supabase/migrations/00000000000021_scheduled_reports.sql` (NEW)
- `src/lib/auth-guards.ts` (NEW) — `requireDirectorRH()` helper centralizado
- `src/lib/org-settings.ts` (NEW) — getter cacheado de `org_settings` por org_id
- `src/types/database.augmentation.ts` (modify: +4 row types: `org_settings`, `notification_rules`, `notification_dispatches`, `scheduled_reports`)
- `src/types/domain.ts` (modify: re-exports de los 4 row types nuevos)
- `src/components/layout/sidebar.tsx` (modify: +4 items HR — Parámetros, Cadencias, Notificaciones, Exportes; Sincronización ya outline)
- `package.json` (modify: +`cron-parser`)

## Pack 1 — Operación (Cadencias + Notificaciones + Departamentos)

Owned exclusivos:

- `src/app/(dashboard)/arquitectura-humana/cadencias/page.tsx` (modify — hoy existe con stub; agregar editor real)
- `src/app/(dashboard)/arquitectura-humana/notificaciones/page.tsx` (NEW)
- `src/lib/actions/cadence.ts` (NEW) — server actions de cadencia por depto
- `src/lib/actions/notification-rules.ts` (NEW) — CRUD reglas + toggle activo
- `src/lib/actions/departments.ts` (NEW) — alta/edición de departamentos
- `src/components/arquitectura-humana/cadence-editor.tsx` (NEW)
- `src/components/arquitectura-humana/notification-rule-card.tsx` (NEW)
- `src/components/arquitectura-humana/notification-rule-modal.tsx` (NEW)
- `src/components/arquitectura-humana/department-manager.tsx` (NEW)
- `src/app/api/cron/check-thresholds/route.ts` (NEW) — endpoint cron diario para evaluar reglas y disparar `notification_dispatches`
- `src/app/(dashboard)/arquitectura-humana/usuarios/[id]/page.tsx` (modify — selector de cadencia por usuario, override sobre depto)
- `vercel.json` (modify: +cron diario `check-thresholds`)
- `.env.example` (modify: +`CRON_SECRET`)

## Pack 2 — Tunable params (Parámetros del ERP)

Owned exclusivos:

- `src/app/(dashboard)/arquitectura-humana/parametros/page.tsx` (NEW)
- `src/lib/actions/org-settings.ts` (NEW) — `updateOrgSettings(section, payload)`
- `src/components/arquitectura-humana/params-section.tsx` (NEW) — wrapper sección con título + descripción + save
- `src/components/arquitectura-humana/warmth-questions-editor.tsx` (NEW) — editar las 2 preguntas Likert
- `src/components/arquitectura-humana/ai-features-config.tsx` (NEW) — toggles per-feature + modelo + temperatura
- `src/components/arquitectura-humana/agreement-quality-tuner.tsx` (NEW) — slider score mínimo + threshold acuerdos abiertos

Consumers a modificar (sustituir hardcoded por lookup a `org_settings`):

1. `src/lib/agreement-quality.ts` (modify) — `>= 7` actuales acuerdos abiertos → leer `org_settings.agreement_quality.max_open_per_collaborator`
2. `src/lib/actions/agreements.ts` (modify) — recibir threshold inyectado / leer settings
3. `src/lib/actions/minutes.ts` (modify) — mismo cambio que `agreements.ts`
4. `src/components/one-on-one/agreement-list.tsx` (modify) — threshold UI ya no hardcoded
5. `src/lib/ai/suggest-questions.ts` (modify) — modelo desde `org_settings.ai_features.suggest_questions.model`
6. `src/lib/ai/followup-plan.ts` (modify) — idem
7. `src/lib/ai/analyze-patterns.ts` (modify) — idem
8. `src/lib/ai/extract-agreements.ts` (modify) — idem
9. `src/app/api/ai/agreement-quality/route.ts` (modify) — `MODEL_NAME` constante → settings + `min_quality_score`
10. `src/lib/actions/warmth.ts` (modify) — textos de preguntas desde `org_settings.warmth_questions`
11. `src/components/one-on-one/warmth-survey.tsx` (modify) — render preguntas dinámicas
12. `src/components/one-on-one/detail-interaction.tsx` (modify) — labels desde settings
13. `src/app/(dashboard)/arquitectura-humana/reportes/page.tsx` (modify) — filtro `< 3.0` → `< org_settings.agreement_quality.min_score`

## Pack 3 — Reportería (Exportes CSV + reportes programados)

Owned exclusivos:

- `src/app/(dashboard)/arquitectura-humana/exportes/page.tsx` (NEW)
- `src/lib/actions/exports.ts` (NEW) — generación on-demand
- `src/lib/actions/scheduled-reports.ts` (NEW) — CRUD reportes recurrentes
- `src/app/api/exports/[type]/route.ts` (NEW) — descarga CSV
- `src/app/api/cron/send-scheduled-reports/route.ts` (NEW) — cron horario
- `src/components/arquitectura-humana/export-card.tsx` (NEW)
- `src/components/arquitectura-humana/scheduled-report-list.tsx` (NEW)
- `src/components/arquitectura-humana/scheduled-report-modal.tsx` (NEW)
- `src/lib/exports/cumplimiento-csv.ts` (NEW)
- `src/lib/exports/acuerdos-csv.ts` (NEW)
- `src/lib/exports/calidez-csv.ts` (NEW)
- `src/app/(dashboard)/arquitectura-humana/reportes/page.tsx` (modify: +botones de export por sección) — **shared con Pack 2**, coordinar
- `vercel.json` (modify: +cron horario `send-scheduled-reports`) — **shared con Pack 1**, coordinar

## Pack 4 — Outline only (Sincronización org extendida)

- `docs/superpowers/specs/2026-05-14-pack-4-org-sync-extended.md` (NEW) — spec stub
- `src/app/(dashboard)/arquitectura-humana/sincronizacion/page.tsx` (NEW) — placeholder con copy "Próximamente"
- `src/components/arquitectura-humana/sync-placeholder.tsx` (NEW)

## Findings de greps

### Consumers de `ai_quality_score` / `agreement_quality_score`

```
src/lib/agreement-quality.ts:6:  * guardar score y warnings en `agreements.ai_quality_score`
src/lib/actions/minutes.ts:130:  ai_quality_score: quality.score
src/lib/actions/agreements.ts:52:  ai_quality_score: quality.score
src/components/one-on-one/agreement-list.tsx:16:  ai_quality_score?: number | null
src/components/one-on-one/agreement-list.tsx:54:  quality_score: number
src/components/one-on-one/agreement-list.tsx:400: Sugerencia de IA (score {aiSuggestion.quality_score.toFixed(1)}/5)
src/app/api/ai/agreement-quality/route.ts:17:  quality_score: number
src/app/api/ai/agreement-quality/route.ts:49:  "quality_score": number (0-5)
src/app/(dashboard)/arquitectura-humana/reportes/page.tsx:42–146  → filtra `< 3.0` hardcoded + render `.toFixed(1)`
```

**Tunable a exponer:** `org_settings.agreement_quality.min_score` (default `3.0`).

### Consumers de threshold `>= 7` (acuerdos abiertos por colaborador)

```
src/lib/agreement-quality.ts:17  collaboratorOpenAgreementsCount: number
src/lib/agreement-quality.ts:104 if (draft.collaboratorOpenAgreementsCount >= 7) { ... }
src/lib/agreement-quality.ts:107 "Este colaborador ya tiene N acuerdos abiertos."
src/lib/actions/minutes.ts:124   collaboratorOpenAgreementsCount: openCounts.get(row.responsible_id) ?? 0
src/lib/actions/agreements.ts:40 collaboratorOpenAgreementsCount: openCount ?? 0
src/components/one-on-one/agreement-list.tsx:79  collaboratorOpenAgreementsCount: collaboratorOpenCount
```

**Tunable a exponer:** `org_settings.agreement_quality.max_open_per_collaborator` (default `7`).

### Modelo IA hardcoded (`'claude-sonnet-4-5'`)

```
src/lib/ai/suggest-questions.ts:24      model: 'claude-sonnet-4-5'
src/lib/ai/followup-plan.ts:28          model: 'claude-sonnet-4-5'
src/lib/ai/analyze-patterns.ts:27       model: 'claude-sonnet-4-5'
src/lib/ai/extract-agreements.ts:31     model: 'claude-sonnet-4-5'
src/app/api/ai/agreement-quality/route.ts:8  MODEL_NAME = 'claude-sonnet-4-5'
```

No se encontraron usos de `'claude-haiku-4-5-20251001'` actualmente. **Tunable a exponer:** `org_settings.ai_features.<feature>.{enabled, model, temperature}`.

### Warmth questions hardcoded

```
src/components/one-on-one/warmth-survey.tsx   → textos preguntas Likert (felt_heard / comfortable_sharing)
src/lib/actions/warmth.ts:43–44                → keys `felt_heard`, `comfortable_sharing`
src/components/one-on-one/detail-interaction.tsx → labels en detalle 1:1
src/lib/actions/vobos.ts:36                    → lectura `meeting_warmth_responses`
```

**Tunable a exponer:** `org_settings.warmth_questions = [{ key, label, scale_min, scale_max }, …]` (default 2 preguntas actuales).

### `non_realization_max_days` / `interval '7 days'`

Grep `interval '7 days'` y `7 days`: **0 hits** en `src/` y `supabase/`. El concepto `non_realization` sí existe como enum/columnas (`non_realization_reason`, `non_realization_note`, `non_realization_marked_at`) en:

```
src/lib/actions/one-on-ones.ts:133–212  → flujo "marcar no realizada"
src/lib/actions/disputes.ts:36          → fallback 'sin_justificacion'
src/types/database.augmentation.ts:25–27 → columnas augmentadas
src/types/database.types.ts:547–584      → enum oficial
```

**Hallazgo:** hoy NO hay límite temporal codificado para marcar no-realización. El plan tiene que decidir si Pack 1 introduce ese threshold como `org_settings.cadence.non_realization_max_days` o lo deja fuera de scope. Quedará marcado en el spec del Pack 1 como decisión pendiente — best-effort.

### `transfer_banner` (relacionado al threshold de transferencia de liderazgo)

```
src/app/(dashboard)/lider/colaborador/[id]/page.tsx (TransferBanner UI + lectura transfer_banner_dismissed_at)
src/components/shared/transfer-banner.tsx
src/lib/actions/one-on-ones.ts:240–262   (dismissTransferBanner)
src/types/database.augmentation.ts:36     transfer_banner_dismissed_at
supabase/migrations/00000000000015_transfer_banner_dismissal.sql
```

**Hallazgo:** el banner ya existe con su columna de dismissal. No hay threshold de días hardcoded en `src/` — la lógica de "cuándo mostrar" usa solamente `dismissed_at IS NULL`. Si Pack 1 quiere tunable "días desde transferencia para mostrar banner", hoy no hay consumer que sustituir — agregar como mejora futura, fuera de scope Wave 1.

## Resumen de impacto Pack 2 (modify count)

| Categoría | Archivos a modificar |
|---|---|
| Agreement quality (score + max abiertos) | 7 |
| Modelo IA hardcoded | 5 |
| Warmth questions | 4 |
| **Total consumers** | **16** (más de los 9 estimados en plan) |

> Nota: el plan W2.1 estimaba 9 consumers; los greps detectaron 16 puntos efectivos. Esto incide en el esfuerzo del Pack 2 — recomendar al agente Pack 2 batcher los cambios por categoría (3 PRs lógicos en un commit grande) y dejar `agreement-quality.ts` como source-of-truth para evitar duplicar lectura de `org_settings`.

---

## Wave 3 — Integration findings (2026-05-14)

Cross-pack consistency review post-implementation. Resultado: **DONE_WITH_CONCERNS** (1 fix tactical aplicado, dev server bloquea screenshots por seed users no usables en entorno actual).

### Cross-pack consistency (Task 1)

| Check | Resultado |
|---|---|
| Sidebar: 4 items HR nuevos (rh-notif, rh-params, rh-export, rh-sync) | OK — todos presentes en `src/components/layout/sidebar.tsx:43-46` |
| Page heads (`page__eyebrow` + `page__title`) en las 4 pages | OK — los 4 archivos tienen ambos |
| `requireHR` en todas las server actions nuevas | OK — `cadence.ts`, `notification-rules.ts`, `departments.ts`, `org-settings.ts`, `exports.ts`, `scheduled-reports.ts` |
| `CRON_SECRET` en endpoints cron nuevos | OK — `check-thresholds/route.ts` + `send-scheduled-reports/route.ts` |
| `getOrgSetting` único en `src/lib/org-settings.ts` (no hay duplicados) | OK |
| Pack 1 no toca `org_settings` (separación de responsabilidades) | OK — cadence/notification-rules/departments no leen ni escriben settings |

### Security review (Task 2)

| Check | Resultado |
|---|---|
| `'use server'` en todas las actions nuevas | OK (6/6) |
| RLS policies en las 4 tablas nuevas (org_settings, notification_rules, notification_dispatches, scheduled_reports) | OK — migraciones 00000000000018-21 todas declaran `enable row level security` + policies HR + (para dispatches) policy recipient_select_own |
| Zod length limits en strings free-text | OK — `name.max(100)`, `scheduleCron.max(120)`, recipients `.email().max(50)` |
| Zod UUID validation en argumentos `id: string` de actions | **GAP detectado** — `notification-rules.ts` y `scheduled-reports.ts` aceptaban `id: string` sin validar UUID en update/toggle/delete/run-now. Fix tactical aplicado: agregar `z.string().uuid().safeParse(id)` en cada entry point. RLS y el constraint UUID de la columna ya protegen la BD, pero la validación explícita devuelve error legible en lugar de no-op silencioso. |

### Feature flag hard-fail (Task 3 — Pack 2)

Los 5 entry points IA hacen early-return cuando el flag está off:

| Archivo | Flag | Comportamiento si off |
|---|---|---|
| `src/lib/ai/extract-agreements.ts:26` | `extract_agreements` | `return { agreements: [] }` |
| `src/lib/ai/suggest-questions.ts:21` | `suggest_questions` | `return { questions: [] }` |
| `src/lib/ai/analyze-patterns.ts:24` | `analyze_patterns` | `return { analysis: null }` |
| `src/lib/ai/followup-plan.ts:27` | `refine_agreement` | `return { plan: null }` |
| `src/app/api/ai/agreement-quality/route.ts:29` | `refine_agreement` | Devuelve `quality_score: 5, warnings: [], refined_description: null` sin llamar a Anthropic |

No hay leak de llamadas a Anthropic cuando el flag está off.

### Zero-error gate (Task 4)

- `pnpm tsc -b` → exit 0, sin output (post-fixes UUID también pasa)
- `pnpm build` → exit 0, 31 rutas compiladas incluyendo las 4 nuevas (`/notificaciones`, `/parametros`, `/exportes`, `/sincronizacion`). Solo warnings de Node `punycode` deprecation (no son nuestro código).

### Smoke screenshots (Task 5)

- Dev server respondió 307 (auth redirect) a las 4 rutas, confirmando que están registradas en el router de Next.
- `pnpm screenshot` con `--user=admin` (admin@b-drive.com) y `--user=demolider` ambos fallan login con timeout — el seed user del entorno actual no parece coincidir con los preset credentials del script o los users no fueron seeded en esta DB.
- **Screenshots no logrados.** No es un blocker funcional: el routing está OK, la build pasa, los renders client-side han sido validados por tsc. Pero queda pendiente smoke visual manual antes del merge.

### Fixes aplicados en Wave 3

1. `fix(W3): validar UUID en id args de notification-rules y scheduled-reports` — defensive Zod uuid guard en `updateNotificationRule`, `toggleNotificationRule`, `deleteNotificationRule`, `testFireRule`, `toggleScheduledReport`, `deleteScheduledReport`, `runReportNow`.

### Concerns para el controlador antes del merge final

1. **Screenshots no validados visualmente.** Antes del merge a `main`, levantar el dev server con un user real y abrir manualmente `/arquitectura-humana/{notificaciones,parametros,exportes,sincronizacion}` para confirmar que se ven coherentes. El routing y el build pasan; lo único pendiente es UX visual.
2. **Email send sigue stub.** `runReportNow` y `send-scheduled-reports` cron loggean a consola + escriben audit trail en `notification_dispatches`, pero no envían email real. Pendiente integrar Resend/SMTP (fuera de scope Wave 1-2).
3. **`transfer_banner_enabled` consumer.** Pack 2 wireó el flag, pero el spec original notó que la lógica de "cuándo mostrar el banner" sigue basada solo en `dismissed_at IS NULL`. Verificar que el flag efectivamente apague el banner cuando está en `false`.
