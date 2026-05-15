# Auditoría `database.types.ts` staleness

> Generado el 2026-05-15 por audit read-only (sin regeneración).

## Resumen

- Última modificación de `src/types/database.types.ts` (mtime FS): **2026-05-13 17:10:35 -0600**
  - No hay header con timestamp dentro del archivo (Supabase no lo emite). El mtime del filesystem es la única señal disponible.
  - Para confirmar la fecha de generación exacta, el user puede correr `git log -1 --format=%cI -- src/types/database.types.ts`.
- Migrations posteriores no reflejadas en types: **12** (migraciones 12 a 23 inclusive).
  - De estas, 10 introducen cambios de schema visibles por la API REST (12-21), y 2 son sólo policies RLS sin impacto en tipos (22, 23).
- `as never` en `src/`: **63 ocurrencias** en 18 archivos (incluye 5 ocurrencias en comentarios y 1 en un mensaje JSDoc; netas en código: 57).
- Augmentations conocidas en `database.augmentation.ts`: **14 tipos exportados** (1 enum + 13 interfaces).

## Inventario tipos generados (snapshot actual)

Tablas/views presentes en `database.types.ts`:

```
agenda_items, agreement_followups, agreements, ai_insights, ai_reports,
audit_logs, cadence_configs, departments, leadership_relations, minutes,
notifications, one_on_ones, users, vobos, compliance_metrics (view)
```

Enums presentes (extracto pertinente):

- `non_realization_reason`: `["reagendada", "cancelada_cargas", "ausencia", "sin_justificacion"]`
  - **Falta** `'emergencia'` y `'vacaciones'` (migration 12).

## Tablas/columnas faltantes en `database.types.ts`

### Columnas faltantes en tablas existentes

| Tabla | Columnas faltantes | Migration | Casteada con `as never` en |
|---|---|---|---|
| `one_on_ones` | `non_realization_note` (text), `non_realization_marked_by` (uuid FK users), `non_realization_marked_at` (timestamptz) | 13 (`_session_justification_columns.sql`) | `src/lib/actions/one-on-ones.ts:234` (payload `updatePayload` cast) |
| `leadership_relations` | `transfer_banner_dismissed_at` (timestamptz) | 15 (`_transfer_banner_dismissal.sql`) | `src/lib/actions/one-on-ones.ts:309` |
| `agreements` | `ai_quality_score` (numeric(2,1)), `ai_quality_warnings` (text[]) | 16 (`_agreement_quality.sql`) | `src/lib/actions/agreements.ts:55`, `src/lib/actions/minutes.ts:142`, `src/app/(dashboard)/arquitectura-humana/reportes/page.tsx:53` y `:55` |
| `users` | `allow_share_warmth_comments` (boolean default false) | 17 (`_warmth_survey.sql`) | (no cast directo encontrado; consumido vía select y RLS) |

### Tablas nuevas faltantes

| Tabla | Migration | Usos en código (`as never`) |
|---|---|---|
| `meeting_warmth_responses` | 17 | `src/lib/actions/warmth.ts:49,52`; `src/lib/actions/vobos.ts:36,38,39`; `src/app/(dashboard)/colaborador/1to1/[id]/page.tsx:71,73,74` |
| `org_settings` | 18 | `src/lib/org-settings.ts:56,58,75,80` |
| `notification_rules` | 19 | `src/lib/actions/notification-rules.ts:45,54,82,90,109,110,126,145`; `src/app/api/cron/check-thresholds/route.ts:31,33`; `src/app/(dashboard)/arquitectura-humana/notificaciones/page.tsx:13` |
| `notification_dispatches` | 20 | `src/lib/actions/notification-rules.ts:158,165`; `src/lib/actions/scheduled-reports.ts:200,212`; `src/app/api/cron/check-thresholds/route.ts:135,142`; `src/app/api/cron/send-scheduled-reports/route.ts:114,126` |
| `scheduled_reports` | 21 | `src/lib/actions/scheduled-reports.ts:69,78,107,108,124,143,226,230`; `src/app/api/cron/send-scheduled-reports/route.ts:55,57,58,134,138`; `src/app/(dashboard)/arquitectura-humana/exportes/page.tsx:17` |

### Vistas nuevas faltantes

| Vista | Migration | Usos en código (`as never`) |
|---|---|---|
| `open_agreements_by_collaborator` | 14 (creada) + 16 (re-creada con `ai_quality_*`) | `src/app/(dashboard)/lider/colaborador/[id]/page.tsx:91,93,94`; `src/app/(dashboard)/arquitectura-humana/usuarios/[id]/page.tsx:100,102` |
| `warmth_metrics_by_leader` | 17 | `src/lib/exports/calidez-csv.ts:36,40`; `src/app/(dashboard)/lider/configuracion/page.tsx:38,40`; `src/app/(dashboard)/arquitectura-humana/mapa-calor/page.tsx:27,29` |
| `warmth_metrics_by_department` | 17 | `src/app/(dashboard)/arquitectura-humana/mapa-calor/page.tsx:54,56` |
| `warmth_trend_by_leader_month` | 17 | `src/app/(dashboard)/lider/configuracion/page.tsx:45,47,48` |

### Enums faltantes

| Enum | Cambio | Migration |
|---|---|---|
| `non_realization_reason` | `+ 'emergencia'`, `+ 'vacaciones'` | 12 (`_extend_non_realization_enum.sql`) |

### Migrations sin impacto en tipos generados

- **22** `notification_dispatches_hr_insert.sql` — sólo `CREATE POLICY`.
- **23** `leader_dismiss_banner_policy.sql` — sólo `CREATE POLICY`.

## Mapa `database.augmentation.ts` → migration de origen

Cada export del augmentation parchea un gap específico. Todo lo de abajo debería desaparecer al regenerar (asumiendo remote sincronizado):

| Export | Cubre | Migration |
|---|---|---|
| `NonRealizationReasonExtended` | Enum extendido | 12 |
| `OneOnOneJustificationExtension` | Columnas en `one_on_ones` | 13 |
| `AgreementQualityExtension` | Columnas en `agreements` | 16 |
| `LeadershipRelationsDismissalExtension` | Columna en `leadership_relations` | 15 |
| `UserWarmthOptIn` | Columna en `users` | 17 |
| `OpenAgreementByCollaborator` | Vista `open_agreements_by_collaborator` | 14 + 16 |
| `MeetingWarmthResponse` | Tabla `meeting_warmth_responses` | 17 |
| `WarmthMetricsByLeader`, `WarmthMetricsByDepartment`, `WarmthTrendByLeaderMonth` | Vistas warmth_* | 17 |
| `OrgSettingRow` | Tabla `org_settings` | 18 |
| `NotificationTriggerType`, `NotificationAudience`, `NotificationChannelExt`, `NotificationRuleRow` | Tabla `notification_rules` | 19 |
| `NotificationDispatchRow` | Tabla `notification_dispatches` | 20 |
| `ScheduledReportType`, `ScheduledReportRow` | Tabla `scheduled_reports` | 21 |

Comentario del propio archivo (líneas 7-13) confirma la causa: *"`pnpm db:types` regenerates `database.types.ts` against the REMOTE Supabase project. As of this commit the remote DB still lacks the Phase A migrations (they live only locally)..."* — por eso primero hay que asegurar que el remote tiene aplicadas las migrations 12-23.

## Listado completo de `as never` (63 ocurrencias)

> Las marcadas con `(comment)` son menciones en JSDoc, no casts.

```
src/lib/actions/notification-rules.ts:45        .from('notification_rules' as never)
src/lib/actions/notification-rules.ts:54        } as never)                          // insert payload
src/lib/actions/notification-rules.ts:82        .from('notification_rules' as never)
src/lib/actions/notification-rules.ts:90        } as never)                          // update payload
src/lib/actions/notification-rules.ts:109       .from('notification_rules' as never)
src/lib/actions/notification-rules.ts:110       .update({ enabled } as never)
src/lib/actions/notification-rules.ts:126       .from('notification_rules' as never)
src/lib/actions/notification-rules.ts:145       .from('notification_rules' as never)
src/lib/actions/notification-rules.ts:158       .from('notification_dispatches' as never)
src/lib/actions/notification-rules.ts:165       } as never)                          // insert dispatch
src/lib/actions/vobos.ts:36                     .from('meeting_warmth_responses' as never)
src/lib/actions/vobos.ts:38                     .eq('one_on_one_id' as never, ...)
src/lib/actions/vobos.ts:39                     .eq('collaborator_id' as never, ...)
src/lib/actions/departments.ts:23               .insert({ name, parent_id } as never)
src/lib/actions/departments.ts:54               .update({ name } as never)
src/lib/actions/scheduled-reports.ts:18         (comment) "as never en .from() y narrow..."
src/lib/actions/scheduled-reports.ts:69         .from('scheduled_reports' as never)
src/lib/actions/scheduled-reports.ts:78         } as never)
src/lib/actions/scheduled-reports.ts:107        .from('scheduled_reports' as never)
src/lib/actions/scheduled-reports.ts:108        .update({ enabled } as never)
src/lib/actions/scheduled-reports.ts:124        .from('scheduled_reports' as never)
src/lib/actions/scheduled-reports.ts:143        .from('scheduled_reports' as never)
src/lib/actions/scheduled-reports.ts:200        .from('notification_dispatches' as never)
src/lib/actions/scheduled-reports.ts:212        } as never)
src/lib/actions/scheduled-reports.ts:226        .from('scheduled_reports' as never)
src/lib/actions/scheduled-reports.ts:230        } as never)
src/app/(dashboard)/lider/colaborador/[id]/page.tsx:91   .from('open_agreements_by_collaborator' as never)
src/app/(dashboard)/lider/colaborador/[id]/page.tsx:93   .eq('collaborator_id' as never, params.id)
src/app/(dashboard)/lider/colaborador/[id]/page.tsx:94   .order('due_date' as never, ...)
src/app/api/cron/send-scheduled-reports/route.ts:15      (comment)
src/app/api/cron/send-scheduled-reports/route.ts:55      .from('scheduled_reports' as never)
src/app/api/cron/send-scheduled-reports/route.ts:57      .eq('enabled' as never, true)
src/app/api/cron/send-scheduled-reports/route.ts:58      .lte('next_run_at' as never, nowIso))
src/app/api/cron/send-scheduled-reports/route.ts:114     .from('notification_dispatches' as never)
src/app/api/cron/send-scheduled-reports/route.ts:126     } as never)
src/app/api/cron/send-scheduled-reports/route.ts:134     .from('scheduled_reports' as never)
src/app/api/cron/send-scheduled-reports/route.ts:138     } as never)
src/lib/exports/calidez-csv.ts:9                 (comment)
src/lib/exports/calidez-csv.ts:36                .from('warmth_metrics_by_leader' as never)
src/lib/exports/calidez-csv.ts:40                .order('avg_overall' as never, ...)
src/app/api/cron/check-thresholds/route.ts:16    (comment)
src/app/api/cron/check-thresholds/route.ts:31    .from('notification_rules' as never)
src/app/api/cron/check-thresholds/route.ts:33    .eq('enabled' as never, true)
src/app/api/cron/check-thresholds/route.ts:62    .from('compliance_metrics' as never)   // *** ver nota ***
src/app/api/cron/check-thresholds/route.ts:64    .lt('compliance_rate' as never, thresholdRate)
src/app/api/cron/check-thresholds/route.ts:135   .from('notification_dispatches' as never)
src/app/api/cron/check-thresholds/route.ts:142   } as never)
src/app/(dashboard)/arquitectura-humana/usuarios/[id]/page.tsx:100  .from('open_agreements_by_collaborator' as never)
src/app/(dashboard)/arquitectura-humana/usuarios/[id]/page.tsx:102  .eq('collaborator_id' as never, params.id)
src/lib/actions/cadence.ts:31                    .update({ frequency_days } as never)   // *** ver nota ***
src/lib/actions/cadence.ts:41                    } as never)                            // insert global
src/lib/actions/cadence.ts:77                    .update({ frequency_days } as never)   // *** ver nota ***
src/lib/actions/cadence.ts:88                    } as never)                            // insert department
src/lib/actions/minutes.ts:142                   }) as never                            // enrichedRows con ai_quality_*
src/app/(dashboard)/lider/configuracion/page.tsx:38   .from('warmth_metrics_by_leader' as never)
src/app/(dashboard)/lider/configuracion/page.tsx:40   .eq('leader_id' as never, user.id)
src/app/(dashboard)/lider/configuracion/page.tsx:45   .from('warmth_trend_by_leader_month' as never)
src/app/(dashboard)/lider/configuracion/page.tsx:47   .eq('leader_id' as never, user.id)
src/app/(dashboard)/lider/configuracion/page.tsx:48   .order('month' as never, ...)
src/lib/org-settings.ts:56                       .from('org_settings' as never)
src/lib/org-settings.ts:58                       .eq('key' as never, key)
src/lib/org-settings.ts:75                       .from('org_settings' as never).upsert({
src/lib/org-settings.ts:80                       } as never)
src/lib/actions/warmth.ts:49                     } as never                            // insert payload meeting_warmth_responses
src/lib/actions/warmth.ts:52                     .from('meeting_warmth_responses' as never)
src/lib/actions/agreements.ts:55                 } as never                            // insert con ai_quality_*
src/app/(dashboard)/arquitectura-humana/exportes/page.tsx:17  .from('scheduled_reports' as never)
src/lib/actions/one-on-ones.ts:161               (comment)
src/lib/actions/one-on-ones.ts:234               } as never                            // markNonRealization payload
src/lib/actions/one-on-ones.ts:289               (comment)
src/lib/actions/one-on-ones.ts:309               { transfer_banner_dismissed_at } as never
src/app/(dashboard)/arquitectura-humana/reportes/page.tsx:41   (comment)
src/app/(dashboard)/arquitectura-humana/reportes/page.tsx:53   .lt('ai_quality_score' as never, ...)
src/app/(dashboard)/arquitectura-humana/reportes/page.tsx:55   .order('ai_quality_score' as never, ...)
src/app/(dashboard)/arquitectura-humana/mapa-calor/page.tsx:27   .from('warmth_metrics_by_leader' as never)
src/app/(dashboard)/arquitectura-humana/mapa-calor/page.tsx:29   .order('avg_overall' as never, ...)
src/app/(dashboard)/arquitectura-humana/mapa-calor/page.tsx:54   .from('warmth_metrics_by_department' as never)
src/app/(dashboard)/arquitectura-humana/mapa-calor/page.tsx:56   .order('avg_overall' as never, ...)
src/app/(dashboard)/arquitectura-humana/notificaciones/page.tsx:13  .from('notification_rules' as never)
src/app/(dashboard)/colaborador/1to1/[id]/page.tsx:71   .from('meeting_warmth_responses' as never)
src/app/(dashboard)/colaborador/1to1/[id]/page.tsx:73   .eq('one_on_one_id' as never, params.id)
src/app/(dashboard)/colaborador/1to1/[id]/page.tsx:74   .eq('collaborator_id' as never, user.id)
```

### Notas sobre falsos positivos / casos no triviales

- **`cadence.ts:31,41,77,88`** — `cadence_configs` **sí** está en `database.types.ts` (línea 327). El cast `as never` aquí **no** es por staleness; parece patrón defensivo (probablemente para circunvenir un quirk del typing genérico de Supabase con `.update()` cuando la tabla incluye columnas generadas/jsonb). Revisar tras regenerar: posiblemente se pueda eliminar sin esperar nuevo schema.
- **`departments.ts:23,54`** — idem `departments` está en types (línea 365). Mismo análisis.
- **`check-thresholds/route.ts:62-64`** — `compliance_metrics` **sí** está en types (es la única view en el archivo actual, línea 715). El cast podría ser defensivo. Validar tras regenerar.

Esos 8 casts (≈ 12% del total) probablemente no se resuelven con regeneración: requieren análisis caso a caso.

## Plan de regeneración (NO automatizado)

### Pre-requisitos a verificar antes

1. **Remote tiene migrations aplicadas** — chequear sync:
   ```bash
   pnpm supabase migration list --linked
   ```
   Las 23 migrations locales deben aparecer como `applied` en remote. Si alguna de 12-23 está sólo local, regenerar AHORA produciría types más viejos que el código.

2. **Backup del archivo actual** (por si hay que rollback):
   ```bash
   cp src/types/database.types.ts src/types/database.types.ts.bak
   ```

### Comando a correr (requiere consent explícito del user)

```bash
pnpm db:types
```

Internamente ejecuta:
```bash
supabase gen types typescript --linked > src/types/database.types.ts
```

`SUPABASE_PROJECT_REF` ya está presente en `.env.local`; `--linked` resuelve el ref via `supabase/.temp/project-ref` que se popula con `supabase link`. Si el link no está, va a fallar pidiendo `supabase login` + `supabase link --project-ref <ref>`.

### Post-regeneración

1. `git diff src/types/database.types.ts.bak src/types/database.types.ts | less` para ver el delta.
2. Confirmar que las 4 tablas nuevas (`meeting_warmth_responses`, `org_settings`, `notification_rules`, `notification_dispatches`, `scheduled_reports`) aparecen y las 4 views (`open_agreements_by_collaborator`, `warmth_metrics_by_leader`, `warmth_metrics_by_department`, `warmth_trend_by_leader_month`) también.
3. Confirmar enum `non_realization_reason` ahora incluye `emergencia` y `vacaciones`.
4. Confirmar columnas nuevas en `one_on_ones`, `leadership_relations`, `agreements`, `users`.
5. **Eliminar `src/types/database.augmentation.ts`** si todo lo augmentado está cubierto. Buscar imports a ese archivo y reemplazarlos por refs a `Database['public']['Tables'][...]['Row']` u análogos.
6. **Refactor incremental de `as never`**:
   - Empezar por los casts triviales (`.from('table_name' as never)` → `.from('table_name')`).
   - Después payloads (`{ ... } as never` → `Database['public']['Tables']['x']['Insert']`).
   - Validar continuamente con `pnpm tsc -b` (no `--noEmit`; CI corre `-b`).
7. Para los 8 casts en `cadence.ts`/`departments.ts`/`check-thresholds.ts:62-64` (tablas ya presentes en types) — inspeccionar individual: probablemente quitables.

## Riesgos

- **Remote out-of-sync**: si migrations 12-23 no están en remote, regenerar produce types más obsoletos que el código local — `as never` se vuelve permanente. Validar `migration list --linked` PRIMERO.
- **Pérdida de augmentations no cubiertas**: si algún tipo en `database.augmentation.ts` describe algo que NO se genera (p.ej. un cómputo derivado o un tipo nominal), borrar el archivo rompería los usos. Revisar imports antes de eliminar:
  ```bash
  grep -rn "from '@/types/database.augmentation'" src/
  grep -rn "from '../types/database.augmentation'" src/
  ```
- **Casts no relacionados a staleness** (≈ 8 ocurrencias en `cadence.ts`, `departments.ts`, `check-thresholds.ts:62-64`): no se resolverán con la regeneración. Necesitan inspección puntual del error real de TS.
- **PostgrestVersion drift**: el archivo declara `PostgrestVersion: "14.5"`. Si el remote subió, la regeneración cambia ese valor — verificar que `@supabase/supabase-js` lo soporta.
- **CI**: `pnpm tsc -b` en CI es estricto; cada `as never` removido debe validarse antes de mergear. Hacer la limpieza en commits pequeños por tabla.
