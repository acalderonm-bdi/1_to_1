# Matriz dispatcher de notificaciones

> Auditoría Ola 0.2 — estado actual de cada `trigger_type × channel`.
> El hallazgo principal: **`notification_dispatches` es audit-trail, no delivery-engine**.
> ~95% de los dispatches con `status='sent'` nunca llegan a destinatario real.

## Estado global

- Triggers definidos: **6**
- Channels soportados: **3** (`in_app`, `email`, `slack`)
- Total cells matriz: 18
- Cells con delivery real: **3 de 18** (17%)
- Cells con DB-only (engañosas): 6
- Cells stub (TODO explícito): 9

## Matriz completa

| trigger_type | in_app | email | slack | Disparado por |
|---|---|---|---|---|
| `cumplimiento_bajo` | ✓ DB | ✗ NO | ✗ NO | `check-thresholds:54-85` — solo `notification_dispatches.insert()` |
| `acuerdo_vencido` | ✓ DB | ✗ NO | ✗ NO | `check-thresholds:88-102` — solo `notification_dispatches.insert()` |
| `vobo_pendiente` | ✓ DB (HR) | ✗ NO | ✗ NO | `check-thresholds:119-128` — stub TODO, solo HR |
| `calidez_baja` | ✓ DB (HR) | ✗ NO | ✗ NO | `check-thresholds:119-128` — stub TODO, solo HR |
| `disputa_nueva` | ✓ DB | ✗ NO | ✗ NO | `check-thresholds:105-116` — solo registro |
| `reminder_pre_1to1` | ✓ DB (HR) | ✗ NO | ✗ NO | `check-thresholds:119-128` — stub TODO, solo HR |

Convención: `✓ DB` = solo registrado en `notification_dispatches`; `✗ NO` = no implementado.

## Flujos que SÍ tienen delivery real (fuera de check-thresholds)

| Flujo | Disparador | Delivery | Status |
|---|---|---|---|
| `check-cadence` → `notifyMissedMeeting` | Cron daily | Slack DM al líder | ✓ FUNCIONA |
| `markNonRealization` (goToDispute=true) → `notifyDispute` | User action | Slack canal RH | ✓ FUNCIONA (wire mayo 2026) |
| `send-scheduled-reports` → `notifyHRReport` | Cron hourly | Slack canal RH | ✓ FUNCIONA (wire mayo 2026) |
| `notify-due-agreements` → `notifications.insert` | Cron daily | in-app real | ✓ FUNCIONA |

## Gaps por prioridad

### P0 — Engañoso para RH (6 cells)

1. **`cumplimiento_bajo × {in_app, email, slack}`** — la regla "test" en DB tiene `channels=['slack', 'email']` pero ninguno llega.
2. **`acuerdo_vencido × {email, slack}`** — `in_app` se registra pero email/slack inexistentes.
3. **`disputa_nueva × {email, slack}`** — la disputa manual (`markNonRealization`) sí va a Slack, pero la regla automática NO.

### P1 — Stubs explícitos (3 triggers × 3 channels = 9 cells)

4. **`vobo_pendiente`** — código tiene `// TODO: implementación específica`
5. **`calidez_baja`** — mismo TODO
6. **`reminder_pre_1to1`** — mismo TODO

### P2 — Infraestructura global

7. **`notifyByEmail` no existe** — `getEmailClient()` definido en `src/lib/email/client.ts:1-11` pero nunca usado. `send-scheduled-reports` registra `channel='email'` con `status='sent'` falso.

## Funciones helper existentes vs usadas

| Helper | Definido en | Usado por | Cobertura |
|---|---|---|---|
| `notifyMissedMeeting` | `src/lib/slack/notify.ts:9` | `check-cadence:57` | ✓ Completa |
| `notifyDispute` | `src/lib/slack/notify.ts:48` | `one-on-ones.ts:266` | Solo acción manual, no regla automática |
| `notifyHRReport` | `src/lib/slack/notify.ts:29` | `send-scheduled-reports:97` | ✓ Completa |
| `notifyByEmail` | **NO EXISTE** | — | **GAP COMPLETO** |

## Recomendaciones para Fase 1.2

### Acción 1 — Bloquear o cablear `cumplimiento_bajo × slack`

La regla "test" en DB hoy promete Slack pero no llega. Dos opciones:
- (a) Implementar `notifyComplianceAlert(channel, dept, rate, threshold)` y llamarlo desde `check-thresholds:54-85`
- (b) UI de creación de regla: deshabilitar opción Slack si `trigger=cumplimiento_bajo` hasta implementar

### Acción 2 — Implementar `notifyByEmail` global

Usar `getEmailClient()` (Resend) + templates HTML. Aplicar a: `acuerdo_vencido`, `scheduled_reports`, `cumplimiento_bajo`. Es bloqueante para email en cualquier trigger.

### Acción 3 — Completar stubs `vobo_pendiente`, `calidez_baja`, `reminder_pre_1to1`

Cada uno necesita su query específica (qué considera "pendiente", "baja", "próximo"). Hasta entonces, deshabilitar la opción en UI o marcarla como "experimental".

### Acción 4 — Refactor del dispatcher

`check-thresholds` debe **iterar sobre `rule.channels` y llamar al delivery real**, no solo registrar dispatch. Patrón sugerido:

```ts
for (const channel of rule.channels) {
  let delivered = false
  if (channel === 'in_app') delivered = await sendInApp(...)
  if (channel === 'email') delivered = await notifyByEmail(...)
  if (channel === 'slack') delivered = await notifyToSlack(...)

  await admin.from('notification_dispatches').insert({
    ...,
    status: delivered ? 'sent' : 'failed',
    failed_reason: delivered ? null : '...',
  })
}
```

Status `sent` solo cuando hubo delivery real. Esto encaja con Fase 7.F (tracking de delivery).

## Resumen ejecutivo

El cron `check-thresholds` registra dispatches mensuales con `status='sent'` pero **el 95% nunca llega a destinatario real**. Para RH, hoy la UI dice "regla activa, X notificaciones enviadas esta semana" — pero la mayoría son fantasmas. Solo 4 flujos reales funcionan (cadence DM, dispute manual, scheduled-reports, due-agreements).

**Plan de mitigación (Fase 1.2):**
1. Implementar `notifyByEmail` (infraestructura)
2. Cablear `cumplimiento_bajo`, `acuerdo_vencido`, `disputa_nueva` × `email`/`slack`
3. Completar o deshabilitar stubs (`vobo_pendiente`, `calidez_baja`, `reminder_pre_1to1`)
4. Refactor del dispatcher: status='sent' solo tras delivery real
