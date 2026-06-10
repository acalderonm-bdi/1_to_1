# Notification Dispatcher Matrix

Auditado el 2026-06-10. Reemplaza la auditoría anterior (Ola 0.1).

Fuentes analizadas:
- `src/app/api/cron/check-thresholds/route.ts`
- `src/app/api/cron/check-cadence/route.ts`
- `src/lib/cron/due-agreements.ts`
- `src/lib/cron/scheduled-reports.ts`
- `src/lib/slack/notify.ts` + `client.ts`
- `src/lib/email/notify.ts` + `client.ts`
- `src/lib/actions/scheduled-reports.ts`
- `src/lib/actions/notification-rules.ts`
- `supabase/migrations/00000000000019_notification_rules.sql`
- `supabase/migrations/00000000000020_notification_dispatches.sql`
- `supabase/migrations/00000000000024_dispatches_cooldown_by_channel.sql`
- `supabase/migrations/00000000000025_notification_preferences.sql`

---

## Estado por trigger_type × channel

Los seis `trigger_type` definidos en la migración 19 son procesados por el cron
`check-thresholds`. Las columnas `email` y `slack` del dispatcher SÍ llaman a
funciones de delivery real, pero varios triggers usan un stub que no construye
la lista de destinatarios correctamente.

| trigger_type | channel | ¿Delivery real? | Función que llama | Notas |
|---|---|---|---|---|
| `cumplimiento_bajo` | `in_app` | **SÍ** | `admin.from('notifications').insert(...)` | Inserción directa a tabla `notifications`. |
| `cumplimiento_bajo` | `email` | **SÍ** | `notifyByEmail()` → Resend SDK | `src/app/api/cron/check-thresholds/route.ts:210`. Condicional a `userRow.email`, `RESEND_API_KEY` y `EMAIL_FROM`. |
| `cumplimiento_bajo` | `slack` | **SÍ** | `notifySlackGeneric()` → `WebClient.chat.postMessage` | `src/app/api/cron/check-thresholds/route.ts:226`. Condicional a `userRow.slack_user_id` y `SLACK_BOT_TOKEN`. |
| `acuerdo_vencido` | `in_app` | **SÍ** | `admin.from('notifications').insert(...)` | Mismo patrón. |
| `acuerdo_vencido` | `email` | **SÍ** | `notifyByEmail()` → Resend SDK | Mismas condiciones. |
| `acuerdo_vencido` | `slack` | **SÍ** | `notifySlackGeneric()` → `WebClient.chat.postMessage` | Mismas condiciones. |
| `disputa_nueva` | `in_app` | **SÍ** | `admin.from('notifications').insert(...)` | Ídem. |
| `disputa_nueva` | `email` | **SÍ** | `notifyByEmail()` → Resend SDK | Mismas condiciones. |
| `disputa_nueva` | `slack` | **SÍ** | `notifySlackGeneric()` → `WebClient.chat.postMessage` | Mismas condiciones. Existe también `notifyDispute()` (Slack a canal RH) llamado desde `src/lib/actions/one-on-ones.ts:264` en el momento de crear la disputa vía acción de usuario, independientemente del cron. |
| `vobo_pendiente` | `in_app` | **STUB** | `admin.from('notifications').insert(...)` | Solo notifica a usuarios con `role='hr'` si `audience` incluye `'hr'`. No busca VoBos reales. Ver Bug #1. |
| `vobo_pendiente` | `email` | **STUB** | `notifyByEmail()` → Resend SDK | Mismo stub; llega solo a HR. El template `VoboRequestEmail` (`src/lib/email/templates/vobo-request.tsx`) existe pero nunca es importado. Ver Bug #1. |
| `vobo_pendiente` | `slack` | **STUB** | `notifySlackGeneric()` → `WebClient.chat.postMessage` | Mismo stub; llega solo a HR. Ver Bug #1. |
| `calidez_baja` | `in_app` | **STUB** | `admin.from('notifications').insert(...)` | Solo HR, sin consulta de métricas de calidez. Ver Bug #2. |
| `calidez_baja` | `email` | **STUB** | `notifyByEmail()` → Resend SDK | Mismo stub. Ver Bug #2. |
| `calidez_baja` | `slack` | **STUB** | `notifySlackGeneric()` → `WebClient.chat.postMessage` | Mismo stub. Ver Bug #2. |
| `reminder_pre_1to1` | `in_app` | **STUB** | `admin.from('notifications').insert(...)` | Solo HR, sin consulta de 1:1 próximas. El template `MeetingReminderEmail` (`src/lib/email/templates/meeting-reminder.tsx`) existe pero nunca es importado. Ver Bug #3. |
| `reminder_pre_1to1` | `email` | **STUB** | `notifyByEmail()` → Resend SDK | Mismo stub. Ver Bug #3. |
| `reminder_pre_1to1` | `slack` | **STUB** | `notifySlackGeneric()` → `WebClient.chat.postMessage` | Mismo stub. Ver Bug #3. |

### Flujos fuera del dispatcher `check-thresholds`

| Flujo | Disparador | channel | ¿Delivery real? | Función que llama |
|---|---|---|---|---|
| Cadencia de reuniones | `check-cadence/route.ts` (cron) | `slack` | **SÍ** | `notifyMissedMeeting()` → `WebClient.chat.postMessage` |
| Acuerdos por vencer mañana | `due-agreements.ts` vía cron | `in_app` | **SÍ** | `admin.from('notifications').insert(...)` |
| Reportes programados (cron) | `scheduled-reports.ts` vía cron | `email` | **BUG — FALSO 'sent'** | Solo `console.log`. Ver Bug #6. |
| Reportes programados (manual) | `actions/scheduled-reports.ts` | `email` | **BUG — FALSO 'sent'** | Solo `console.log`. Ver Bug #6. |
| Disputa nueva (acción usuario) | `actions/one-on-ones.ts:264` | `slack` | **SÍ** | `notifyDispute()` → `WebClient.chat.postMessage` al canal RH |
| Test de regla (`testFireRule`) | `actions/notification-rules.ts:151` | `in_app` | **SÍ (solo in_app)** | `admin.from('notification_dispatches').insert(...)` con `status='sent'` — no llama delivery real |

---

## Bugs encontrados

### Bug #1 — `vobo_pendiente`: stub sin query real, destinatarios colapsados a HR
**Archivo:** `src/app/api/cron/check-thresholds/route.ts:154-164`

Los tres triggers `vobo_pendiente`, `calidez_baja` y `reminder_pre_1to1` comparten un único bloque `case` con un `// TODO` explícito:

```ts
case 'vobo_pendiente':
case 'calidez_baja':
case 'reminder_pre_1to1': {
  // TODO: implementación específica. Por ahora dispatch mínimo a HR si
  // está en la audiencia, para que el flujo de notificación quede
  // ejercitado en producción.
  if (audience.has('hr')) {
    for (const id of await getHrUserIds()) recipients.add(id)
  }
  break
}
```

Para `vobo_pendiente`, la audiencia correcta es el colaborador que tiene el VoBo pendiente (no HR). El mensaje debería usar `VoboRequestEmail` (`src/lib/email/templates/vobo-request.tsx:9`) pero ese componente nunca es importado en ningún archivo del proyecto.

---

### Bug #2 — `calidez_baja`: stub sin consulta de métricas de calidez
**Archivo:** `src/app/api/cron/check-thresholds/route.ts:155-164` (mismo bloque que Bug #1)

Debería consultar resultados de encuestas de calidez (tabla `warmth_surveys` o vista derivada) y comparar contra `rule.threshold.value`. Actualmente notifica a HR incondicionalmente, ignorando si hay calidez realmente baja. El umbral (`rule.threshold`) se recibe pero no se usa para este trigger.

---

### Bug #3 — `reminder_pre_1to1`: stub sin consulta de próximas 1:1
**Archivo:** `src/app/api/cron/check-thresholds/route.ts:156-164` (mismo bloque que Bug #1)

Debería consultar `one_on_ones` con `scheduled_at` dentro de la ventana de anticipación, y notificar a líder y colaborador. El template `MeetingReminderEmail` (`src/lib/email/templates/meeting-reminder.tsx:11`) existe pero nunca es importado.

---

### Bug #4 — `check-cadence`: sin audit trail en `notification_dispatches`, sin cooldown propio
**Archivo:** `src/app/api/cron/check-cadence/route.ts:52-65`

`notifyMissedMeeting()` envía el Slack DM, pero nunca inserta en `notification_dispatches`. La protección anti-spam depende únicamente de que el cron no se ejecute más de una vez por día (frágil ante retries o doble ejecución). Tampoco hay fallback a email cuando `leader.slack_user_id` es nulo (`check-cadence/route.ts:52`: `if (leader?.slack_user_id) { ... }` — la rama `else` no existe).

---

### Bug #5 — `runDueAgreementsNotifications`: solo `in_app`, sin audit trail ni cooldown
**Archivo:** `src/lib/cron/due-agreements.ts:32-44`

Inserta en `notifications` (canal in_app) pero no escribe en `notification_dispatches`. Sin esa fila no hay cooldown diario: si el cron se ejecuta dos veces en el mismo día, el responsable recibe dos avisos in-app del mismo acuerdo. No hay email ni Slack para este flujo.

---

### Bug #6 — `runScheduledReports` y acción manual: `status='sent'` sin envío real de email
**Archivo cron:** `src/lib/cron/scheduled-reports.ts:76-119`
**Archivo acción manual:** `src/lib/actions/scheduled-reports.ts:172-203`

Ambos caminos generan el CSV correctamente pero en lugar de llamar a `notifyByEmail()` solo hacen `console.log(...)` y luego insertan en `notification_dispatches` con `status: 'sent'`. El comentario en el código lo confirma explícitamente:

```ts
// STUB email send — log + audit a notification_dispatches.
console.log(`[scheduled-report] would send ${csv.filename} to ...`)
// ...
status: 'sent',   // ← falso positivo
```

El CSV se crea en memoria pero **nunca se entrega**. El dispatch con `status='sent'` es incorrecto.

---

### Bug #7 — `notification_dispatches.failed_reason` no existe en schema, se descarta en memoria
**Archivo:** `src/app/api/cron/check-thresholds/route.ts:232-237`

```ts
// NOTE: `notification_dispatches.failed_reason` column does not exist yet
// (see migration 00000000000020). TODO: add column in a future migration
// and persist `failedReason` so the matrix can show real delivery state.
void failedReason
```

`failedReason` se calcula correctamente en runtime (valores como `'EMAIL_NOT_CONFIGURED'`, `'SLACK_USER_NOT_LINKED'`, el mensaje de error de Resend o Slack), pero se descarta con `void`. La tabla solo tiene `status='failed'` sin causa. No existe migración que agregue esta columna.

---

### Bug #8 — Opt-out de `notification_preferences` no consultado en el dispatcher
**Archivo:** `src/app/api/cron/check-thresholds/route.ts:183-189`

```ts
// TODO (Fase 7.A — opt-out granular): antes de enviar, consultar
// `notification_preferences` con
//   (user_id = recipientId, trigger_type = rule.trigger_type, channel)
// y si `enabled = false` saltar este recipient/channel.
```

La tabla `notification_preferences` (migration 25) y las acciones CRUD en `src/lib/actions/notification-preferences.ts` están completamente implementadas, pero el dispatcher las ignora. Todos los usuarios reciben todas las notificaciones independientemente de sus preferencias configuradas.

---

## Lo que falta implementar

| Prioridad | Item | Archivo:línea |
|---|---|---|
| P0 | Envío real de email en `runScheduledReports`: reemplazar `console.log` + `status='sent'` por `notifyByEmail()`, cambiar status al resultado real. | `src/lib/cron/scheduled-reports.ts:76` y `src/lib/actions/scheduled-reports.ts:172` |
| P0 | Query real para `vobo_pendiente`: buscar `one_on_ones` con VoBo pendiente del colaborador; usar `VoboRequestEmail` template para email. | `src/app/api/cron/check-thresholds/route.ts:154` |
| P1 | Query real para `reminder_pre_1to1`: buscar `one_on_ones` con `scheduled_at` en ventana configurable; notificar líder y colaborador con `MeetingReminderEmail` template. | `src/app/api/cron/check-thresholds/route.ts:156` |
| P1 | Query real para `calidez_baja`: consultar `warmth_surveys` o vista derivada vs. `rule.threshold.value`; notificar líderes afectados + HR. | `src/app/api/cron/check-thresholds/route.ts:155` |
| P1 | Implementar consulta de `notification_preferences` antes de enviar: saltar recipient/channel si `enabled=false`. | `src/app/api/cron/check-thresholds/route.ts:183` |
| P2 | Agregar columna `failed_reason text` a `notification_dispatches` en nueva migración y persistirla desde el dispatcher. | Nueva migración SQL + `src/app/api/cron/check-thresholds/route.ts:236` |
| P2 | Agregar inserción en `notification_dispatches` desde `check-cadence` para audit trail y cooldown propio. | `src/app/api/cron/check-cadence/route.ts:65` |
| P2 | Agregar fallback a email en `check-cadence` cuando `leader.slack_user_id` es nulo. | `src/app/api/cron/check-cadence/route.ts:52` |
| P3 | Agregar canales `email` y `slack` a `runDueAgreementsNotifications` + inserción en `notification_dispatches` con cooldown. | `src/lib/cron/due-agreements.ts:32` |
| P3 | Cablear `VoboRequestEmail` y `MeetingReminderEmail` templates al dispatcher (actualmente definidos pero nunca importados). | `src/lib/email/templates/vobo-request.tsx:9`, `src/lib/email/templates/meeting-reminder.tsx:11` |
