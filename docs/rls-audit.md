# RLS Audit

> Generado: 2026-06-10  
> Auditor: análisis estático de `src/lib/actions/*.ts` vs `supabase/migrations/*.sql`  
> Metodología: cada INSERT/UPDATE/DELETE en cada action fue cruzado con la lista completa de policies RLS. Se documentó qué cliente se usa (anon autenticado vs `createAdminClient()` que bypasea RLS con service_role), el rol requerido por la app, y si existe la policy correspondiente.

---

## Policies faltantes (CRÍTICO)

| Tabla | Operación | Rol | Archivo action | Notas |
|---|---|---|---|---|
| `audit_logs` | INSERT | colaborador, líder, hr (cualquier auth) | `agreements.ts`, `disputes.ts`, `one-on-ones.ts`, `warmth.ts` | **No existe ninguna policy INSERT en `audit_logs`.** RLS está habilitado (migration 02), solo hay `audit_select_hr` para SELECT. Todo INSERT desde usuario autenticado (client anon) es bloqueado silenciosamente. Las actions insertan best-effort pero el INSERT falla en silencio para todos los roles. |
| `notification_dispatches` | INSERT | hr | `notification-rules.ts:157` (`testFireRule`) y `scheduled-reports.ts:189` (`runReportNow`) | `notification_dispatches_hr_insert` (migration 22) cubre INSERT para hr en `testFireRule`. **Pero `runReportNow` (scheduled-reports.ts) también llama `guard.supabase.from('notification_dispatches').insert(...)` — usa `requireHR()` con el client autenticado, así que la policy de migration 22 aplica. OK para HR.** La duda real es: el worker cron (`src/lib/cron/scheduled-reports.ts`) usa `createClient()` server, no admin — ver sección de tablas sin policy de INSERT para service_role.  |
| `ai_reports` | INSERT | service_role / cron | No en actions/, sino en cron y posiblemente AI pipeline | **No existe policy INSERT en `ai_reports`.** Migration 02 solo tiene `reports_select_hr` y `reports_update_hr`. Si algún proceso inserta reports usando el client autenticado (no admin), fallará. |

---

## Gaps de cobertura: operaciones que dependen solo de validación app-side sin filtro RLS en la query

Estas operaciones tienen la policy RLS correcta **en la tabla**, pero la query en la action no incluye el filtro necesario para activarla. Resultado: si la app-side check falla o es eludida, RLS rechaza silenciosamente (0 rows afectadas, `success: true` engañoso).

| Tabla | Operación | Rol | Archivo action:línea | Policy disponible | Situación |
|---|---|---|---|---|---|
| `one_on_ones` | UPDATE (markNonRealization) | participante o hr | `one-on-ones.ts:236` | `oneonones_update_participants_or_hr` | Query solo tiene `.eq('id', oneOnOneId)`. App-side valida participante/hr (líneas 212-219). RLS actúa como defensa en profundidad pero el filtro de participant en la query está ausente — en caso de bug app-side, el UPDATE falla silenciosamente en lugar de retornar error explícito. **Severidad: MEDIA** |
| `agreements` | UPDATE (updateAgreementStatus) | participante o hr | `agreements.ts:114-117` | `agreements_update_participants_or_hr` | Query solo `.eq('id', agreementId)`. App-side pre-fetcha one_on_one_id y valida is_participant (líneas 86-111). RLS bloquea si app-side falla. **Severidad: MEDIA** (defensa app existe) |
| `agreements` | DELETE (deleteAgreement) | participante | `agreements.ts:163-165` | `agreements_delete_participants` | Query solo `.eq('id', agreementId)`. App-side pre-fetcha y valida is_participant (líneas 145-160). **Severidad: MEDIA** |
| `agreements` | UPDATE (reportAgreementFollowup) | participante | `agreements.ts:238-241` | `agreements_update_participants_or_hr` | Query solo `.eq('id', agreementId)`. App-side pre-fetcha y valida is_participant (líneas 207-223). **Severidad: MEDIA** |

**Observación importante**: las tres operaciones en `agreements` sí realizan pre-fetch explícito y validación app-side antes del UPDATE/DELETE. El riesgo real es TOCTOU (time-of-check vs time-of-use) y que un future refactor rompa la validación sin detectarlo. No son vulnerabilidades activas hoy, pero son fragilidades arquitectónicas.

---

## Policies existentes confirmadas

| Tabla | Operación | Policy name | Migration |
|---|---|---|---|
| `departments` | SELECT | `departments_select_authenticated` | 02 |
| `departments` | INSERT/UPDATE/DELETE | `departments_all_hr` | 02 |
| `users` | SELECT | `users_select_authenticated` | 02 |
| `users` | UPDATE (self) | `users_update_self` | 02 |
| `users` | ALL (hr) | `users_all_hr` | 02 |
| `leadership_relations` | SELECT | `relations_select_involved_or_hr` | 02 |
| `leadership_relations` | ALL (hr) | `relations_all_hr` | 02 |
| `leadership_relations` | UPDATE (self leader) | `relations_update_self_leader` | 23 |
| `cadence_configs` | SELECT | `cadence_select_authenticated` | 02 |
| `cadence_configs` | ALL (hr) | `cadence_all_hr` | 02 |
| `one_on_ones` | SELECT | `oneonones_select_participants_or_hr` | 02 |
| `one_on_ones` | INSERT | `oneonones_insert_participants` | 02 |
| `one_on_ones` | UPDATE | `oneonones_update_participants_or_hr` | 02 |
| `one_on_ones` | DELETE | `oneonones_delete_hr` | 02 |
| `agenda_items` | SELECT | `agenda_select_participants` | 02 |
| `agenda_items` | INSERT | `agenda_insert_participants` | 02 |
| `agenda_items` | UPDATE | `agenda_update_author` | 02 |
| `agenda_items` | DELETE | `agenda_delete_author` | 02 |
| `minutes` | SELECT | `minutes_select_participants` | 02 |
| `minutes` | INSERT | `minutes_insert_participants` | 02 |
| `minutes` | UPDATE | `minutes_update_participants` (reemplazó `minutes_update_author`) | 03 |
| `agreements` | SELECT | `agreements_select_participants_or_hr` | 02 |
| `agreements` | INSERT | `agreements_insert_participants` | 02 |
| `agreements` | UPDATE | `agreements_update_participants_or_hr` | 02 |
| `agreements` | DELETE | `agreements_delete_participants` | 02 / 06 |
| `agreement_followups` | SELECT | `followups_select_involved_or_hr` | 02 |
| `agreement_followups` | INSERT | `followups_insert_involved` | 02 |
| `vobos` | SELECT | `vobos_select_participants_or_hr` | 02 |
| `vobos` | INSERT | `vobos_insert_self` | 02 |
| `vobos` | UPDATE | `vobos_update_self` | 02 |
| `ai_insights` | SELECT | `insights_select_leader` | 02 |
| `ai_insights` | UPDATE | `insights_update_leader` | 02 |
| `ai_reports` | SELECT | `reports_select_hr` | 02 |
| `ai_reports` | UPDATE | `reports_update_hr` | 02 |
| `notifications` | SELECT | `notifications_select_self` | 02 |
| `notifications` | UPDATE | `notifications_update_self` | 02 |
| `audit_logs` | SELECT | `audit_select_hr` | 02 |
| `org_settings` | ALL (hr) | `org_settings_hr_all` | 18 |
| `org_settings` | SELECT | `org_settings_authenticated_read` | 18 |
| `notification_rules` | ALL (hr) | `notification_rules_hr_all` | 19 |
| `notification_dispatches` | SELECT (hr) | `dispatches_hr_all` | 20 |
| `notification_dispatches` | SELECT (self) | `dispatches_recipient_select_own` | 20 |
| `notification_dispatches` | INSERT (hr) | `notification_dispatches_hr_insert` | 22 |
| `scheduled_reports` | ALL (hr) | `scheduled_reports_hr_all` | 21 |
| `meeting_warmth_responses` | INSERT | `warmth_collaborator_insert` | 17 |
| `meeting_warmth_responses` | SELECT (self) | `warmth_collaborator_select_own` | 17 |
| `meeting_warmth_responses` | SELECT (hr) | `warmth_hr_select_all` | 17 |
| `notification_preferences` | SELECT | `notification_preferences_select_own` | 25 |
| `notification_preferences` | INSERT | `notification_preferences_insert_own` | 25 |
| `notification_preferences` | UPDATE | `notification_preferences_update_own` | 25 |
| `notification_preferences` | DELETE | `notification_preferences_delete_own` | 25 |

---

## Tablas sin RLS (riesgo)

Todas las tablas del schema tienen RLS habilitado. Sin embargo, hay operaciones **sin policy de escritura** aunque RLS esté activo:

| Tabla | RLS activo | Policy INSERT faltante | Policy UPDATE faltante | Policy DELETE faltante | Impacto |
|---|---|---|---|---|---|
| `audit_logs` | Sí (migration 02) | **SI — CRÍTICO** | No aplica (no existe UPDATE en actions) | No aplica | Todo INSERT desde usuario autenticado (no admin) es bloqueado silenciosamente. Las actions de agreements, disputes, one-on-ones y warmth insertan audit_logs como best-effort con `createClient()` (anon auth) — **todos fallan en silencio**. Solo los que usan `createAdminClient()` (users.ts) funcionan. |
| `ai_reports` | Sí (migration 02) | **SI — ALTO** | Existe (`reports_update_hr`) | No existe (sin action de delete) | Si algún proceso crea reports via client autenticado (no admin), falla. La action `markReportReviewed` solo hace UPDATE, que sí tiene policy. |
| `notifications` | Sí (migration 02) | **SI — ALTO** | Existe (`notifications_update_self`) | No existe | No hay action de INSERT en `src/lib/actions/`. Las notificaciones se crean desde cron/workers. Si se usa client anon para insertar, falla. Cron worker debe usar admin client. |
| `ai_insights` | Sí (migration 02) | **SI — MEDIO** | Parcial (`insights_update_leader`) | No existe | No hay action de INSERT en `src/lib/actions/`. Las insights se crean desde el AI pipeline. Mismo riesgo que notifications. |
| `agreement_followups` | Sí (migration 02) | Existe (`followups_insert_involved`) | **SI — ALTO** | No existe | No existe policy de UPDATE ni DELETE para `agreement_followups`. Si se agrega una action de editar/borrar followup, fallará en silencio. |

---

## Detalle de operaciones por archivo action

### `agreements.ts`

| Función | Tabla | Operación | Cliente | Rol requerido (app) | Policy aplicable | Estado |
|---|---|---|---|---|---|---|
| `createAgreement` | `agreements` | INSERT | `createClient()` | auth (cualquier) — la 1:1 valida líder/colab | `agreements_insert_participants` | OK |
| `updateAgreementStatus` | `agreements` | UPDATE | `createClient()` | participante o hr (validado app-side) | `agreements_update_participants_or_hr` | OK (con advertencia de app-side only) |
| `deleteAgreement` | `agreements` | DELETE | `createClient()` | participante (validado app-side) | `agreements_delete_participants` | OK (con advertencia) |
| `deleteAgreement` | `audit_logs` | INSERT | `createClient()` | participante | **ninguna** | **FALLA SILENCIOSAMENTE** |
| `reportAgreementFollowup` | `agreement_followups` | INSERT | `createClient()` | participante (validado app-side) | `followups_insert_involved` | OK |
| `reportAgreementFollowup` | `agreements` | UPDATE status | `createClient()` | participante (validado app-side) | `agreements_update_participants_or_hr` | OK (con advertencia) |

### `cadence.ts`

| Función | Tabla | Operación | Cliente | Rol requerido (app) | Policy aplicable | Estado |
|---|---|---|---|---|---|---|
| `upsertGlobalCadence` | `cadence_configs` | INSERT o UPDATE | `createClient()` | hr (`requireHR()`) | `cadence_all_hr` | OK |
| `upsertDepartmentCadence` | `cadence_configs` | INSERT o UPDATE | `createClient()` | hr (`requireHR()`) | `cadence_all_hr` | OK |
| `removeDepartmentCadence` | `cadence_configs` | DELETE | `createClient()` | hr (`requireHR()`) | `cadence_all_hr` | OK |

### `departments.ts`

| Función | Tabla | Operación | Cliente | Rol requerido (app) | Policy aplicable | Estado |
|---|---|---|---|---|---|---|
| `createDepartment` | `departments` | INSERT | `createClient()` | hr (`requireHR()`) | `departments_all_hr` | OK |
| `renameDepartment` | `departments` | UPDATE | `createClient()` | hr (`requireHR()`) | `departments_all_hr` | OK |
| `deleteDepartment` | `departments` | DELETE | `createClient()` | hr (`requireHR()`) | `departments_all_hr` | OK |

### `disputes.ts`

| Función | Tabla | Operación | Cliente | Rol requerido (app) | Policy aplicable | Estado |
|---|---|---|---|---|---|---|
| `resolveDispute` | `one_on_ones` | UPDATE | `createClient()` | hr (validado app-side) | `oneonones_update_participants_or_hr` | OK |
| `resolveDispute` | `audit_logs` | INSERT | `createClient()` | hr | **ninguna** | **FALLA SILENCIOSAMENTE** |

### `minutes.ts`

| Función | Tabla | Operación | Cliente | Rol requerido (app) | Policy aplicable | Estado |
|---|---|---|---|---|---|---|
| `saveMinute` | `minutes` | UPSERT (INSERT+UPDATE) | `createClient()` | participante (auth implícito) | `minutes_insert_participants` + `minutes_update_participants` | OK |
| `saveMinute` (idempotencia IA) | `agreements` | DELETE (ai_generated=true, pendiente) | `createClient()` | participante (implícito: solo llega aquí si upsert de minuta fue exitoso) | `agreements_delete_participants` | OK — la check de participante es transitiva |
| `saveMinute` (extracción IA) | `agreements` | INSERT | `createClient()` | participante (mismo razonamiento) | `agreements_insert_participants` | OK |

### `notification-preferences.ts`

| Función | Tabla | Operación | Cliente | Rol requerido (app) | Policy aplicable | Estado |
|---|---|---|---|---|---|---|
| `setPreference` | `notification_preferences` | UPSERT (INSERT+UPDATE) | `createClient()` | self (user.id forzado en payload) | `notification_preferences_insert_own` + `notification_preferences_update_own` | OK |

### `notification-rules.ts`

| Función | Tabla | Operación | Cliente | Rol requerido (app) | Policy aplicable | Estado |
|---|---|---|---|---|---|---|
| `createNotificationRule` | `notification_rules` | INSERT | `createClient()` | hr (`requireHR()`) | `notification_rules_hr_all` | OK |
| `updateNotificationRule` | `notification_rules` | UPDATE | `createClient()` | hr (`requireHR()`) | `notification_rules_hr_all` | OK |
| `toggleNotificationRule` | `notification_rules` | UPDATE | `createClient()` | hr (`requireHR()`) | `notification_rules_hr_all` | OK |
| `deleteNotificationRule` | `notification_rules` | DELETE | `createClient()` | hr (`requireHR()`) | `notification_rules_hr_all` | OK |
| `testFireRule` | `notification_dispatches` | INSERT | `createClient()` | hr (`requireHR()`) | `notification_dispatches_hr_insert` | OK |

### `one-on-ones.ts`

| Función | Tabla | Operación | Cliente | Rol requerido (app) | Policy aplicable | Estado |
|---|---|---|---|---|---|---|
| `scheduleOneOnOne` | `one_on_ones` | INSERT | `createClient()` | líder o hr (validado app-side línea 40) | `oneonones_insert_participants` | OK |
| `scheduleOneOnOne` (calendar) | `one_on_ones` | UPDATE (google_calendar_event_id, meet_link) | `createClient()` | líder (llamante) | `oneonones_update_participants_or_hr` | OK |
| `cancelOneOnOne` | `one_on_ones` | UPDATE (status, non_realization_reason) | `createClient()` | participante (filter `.or()` en query línea 141) | `oneonones_update_participants_or_hr` | OK — query tiene filtro `.or(leader_id.eq...,collaborator_id.eq...)` |
| `markNonRealization` | `one_on_ones` | UPDATE | `createClient()` | participante o hr (validado app-side líneas 212-219) | `oneonones_update_participants_or_hr` | OK con advertencia: query sin filtro participante, solo app-side |
| `markNonRealization` | `audit_logs` | INSERT | `createClient()` | participante o hr | **ninguna** | **FALLA SILENCIOSAMENTE** |
| `dismissTransferBanner` | `leadership_relations` | UPDATE (transfer_banner_dismissed_at) | `createClient()` | líder (filter `.eq('leader_id', user.id)` en query línea 307) | `relations_update_self_leader` | OK — query tiene filtro explícito |

### `org-settings.ts`

| Función | Tabla | Operación | Cliente | Rol requerido (app) | Policy aplicable | Estado |
|---|---|---|---|---|---|---|
| `saveOrgSetting` → `setOrgSetting` | `org_settings` | UPSERT | `createClient()` | hr (`requireHR()`) | `org_settings_hr_all` | OK |

### `reports.ts`

| Función | Tabla | Operación | Cliente | Rol requerido (app) | Policy aplicable | Estado |
|---|---|---|---|---|---|---|
| `markReportReviewed` | `ai_reports` | UPDATE (reviewed, reviewed_by, reviewed_at) | `createClient()` | hr (validado app-side líneas 19-24) | `reports_update_hr` | OK |

### `scheduled-reports.ts`

| Función | Tabla | Operación | Cliente | Rol requerido (app) | Policy aplicable | Estado |
|---|---|---|---|---|---|---|
| `createScheduledReport` | `scheduled_reports` | INSERT | `createClient()` | hr (`requireHR()`) | `scheduled_reports_hr_all` | OK |
| `toggleScheduledReport` | `scheduled_reports` | UPDATE | `createClient()` | hr (`requireHR()`) | `scheduled_reports_hr_all` | OK |
| `deleteScheduledReport` | `scheduled_reports` | DELETE | `createClient()` | hr (`requireHR()`) | `scheduled_reports_hr_all` | OK |
| `runReportNow` | `notification_dispatches` | INSERT | `createClient()` | hr (`requireHR()`) | `notification_dispatches_hr_insert` | OK |
| `runReportNow` | `scheduled_reports` | UPDATE (last_run_at, next_run_at) | `createClient()` | hr (`requireHR()`) | `scheduled_reports_hr_all` | OK |

### `users.ts`

| Función | Tabla | Operación | Cliente | Rol requerido (app) | Policy aplicable | Estado |
|---|---|---|---|---|---|---|
| `updateUserRole` | `users` | UPDATE | `createAdminClient()` | hr (validado en requireHr() local) | **bypasea RLS (service_role)** | OK — intencional |
| `updateUserRole` | `audit_logs` | INSERT | `createAdminClient()` | hr | **bypasea RLS (service_role)** | OK — intencional |
| `updateUserActive` | `users` | UPDATE | `createAdminClient()` | hr | **bypasea RLS (service_role)** | OK — intencional |
| `updateUserActive` | `audit_logs` | INSERT | `createAdminClient()` | hr | **bypasea RLS (service_role)** | OK — intencional |
| `assignLeader` | `leadership_relations` | UPDATE (ended_at) | `createAdminClient()` | hr | **bypasea RLS (service_role)** | OK — intencional |
| `assignLeader` | `leadership_relations` | INSERT | `createAdminClient()` | hr | **bypasea RLS (service_role)** | OK — intencional |
| `assignLeader` | `audit_logs` | INSERT | `createAdminClient()` | hr | **bypasea RLS (service_role)** | OK — intencional |

### `vobos.ts`

| Función | Tabla | Operación | Cliente | Rol requerido (app) | Policy aplicable | Estado |
|---|---|---|---|---|---|---|
| `submitVobo` | `vobos` | UPSERT (INSERT+UPDATE) | `createClient()` | participante (verificado en líneas 26-31) | `vobos_insert_self` + `vobos_update_self` | OK |

### `warmth.ts`

| Función | Tabla | Operación | Cliente | Rol requerido (app) | Policy aplicable | Estado |
|---|---|---|---|---|---|---|
| `submitWarmthResponse` | `meeting_warmth_responses` | INSERT | `createClient()` | colaborador (verificado líneas 29-37) | `warmth_collaborator_insert` | OK |
| `submitWarmthResponse` | `audit_logs` | INSERT | `createClient()` | colaborador | **ninguna** | **FALLA SILENCIOSAMENTE** |

### `exports.ts`

No contiene operaciones de escritura (solo SELECT a través de helpers CSV). Sin gaps.

---

## Resumen de migrations de seguridad necesarias

### Crítico — crear ahora

#### M1: Policy INSERT para `audit_logs`

```sql
-- Cualquier usuario autenticado puede insertar su propio log de auditoría.
-- Sin esta policy, todos los INSERT desde createClient() fallan silenciosamente.
create policy "audit_logs_insert_authenticated"
  on public.audit_logs
  for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);
```

**Contexto**: El trigger de vobo_invalidation (migration 06) también inserta en `audit_logs` con `user_id = null`. La condición `user_id is null` cubre ese caso. Los inserts desde `createAdminClient()` ya funcionan (bypasan RLS).

#### M2: Policy INSERT para `ai_reports`

```sql
-- Solo HR puede insertar reportes de IA.
-- Actualmente no existe policy INSERT; la tabla tiene RLS activo → bloqueo silencioso.
create policy "ai_reports_insert_hr"
  on public.ai_reports
  for insert
  to authenticated
  with check (public.is_hr());
```

**Contexto**: La action `markReportReviewed` solo hace UPDATE (ya tiene policy). Pero el pipeline que genera reports necesita INSERT. Si usa admin client en producción, este gap no afecta hoy; si algún server action o route handler lo crea con client autenticado, falla.

#### M3: Policy INSERT para `notifications`

```sql
-- El sistema (cron, workers, server actions) puede insertar notificaciones.
-- Si los workers usan admin client, no es necesario. Si usan createClient(), sí.
-- Usar service_role para workers es la recomendación. Documentar el contrato aquí.
-- Por seguridad, agregar policy para que HR pueda insertar en nombre del sistema:
create policy "notifications_insert_service"
  on public.notifications
  for insert
  to authenticated
  with check (
    -- El user_id del notification debe ser un usuario válido.
    -- HR puede insertar notificaciones para cualquier usuario (batch).
    public.is_hr()
    -- o el sistema puede insertar para el propio usuario (self-notification):
    or user_id = auth.uid()
  );
```

**Alternativa segura**: Asegurar que todos los workers que crean notificaciones usen `createAdminClient()`. Si eso se garantiza, esta migration no es necesaria pero es buena práctica tenerla para pruebas manuales.

### Alto — planificar próximo sprint

#### M4: Policy UPDATE/DELETE para `agreement_followups`

```sql
-- Actualmente solo existe INSERT (followups_insert_involved) y SELECT.
-- Si se agrega edición/borrado de followups en el futuro, sin estas policies fallará.
create policy "followups_update_involved"
  on public.agreement_followups
  for update
  using (
    reported_by_id = auth.uid()
    or exists (
      select 1 from public.agreements a
      where a.id = agreement_id and public.is_participant(a.one_on_one_id)
    )
    or public.is_hr()
  );

create policy "followups_delete_involved_or_hr"
  on public.agreement_followups
  for delete
  using (
    reported_by_id = auth.uid()
    or public.is_hr()
  );
```

#### M5: Hardening — agregar filtros de participante en queries de `agreements`

No requiere nueva migration SQL, pero las siguientes actions deben añadir el filtro en la query para que RLS tenga un predicado activo en lugar de depender solo del app-side check:

- `updateAgreementStatus` (`agreements.ts:114`): ya hace pre-fetch + validación app-side, pero añadir inner join o filtro en la query UPDATE para refuerzo.
- `deleteAgreement` (`agreements.ts:163`): igual.
- `reportAgreementFollowup` UPDATE (`agreements.ts:238`): igual.

**Nota**: las tres funciones ya tienen validación app-side robusta (pre-fetch + isParticipant check). El riesgo es bajo pero la defensa es débil en profundidad. La migration más útil aquí es M1 (audit_logs), no código de agreements.

---

## Tablas con RLS habilitado pero sin ninguna policy de escritura autenticada

| Tabla | Políticas de escritura existentes | Escenario de riesgo |
|---|---|---|
| `audit_logs` | Ninguna (solo `audit_select_hr` para SELECT) | Todos los INSERT desde `createClient()` fallan silenciosamente. **Requiere M1.** |
| `ai_reports` | Solo `reports_update_hr` y `reports_select_hr` | INSERT bloqueado para usuarios autenticados. **Requiere M2.** |
| `notifications` | Solo `notifications_select_self` y `notifications_update_self` | INSERT bloqueado. Workers deben usar admin client. **Requiere M3 o contrato admin-client documentado.** |
| `ai_insights` | Solo `insights_select_leader` y `insights_update_leader` | INSERT y DELETE bloqueados. El AI pipeline debe usar admin client. |

---

## Notas sobre bypass legítimo con `createAdminClient()`

Las siguientes operaciones usan el cliente service_role intencionalmente para evadir RLS. Son correctas y no requieren policies adicionales:

- `users.ts`: `updateUserRole`, `updateUserActive`, `assignLeader` — todas las escrituras a `users`, `leadership_relations`, `audit_logs` usan admin client.
- `src/lib/supabase/admin.ts`: el client se construye con `SUPABASE_SERVICE_ROLE_KEY`, sin persistencia de sesión, solo en server-side.

**Riesgo**: si `SUPABASE_SERVICE_ROLE_KEY` se expone (client-side bundle, logs, etc.), bypasea toda la RLS. Verificar que `admin.ts` no sea importado en código client.
