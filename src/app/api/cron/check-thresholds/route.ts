/**
 * Cron: check-thresholds
 *
 * Evaluates every enabled `notification_rules` row and inserts
 * `notification_dispatches` for each matching recipient × channel combo.
 *
 * Cooldown: a unique index on (rule_id, recipient_id, channel, day) provided
 * by the Wave 1 foundation prevents duplicate dispatches within the same day.
 * Insert failures from that unique violation are swallowed silently.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Note: rows from `notification_rules` come back with DB-level types
 * (`trigger_type: string`, `audience: string[]`, etc.). We narrow to the
 * stricter domain `NotificationRuleRow` shape at the boundary because writes
 * are zod-validated against the union types in `notification-rules.ts`.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDueAgreementsNotifications } from '@/lib/cron/due-agreements'
import { runScheduledReports } from '@/lib/cron/scheduled-reports'
import { escapeHtml, notifyByEmail } from '@/lib/email/notify'
import { notifySlackGeneric } from '@/lib/slack/notify'
import type { NotificationRuleRow } from '@/types/domain'

interface RecipientRow {
  id: string
  email: string | null
  full_name: string | null
  slack_user_id: string | null
  role: 'collaborator' | 'leader' | 'hr'
}

/**
 * Devuelve el path correcto para deep-link según trigger × rol del destinatario.
 * Los crons no conocen el ID del recurso específico (depende del trigger),
 * así que linkamos a la vista que contiene el contexto (ej. mapa de calor
 * para HR ante cumplimiento bajo).
 */
function linkForTrigger(
  trigger: NotificationRuleRow['trigger_type'],
  role: RecipientRow['role'],
): string {
  switch (trigger) {
    case 'cumplimiento_bajo':
      return role === 'hr' ? '/arquitectura-humana/mapa-calor' : '/lider/equipo'
    case 'acuerdo_vencido':
      return role === 'collaborator' ? '/colaborador/acuerdos' : '/lider/equipo'
    case 'disputa_nueva':
      return role === 'hr' ? '/arquitectura-humana/disputas' : role === 'leader' ? '/lider/equipo' : '/colaborador/historial'
    case 'vobo_pendiente':
      return role === 'collaborator' ? '/colaborador/historial' : '/lider/equipo'
    case 'calidez_baja':
      return '/arquitectura-humana/mapa-calor'
    case 'reminder_pre_1to1':
      return role === 'collaborator' ? '/colaborador' : '/lider'
    default:
      return role === 'hr' ? '/arquitectura-humana' : role === 'leader' ? '/lider' : '/colaborador'
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const rulesResult = await admin
    .from('notification_rules')
    .select('*')
    .eq('enabled', true)

  const rules = (rulesResult.data ?? []) as unknown as NotificationRuleRow[]
  let totalDispatched = 0

  // Cache HR user list (used by multiple triggers).
  let hrUsersCache: string[] | null = null
  async function getHrUserIds(): Promise<string[]> {
    if (hrUsersCache) return hrUsersCache
    const { data } = await admin.from('users').select('id').eq('role', 'hr')
    hrUsersCache = ((data ?? []) as Array<{ id: string }>).map((r) => r.id)
    return hrUsersCache
  }

  for (const rule of rules) {
    const recipients = new Set<string>()
    const audience = new Set(rule.audience)

    switch (rule.trigger_type) {
      case 'cumplimiento_bajo': {
        // The `compliance_metrics` view aggregates per department
        // (compliance_rate as a fraction 0-1; the rule threshold uses percent).
        const thresholdPct = typeof rule.threshold?.value === 'number' ? rule.threshold.value : 50
        const thresholdRate = thresholdPct / 100

        const lowResult = await admin
          .from('compliance_metrics')
          .select('department_id, compliance_rate')
          .lt('compliance_rate', thresholdRate)
        const lowDeptIds = (lowResult.data ?? [])
          .map((r) => r.department_id)
          .filter((x): x is string => !!x)

        if (audience.has('leader') && lowDeptIds.length > 0) {
          // Leaders = users with role='leader' whose department is flagged.
          const { data: leadersRaw } = await admin
            .from('users')
            .select('id')
            .eq('role', 'leader')
            .in('department_id', lowDeptIds)
          for (const l of (leadersRaw ?? []) as Array<{ id: string }>) {
            recipients.add(l.id)
          }
        }
        if (audience.has('hr')) {
          for (const id of await getHrUserIds()) recipients.add(id)
        }
        break
      }

      case 'acuerdo_vencido': {
        const today = new Date().toISOString().slice(0, 10)
        const { data: vencidos } = await admin
          .from('agreements')
          .select('responsible_id')
          .lt('due_date', today)
          .in('status', ['pendiente', 'parcial'])
        const rows = (vencidos ?? []) as Array<{ responsible_id: string }>
        if (audience.has('collaborator') || audience.has('leader')) {
          for (const r of rows) recipients.add(r.responsible_id)
        }
        if (audience.has('hr')) {
          for (const id of await getHrUserIds()) recipients.add(id)
        }
        break
      }

      case 'disputa_nueva': {
        const { data: disputas } = await admin
          .from('one_on_ones')
          .select('leader_id, collaborator_id')
          .eq('status', 'en_disputa')
        const rows = (disputas ?? []) as Array<{ leader_id: string; collaborator_id: string }>
        if (audience.has('leader')) for (const r of rows) recipients.add(r.leader_id)
        if (audience.has('collaborator')) for (const r of rows) recipients.add(r.collaborator_id)
        if (audience.has('hr')) {
          for (const id of await getHrUserIds()) recipients.add(id)
        }
        break
      }

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
    }

    for (const recipientId of recipients) {
      // Pre-fetch recipient profile (email, slack_user_id, full_name) so the
      // dispatcher can actually deliver to email/slack per channel.
      const { data: userRow } = await admin
        .from('users')
        .select('id, email, full_name, slack_user_id, role')
        .eq('id', recipientId)
        .single<RecipientRow>()
      if (!userRow) continue

      const fullName = userRow.full_name ?? ''
      const title = `[${rule.name}]`
      const body = `Trigger: ${rule.trigger_type}`
      const deepLink = linkForTrigger(rule.trigger_type, userRow.role)

      for (const channel of rule.channels) {
        // TODO (Fase 7.A — opt-out granular): antes de enviar, consultar
        // `notification_preferences` con
        //   (user_id = recipientId, trigger_type = rule.trigger_type, channel)
        // y si `enabled = false` saltar este recipient/channel. Si no hay
        // row, asumir habilitado (default opt-in). Ver
        // `src/lib/actions/notification-preferences.ts` + migration 25.
        let delivered = false
        let failedReason: string | null = null

        if (channel === 'in_app') {
          const { error } = await admin.from('notifications').insert({
            user_id: recipientId,
            channel: 'in_app',
            title,
            content: body,
            link: deepLink,
          })
          delivered = !error
          failedReason = error?.message ?? null
        } else if (channel === 'email') {
          if (!userRow.email) {
            delivered = false
            failedReason = 'EMAIL_NOT_CONFIGURED'
          } else {
            // Escapar texto de DB antes de meter en HTML (XSS prevention en email client).
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
            const absoluteDeepLink = `${appUrl}${deepLink}`
            const res = await notifyByEmail({
              to: [userRow.email],
              subject: `[1to1] ${rule.name}`,
              html:
                `<p>Hola ${escapeHtml(fullName)}, se disparó la notificación "${escapeHtml(rule.name)}" (${escapeHtml(rule.trigger_type)}).</p>` +
                `<p><a href="${absoluteDeepLink}" style="background:#ED6134;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Ver en 1to1</a></p>`,
              recipientRole: userRow.role,
            })
            delivered = res.sent
            failedReason = res.error ?? (res.skipped ? 'EMAIL_NOT_CONFIGURED' : null)
          }
        } else if (channel === 'slack') {
          if (!userRow.slack_user_id) {
            delivered = false
            failedReason = 'SLACK_USER_NOT_LINKED'
          } else {
            const res = await notifySlackGeneric(userRow.slack_user_id, rule.name, body, deepLink)
            delivered = res.sent
            failedReason = res.error ?? (res.skipped ? 'SLACK_NOT_CONFIGURED' : null)
          }
        }

        // NOTE: `notification_dispatches.failed_reason` column does not exist yet
        // (see migration 00000000000020). TODO: add column in a future migration
        // and persist `failedReason` so the matrix can show real delivery state.
        // For now we only persist status; failedReason is computed for future use.
        void failedReason
        const { error } = await admin
          .from('notification_dispatches')
          .insert({
            rule_id: rule.id,
            recipient_id: recipientId,
            channel,
            context: { trigger: rule.trigger_type, rule_name: rule.name },
            status: delivered ? 'sent' : 'failed',
          })
        if (!error && delivered) {
          totalDispatched++
        }
        // Cooldown unique-index violations are expected and ignored.
      }
    }
  }

  // Plan Hobby: solo 2 cron jobs agendables en Vercel. Este cron diario también
  // dispara los avisos de "acuerdo por vencer mañana" y los reportes programados
  // pendientes (granularidad diaria). Sus rutas standalone quedan para trigger
  // manual. Ver vercel.json y docs/architecture.md.
  const due_agreements = await runDueAgreementsNotifications(admin)
  const scheduled_reports = await runScheduledReports(admin)

  return NextResponse.json({
    rules_evaluated: rules.length,
    total_dispatched: totalDispatched,
    due_agreements,
    scheduled_reports,
  })
}
