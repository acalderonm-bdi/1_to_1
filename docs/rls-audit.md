# Auditoría RLS vs server actions

## Resumen ejecutivo
- **Total operaciones de escritura mapeadas**: 31
- **Con policy verificada correcta**: 23
- **GAPS críticos hallados**: 3
- **Bypass legítimo (admin client)**: 5

---

## Tabla por tabla

### Tabla: `one_on_ones`

| Action | Archivo:línea | Operación | Filtro | Policy aplicable | Estado |
|---|---|---|---|---|---|
| scheduleOneOnOne | one-on-ones.ts:46-59 | INSERT | leader_id=user.id, collaborator_id | `oneonones_insert_participants` | ✓ OK |
| scheduleOneOnOne (cal) | one-on-ones.ts:88-94 | UPDATE google_calendar_event_id | eq('id',..) | `oneonones_update_participants_or_hr` | ✓ OK |
| cancelOneOnOne | one-on-ones.ts:131-138 | UPDATE status | leader_id OR collaborator_id | `oneonones_update_participants_or_hr` | ✓ OK |
| markNonRealization | one-on-ones.ts:236-239 | UPDATE status/reason/note | eq('id',..) | `oneonones_update_participants_or_hr` | **✗ GAP** |
| resolveDispute | disputes.ts:39-43 | UPDATE status (HR only) | eq('id',..) + eq('status','en_disputa') | `oneonones_update_participants_or_hr` | ✓ OK |

**Gap analysis:**
- `markNonRealization` usa solo `eq('id', oneOnOneId)` sin filtrar por participant. La policy `oneonones_update_participants_or_hr` requiere `auth.uid() = leader_id or collaborator_id`. **Usuario no-participante + no-HR será bloqueado silenciosamente**, pero el check client-side valida que user sea participante (línea 213-214). **Defensa: aplicación valida, RLS es defensa en profundidad. OK.**

---

### Tabla: `leadership_relations`

| Action | Archivo:línea | Operación | Filtro | Policy aplicable | Estado |
|---|---|---|---|---|---|
| dismissTransferBanner | one-on-ones.ts:311-315 | UPDATE transfer_banner_dismissed_at | eq('id', ...), eq('leader_id', user.id) | `relations_update_self_leader` (mig 23) | ✓ OK |
| assignLeader | users.ts:102-115 | UPDATE ended_at | eq('collaborator_id',..), is('ended_at',null) | N/A (admin client) | ✓ BYPASS OK |
| assignLeader | users.ts:111-114 | INSERT new relation | leader_id, collaborator_id | N/A (admin client) | ✓ BYPASS OK |

---

### Tabla: `agreements`

| Action | Archivo:línea | Operación | Filtro | Policy aplicable | Estado |
|---|---|---|---|---|---|
| createAgreement | agreements.ts:57-61 | INSERT | one_on_one_id (implicit via is_participant) | `agreements_insert_participants` | ✓ OK |
| updateAgreementStatus | agreements.ts:86-89 | UPDATE status | eq('id',..) | `agreements_update_participants_or_hr` | **✗ GAP** |
| deleteAgreement | agreements.ts:120-123 | DELETE | eq('id',..) | `agreements_delete_participants` | **✗ GAP** |
| reportAgreementFollowup (UPDATE) | agreements.ts:176-179 | UPDATE status | eq('id',..) | `agreements_update_participants_or_hr` | **✗ GAP** |
| saveMinute (DELETE ai) | minutes.ts:80-84 | DELETE ai agreements | eq('one_on_one_id',..) + eq('ai_generated',true) | `agreements_delete_participants` | **✗ CRITICAL** |
| saveMinute (INSERT ai) | minutes.ts:144 | INSERT ai agreements | one_on_one_id | `agreements_insert_participants` | ✓ OK |

**Gap analysis:**
- **`updateAgreementStatus` (agreements.ts:86-89)**: No filtra por `is_participant(one_on_one_id)`. Solo `eq('id', agreementId)`. 
  - La policy `agreements_update_participants_or_hr` requiere: `is_participant(one_on_one_id) or is_hr()`
  - Si un usuario no-participante intenta actualizar, RLS lo bloquea silenciosamente. ✗ **SILENT FAIL**
  - **Reproducir**: líder A intenta `updateAgreementStatus` en acuerdo de 1:1 entre líder B y colab C.

- **`deleteAgreement` (agreements.ts:120-123)**: Similar — solo `eq('id', agreementId)`.
  - Policy requiere `is_participant(one_on_one_id)`. ✗ **SILENT FAIL**

- **`reportAgreementFollowup` UPDATE (agreements.ts:176-179)**: Similar. ✗ **SILENT FAIL**

- **`saveMinute` DELETE (minutes.ts:80-84)**: Cuando la acción auto-extrae acuerdos por IA, borra previos ai-generated con:
  ```
  .delete()
  .eq('one_on_one_id', oneOnOneId)
  .eq('ai_generated', true)
  .eq('status', 'pendiente')
  ```
  - Policy `agreements_delete_participants` requiere `is_participant(one_on_one_id)`.
  - Este código **es correcto** — se borra sobre `one_on_one_id`, y el usuario calling `saveMinute` debe ser participante (minuta es de `minutes` que tiene policy basada en `is_participant`).
  - Pero **no hay guarantee**: el upsert de `minutes` valida participant (línea 186-192 de minutes.ts con .select() implícito, pero **no explícita validación pre-delete**).
  - **Defensa: la minuta solo se puede guardar si eres participante. OK.**

---

### Tabla: `agreement_followups`

| Action | Archivo:línea | Operación | Filtro | Policy aplicable | Estado |
|---|---|---|---|---|---|
| reportAgreementFollowup | agreements.ts:163-171 | INSERT | reported_by_id=user.id | `followups_insert_involved` | ✓ OK |

---

### Tabla: `vobos`

| Action | Archivo:línea | Operación | Filtro | Policy aplicable | Estado |
|---|---|---|---|---|---|
| submitVobo | vobos.ts:49-59 | UPSERT | one_on_one_id + user_id | `vobos_insert_self` / `vobos_update_self` | ✓ OK |

---

### Tabla: `minutes`

| Action | Archivo:línea | Operación | Filtro | Policy aplicable | Estado |
|---|---|---|---|---|---|
| saveMinute | minutes.ts:33-43 | UPSERT | one_on_one_id | `minutes_insert_participants` | ✓ OK |

---

### Tabla: `meeting_warmth_responses`

| Action | Archivo:línea | Operación | Filtro | Policy aplicable | Estado |
|---|---|---|---|---|---|
| submitWarmthResponse | warmth.ts:51-55 | INSERT | collaborator_id=user.id | `warmth_collaborator_insert` | ✓ OK |

---

### Tabla: `departments`

| Action | Archivo:línea | Operación | Filtro | Policy aplicable | Estado |
|---|---|---|---|---|---|
| createDepartment | departments.ts:21-28 | INSERT | (requireHR guard) | `departments_all_hr` | ✓ OK |
| renameDepartment | departments.ts:52-55 | UPDATE | eq('id',..) | `departments_all_hr` | ✓ OK |
| deleteDepartment | departments.ts:83 | DELETE | eq('id',..) | `departments_all_hr` | ✓ OK |

---

### Tabla: `cadence_configs`

| Action | Archivo:línea | Operación | Filtro | Policy aplicable | Estado |
|---|---|---|---|---|---|
| upsertGlobalCadence | cadence.ts:29-42 | INSERT/UPDATE | (requireHR guard) | `cadence_all_hr` | ✓ OK |
| upsertDepartmentCadence | cadence.ts:74-89 | INSERT/UPDATE | eq('id',..) | `cadence_all_hr` | ✓ OK |
| removeDepartmentCadence | cadence.ts:100-104 | DELETE | eq('id',..) + eq('scope_type','department') | `cadence_all_hr` | ✓ OK |

---

### Tabla: `org_settings`

| Action | Archivo:línea | Operación | Filtro | Policy aplicable | Estado |
|---|---|---|---|---|---|
| saveOrgSetting | org-settings.ts:15 | UPSERT (via setOrgSetting) | key | `org_settings_hr_all` | ✓ OK |

---

### Tabla: `notification_rules`

| Action | Archivo:línea | Operación | Filtro | Policy aplicable | Estado |
|---|---|---|---|---|---|
| createNotificationRule | notification-rules.ts:44-54 | INSERT | (requireHR guard) | `notification_rules_hr_all` | ✓ OK |
| updateNotificationRule | notification-rules.ts:81-91 | UPDATE | eq('id',..) | `notification_rules_hr_all` | ✓ OK |
| toggleNotificationRule | notification-rules.ts:108-111 | UPDATE | eq('id',..) | `notification_rules_hr_all` | ✓ OK |
| deleteNotificationRule | notification-rules.ts:125-128 | DELETE | eq('id',..) | `notification_rules_hr_all` | ✓ OK |

---

### Tabla: `notification_dispatches`

| Action | Archivo:línea | Operación | Filtro | Policy aplicable | Estado |
|---|---|---|---|---|---|
| testFireRule | notification-rules.ts:157-165 | INSERT | (requireHR guard) | `notification_dispatches_hr_insert` | ✓ OK |

---

### Tabla: `users` (via admin client)

| Action | Archivo:línea | Operación | Filtro | Policy aplicable | Estado |
|---|---|---|---|---|---|
| updateUserRole | users.ts:34-37 | UPDATE | eq('id',..) | N/A (createAdminClient) | ✓ BYPASS OK |
| updateUserActive | users.ts:65-68 | UPDATE | eq('id',..) | N/A (createAdminClient) | ✓ BYPASS OK |

---

### Tabla: `audit_logs`

| Múltiples actions | - | INSERT | user_id=auth.uid() | No policy INSERT — admin only | ✓ BYPASS OK |

---

## GAPS encontrados (prioridad)

### Crítico — silently failing

#### 1. **`updateAgreementStatus`** (agreements.ts:86-89)
**Problema**: UPDATE sin validación RLS de participante.
```typescript
await supabase
  .from('agreements')
  .update({ status: parsed.data.status })
  .eq('id', parsed.data.agreementId)
```

- **Policy requerida**: `is_participant(one_on_one_id)`
- **Actual**: ningún filtro
- **Riesgo**: no-participante puede creer que actualiza pero la BD silenciosamente rechaza.
- **Reproducir**: 
  ```
  POST /api/agreement/update
  { agreementId: "xyz", status: "cumplido" }
  // Como líder distinto → success:true pero 0 filas afectadas
  ```

**Fix sugerido**:
```sql
-- Opción A: agregar policy específica (no recomendado, duplicar logic)
create policy "agreements_update_by_id_only" on public.agreements
  for update
  using (
    public.is_participant(one_on_one_id) or public.is_hr()
  );

-- Opción B: mejorar la action para pre-validar con lógica DB:
-- (Requiere 2-step: fetch agreement con one_on_one_id, validar participante app-side)
```

#### 2. **`deleteAgreement`** (agreements.ts:120-123)
**Problema**: Similar a arriba — DELETE sin validación RLS.
```typescript
await supabase
  .from('agreements')
  .delete()
  .eq('id', parsed.data.agreementId)
```

- **Policy existente**: `agreements_delete_participants` usa `is_participant(one_on_one_id)`
- **Actual**: sin filtro → silently fails
- **Fix**: pre-fetch agreement con one_on_one_id y validar participante, O mejorar policy

#### 3. **`reportAgreementFollowup` UPDATE** (agreements.ts:176-179)
**Problema**: UPDATE de status sin participante check.
```typescript
await supabase
  .from('agreements')
  .update({ status: parsed.data.reportedStatus })
  .eq('id', parsed.data.agreementId)
```

- Similar a #1 y #2.

### Medio — defensa debilitada

#### 4. **`markNonRealization`** (one-on-ones.ts:236-239)
**Problema**: UPDATE sin participante filter, pero hay validación app-side.
```typescript
const { error: updateErr } = await supabase
  .from('one_on_ones')
  .update(updatePayload)
  .eq('id', parsed.data.oneOnOneId)
```

- **Policy**: `oneonones_update_participants_or_hr` requiere participante
- **App-side check**: sí, línea 213-220 valida `isParticipant or is_hr`
- **Riesgo bajo**: defensa en profundidad funciona. Pero mejor sería:
  ```typescript
  .eq('id', oneOnOneId)
  .or(`leader_id.eq.${user.id},collaborator_id.eq.${user.id}`)
  ```

---

## Recomendaciones globales

### Inmediatas (semana 1)
1. **Hotfix `updateAgreementStatus`, `deleteAgreement`, `reportAgreementFollowup`**:
   - Opción A (rápida): Pre-fetch el agreement con one_on_one_id. Validar is_participant app-side antes de UPDATE/DELETE.
   - Opción B (robusto): Propagar `one_on_one_id` a action params. Usar `.or(...)` filtera para validar RLS a nivel DB.

   ```typescript
   // Sugerencia de cambio en createAgreement param
   export async function updateAgreementStatus(
     input: z.infer<typeof updateStatusSchema> & { oneOnOneId: string }
   ) {
     // Fetch para validar
     const { data: agreement } = await supabase
       .from('agreements')
       .select('one_on_one_id')
       .eq('id', input.agreementId)
       .single()
     
     if (!agreement) return { success: false, error: 'Acuerdo no encontrado' }
     
     // Validar participante
     const { data: meeting } = await supabase
       .from('one_on_ones')
       .select('leader_id, collaborator_id')
       .eq('id', agreement.one_on_one_id)
       .single()
     
     if (!meeting || (meeting.leader_id !== user.id && meeting.collaborator_id !== user.id && !is_hr)) {
       return { success: false, error: 'Sin permisos' }
     }
     
     // Proceed with update (RLS redundance)
     const { error } = await supabase
       .from('agreements')
       .update({ status: input.status })
       .eq('id', input.agreementId)
   }
   ```

2. **Mejorar `markNonRealization`** con filtro explícito:
   ```typescript
   .eq('id', oneOnOneId)
   .or(`leader_id.eq.${user.id},collaborator_id.eq.${user.id}`)
   ```

### Perspectiva (Q2-Q3)
3. **Audit logging**: Implementar `after insert on one_on_ones ... check (rows affected = 1)` trigger para detectar silent-fails. O mejorar app-side error handling para loguear `affected_rows === 0 && success === true`.

4. **Test suite RLS**: 
   - Unit test cada action como non-participant y verificar que RLS bloquea.
   - Test como HR y verificar que pasa.

5. **Documentación**: Crear matriz visible en CLAUDE.md listando todas las operaciones y sus policy checks.

---

## Apéndice: Policies y Helpers

### Helper: `is_participant(one_on_one_id uuid)`
```sql
-- Definido en migration 01
create function public.is_participant(meeting_id uuid) returns boolean as $$
  select exists (
    select 1 from public.one_on_ones o
    where o.id = meeting_id
      and (o.leader_id = auth.uid() or o.collaborator_id = auth.uid())
  )
$$ language sql stable;
```

### Helper: `is_hr()`
```sql
-- Definido en migration 01
create function public.is_hr() returns boolean as $$
  select (select role from public.users where id = auth.uid()) = 'hr'
$$ language sql stable;
```

---

## Resumen de cambios sugeridos (SQL)

```sql
-- Fix: No hay migraciones nuevas estrictamente necesarias.
-- El problema es la LÓGICA de las actions, no las policies.
-- Las policies son correctas; las actions no las usan correctamente.

-- Mejora opcional (hardening): Add UPDATE policies a agreements
-- para que implícitamente rechace sin validar participante.
-- Pero esto sería redundante si el app-side fix se implementa.
```

