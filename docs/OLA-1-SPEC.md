# Ola 1 — SPEC de implementación

> Tres cambios paralelos para cerrar gaps críticos descubiertos en Ola 0.
> Cada implementador trabaja en su archivo sin overlap.
> Cada implementador hace self-review antes de declarar done.

## Constraints comunes para los 3 implementadores

- `pnpm tsc -b` debe pasar limpio antes de declarar done
- NO commitear, NO pushear, NO correr migrations
- NO modificar env vars
- NO refactorear cosas fuera de scope
- Crear archivos cuando aplique, modificar los listados, nada más
- Después de implementar, **leer el propio diff completo** y validar contra el acceptance

---

## Ola 1.A — Fix RLS gaps en agreements.ts

**Archivos:**
- Modificar: `src/lib/actions/agreements.ts`

**Problema (de `docs/rls-audit.md`):**
3 actions hacen UPDATE/DELETE filtrando solo por `id`, pero la RLS policy requiere `is_participant(one_on_one_id)`. Cuando un líder/colab que NO es participante invoca la action, RLS rechaza silenciosamente (0 rows afectadas), pero la action retorna `success:true`.

**Patrón de fix (idéntico para los 3):**
1. Pre-fetch del agreement con su `one_on_one_id`
2. Pre-fetch del one_on_one para obtener `leader_id` y `collaborator_id`
3. Validar `user.id === one_on_one.leader_id || user.id === one_on_one.collaborator_id`
4. Si no es participante, retornar error explícito: "No tenés permisos sobre este acuerdo"
5. Solo entonces hacer el UPDATE/DELETE

**Acciones a fixear:**
1. `updateAgreementStatus` (líneas 76-97)
2. `deleteAgreement` (líneas 103-144) — ya hace pre-fetch de `one_on_one_id`, solo agregar validación de participante
3. `reportAgreementFollowup` (líneas 153-185) — incluir validación antes del INSERT a `agreement_followups` Y del UPDATE a `agreements`

**Acceptance criteria:**
- Cada action retorna `{ success: false, error: 'No tenés permisos sobre este acuerdo' }` si user no es leader/colab del one_on_one asociado
- Cada action sigue funcionando para participantes legítimos
- `pnpm tsc -b` clean
- Patrón consistente con `markNonRealization` en `one-on-ones.ts:215-220` (referencia de cómo se hace bien)

**Out of scope:**
- NO tocar otras actions en el archivo
- NO crear migrations (las policies ya existen)
- NO escribir tests (otro stream)

---

## Ola 1.B — Implementar notifyByEmail con Resend

**Archivos:**
- Crear: `src/lib/email/notify.ts`
- Modificar: `.env.example` (agregar `EMAIL_FROM` si no existe)

**Problema (de `docs/notif-matrix.md`):**
`getEmailClient()` está definido en `src/lib/email/client.ts` pero nunca se usa. Sin un helper `notifyByEmail`, ningún `channel='email'` puede entregar. Bloquea Ola 1.C y Fase 7.B.3.

**Implementación:**

```typescript
// src/lib/email/notify.ts
import { getEmailClient } from './client'

interface EmailResult {
  sent: boolean
  skipped?: boolean
  error?: string
}

interface NotifyByEmailInput {
  to: string[]              // emails de destinatarios
  subject: string
  html: string              // HTML del cuerpo (sin <html>/<body> wrapper — el helper lo agrega)
  text?: string             // fallback texto plano
}

/**
 * Envía email vía Resend. Si RESEND_API_KEY o EMAIL_FROM no están configurados,
 * retorna {sent:false, skipped:true} silenciosamente — útil para dev local.
 */
export async function notifyByEmail(input: NotifyByEmailInput): Promise<EmailResult> {
  // ... implementación
}
```

**Detalles:**
- Wrap del `html` en template mínimo con header (logo "1to1" coral) y footer ("Enviado por 1to1 · B-Drive · [Configurar notificaciones]")
- Si `getEmailClient()` retorna null o `process.env.EMAIL_FROM` no está, retornar `{sent:false, skipped:true}`
- Errores de Resend: retornar `{sent:false, error: err.message}`, no throw

**Acceptance:**
- Llamada con todos los campos opcionales completos → `sent:true` cuando hay token, `skipped:true` cuando no
- TypeScript estricto: no `any`, no `as never`
- Template HTML renderiza limpio en Gmail/Outlook (validable manualmente con el helper de prueba)

**Smoke test:**
Crear `scripts/email-test-notify.ts` que llame `notifyByEmail({ to: ['acalderonm@b-drive.com.mx'], subject: 'Test', html: '<p>OK</p>' })` y loguee resultado. NO incluir en este task; solo dejar el helper listo para Ola 1.C.

**Out of scope:**
- NO templates rich por trigger (eso es Fase 7.B)
- NO wire en otras acciones (eso es Ola 1.C)
- NO Block Kit ni unsubscribe links

---

## Ola 1.C — Refactor check-thresholds dispatcher

**Archivos:**
- Modificar: `src/app/api/cron/check-thresholds/route.ts`

**Problema (de `docs/notif-matrix.md`):**
Hoy el cron itera recipients y dispatcha a `notification_dispatches` con `status='sent'` sin importar el canal. No llama a Slack ni email reales. 6 cells P0 en la matriz son engañosas.

**Cambio:**

Reemplazar el bloque final:

```typescript
// ANTES (líneas ~132-148)
for (const recipientId of recipients) {
  for (const channel of rule.channels) {
    const { error } = await admin
      .from('notification_dispatches' as never)
      .insert({
        rule_id: rule.id,
        recipient_id: recipientId,
        channel,
        context: { trigger: rule.trigger_type, rule_name: rule.name },
        status: 'sent',
      } as never)
    if (!error) totalDispatched++
  }
}
```

Por un dispatcher que efectivamente entrega:

```typescript
for (const recipientId of recipients) {
  // Pre-fetch del recipient para slack_user_id, email, etc.
  const { data: userRow } = await admin
    .from('users')
    .select('id, email, full_name, slack_user_id')
    .eq('id', recipientId)
    .single<{ id: string; email: string; full_name: string; slack_user_id: string | null }>()
  if (!userRow) continue

  for (const channel of rule.channels) {
    let delivered = false
    let failedReason: string | null = null

    if (channel === 'in_app') {
      const { error } = await admin.from('notifications').insert({
        user_id: recipientId,
        channel: 'in_app',
        title: `[${rule.name}]`,
        content: `Trigger: ${rule.trigger_type}`,
        link: '/colaborador',
      })
      delivered = !error
      failedReason = error?.message ?? null
    }

    if (channel === 'email' && userRow.email) {
      const res = await notifyByEmail({
        to: [userRow.email],
        subject: `[1to1] ${rule.name}`,
        html: `<p>Hola ${userRow.full_name}, se disparó la notificación "${rule.name}" (${rule.trigger_type}).</p>`,
      })
      delivered = res.sent
      failedReason = res.error ?? (res.skipped ? 'EMAIL_NOT_CONFIGURED' : null)
    }

    if (channel === 'slack' && userRow.slack_user_id) {
      const res = await notifyToSlackByTrigger(userRow.slack_user_id, rule, userRow.full_name)
      delivered = res.sent
      failedReason = res.error ?? (res.skipped ? 'SLACK_NOT_CONFIGURED' : null)
    }

    const { error } = await admin
      .from('notification_dispatches' as never)
      .insert({
        rule_id: rule.id,
        recipient_id: recipientId,
        channel,
        context: { trigger: rule.trigger_type, rule_name: rule.name },
        status: delivered ? 'sent' : 'failed',
        failed_reason: failedReason,
      } as never)
    if (!error && delivered) totalDispatched++
  }
}
```

**Función helper `notifyToSlackByTrigger`** (definir al principio del archivo):

```typescript
async function notifyToSlackByTrigger(
  slackUserId: string,
  rule: NotificationRuleRow,
  userName: string,
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  // Estrategia simple: usar notifyMissedMeeting como genérico hasta tener templates por trigger
  // (Fase 7.B cubrirá Block Kit con templates específicos)
  const message = `Notificación: ${rule.name} (${rule.trigger_type})`
  // Re-usamos notifyMissedMeeting pero con texto genérico — el helper acepta cualquier texto
  // TODO Fase 7.B: helpers específicos por trigger_type
  return notifyMissedMeeting(slackUserId, userName, '—', 0)
  // Nota: el formato actual de notifyMissedMeeting es específico a "missed meeting".
  // Para Ola 1.C usamos una variante: ver al final.
}
```

**ALTERNATIVA (preferida):** crear un helper genérico `notifySlackGeneric(slackUserId, title, body)` en `src/lib/slack/notify.ts` para no reusar `notifyMissedMeeting` con texto que no aplica.

**Acceptance:**
- Una regla con `channels=['in_app','email','slack']` y `audience=['leader']`:
  - Inserta 1 fila en `notifications` por recipient (in_app)
  - Llama `notifyByEmail` por recipient (si tiene email)
  - Llama Slack helper por recipient (si tiene slack_user_id)
  - Inserta 3 filas en `notification_dispatches` por recipient, con `status='sent'` o `'failed'` según delivery real
- Si un recipient no tiene `slack_user_id`, el dispatch slack queda con `status='failed'` y `failed_reason='SLACK_USER_NOT_LINKED'`
- `pnpm tsc -b` clean

**Out of scope:**
- NO templates por trigger (Fase 7.B)
- NO retry/queue (Fase 7.C)
- NO digest mode (Fase 7.D)
- NO touch de `notification_dispatches` schema (la columna `failed_reason` puede no existir todavía — si no existe, omitir y dejar TODO comentado)

**Dependencia:** requiere que Ola 1.B haya creado `notifyByEmail`. Si todavía no existe al momento de implementar, dejarlo como import comentado y `delivered = false; failed_reason = 'NOTIFY_BY_EMAIL_NOT_IMPLEMENTED'`.

---

## Aggregate (yo, post-implementación)

1. Verificar los 3 cambios juntos con `pnpm tsc -b`
2. Correr `pnpm build` (catch problemas de Next bundling)
3. Smoke test runtime:
   - Llamar `updateAgreementStatus` con user no-participante → debe retornar error claro
   - Llamar `notifyByEmail` directo → recibir email o skipped
   - Insertar regla `trigger=cumplimiento_bajo channels=[in_app,email,slack]`, disparar `check-thresholds` → verificar 3 entregas o 3 fails con razón
4. Si todo OK: commit + push

## Constraints absolutos para los implementadores

- **NUNCA** modificar el schema de DB (migrations)
- **NUNCA** modificar `.env.local` o `.env.example` salvo lo explícitamente listado
- **NUNCA** commitear ni pushear
- Si un implementador encuentra que su tarea depende de algo no listado, **declarar BLOCKED** y describir el blocker, no improvisar
