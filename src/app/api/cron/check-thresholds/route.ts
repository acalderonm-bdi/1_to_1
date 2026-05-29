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
import * as Sentry from '@sentry/nextjs'
import { runDueAgreementsNotifications } from '@/lib/cron/due-agreements'
import { runScheduledReports } from '@/lib/cron/scheduled-reports'
import { runCadenceCheck } from '@/lib/cron/cadence'
import { assertCronAuth } from '@/lib/cron/auth'
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
      // "Mis acuerdos" es el espacio personal del responsable (accesible a todos
      // tras el acceso relacional), sin importar su rol.
      return '/colaborador/acuerdos'
    case 'disputa_nueva':
      return role === 'hr' ? '/arquitectura-humana/disputas' : role === 'leader' ? '/lider/equipo' : '/colaborador/historial'
    case 'vobo_pendiente':
      // El historial personal lista sus 1:1 a confirmar (accesible a todos).
      return '/colaborador/historial'
    case 'calidez_baja':
      return '/arquitectura-humana/mapa-calor'
    case 'reminder_pre_1to1':
      return role === 'collaborator' ? '/colaborador' : '/lider'
    default:
      return role === 'hr' ? '/arquitectura-humana' : role === 'leader' ? '/lider' : '/colaborador'
  }
}

export async function GET(request: NextRequest) {
  const authErr = assertCronAuth(request)
  if (authErr) return authErr

  const admin = createAdminClient()

  const rulesResult = await admin
    .from('notification_rules')
    .select('*')
    .eq('enabled', true)

  const rules = (rulesResult.data ?? []) as unknown as NotificationRuleRow[]
  let totalDispatched = 0

  // Opt-out granular (H4.1): preferencias con enabled=false. in_app no se desactiva.
  const { data: prefsRaw } = await admin
    .from('notification_preferences')
    .select('user_id, trigger_type, channel')
    .eq('enabled', false)
  const optOut = new Set((prefsRaw ?? []).map((p) => `${p.user_id}|${p.trigger_type}|${p.channel}`))

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
        // `compliance_metrics.compliance_rate` viene como PORCENTAJE 0-100 (la
        // vista multiplica por 100). El umbral de la regla también es 0-100, así
        // que se comparan DIRECTAMENTE — NO dividir entre 100 (bug histórico que
        // dejaba la alarma muda salvo a 0%). No normalizar la vista a 0-1: la usan
        // mapa-calor y exports/cumplimiento-csv con la convención 0-100.
        const thresholdPct = typeof rule.threshold?.value === 'number' ? rule.threshold.value : 50

        const lowResult = await admin
          .from('compliance_metrics')
          .select('department_id, compliance_rate')
          .lt('compliance_rate', thresholdPct)
        const lowDeptIds = (lowResult.data ?? [])
          .map((r) => r.department_id)
          .filter((x): x is string => !!x)

        if (audience.has('leader') && lowDeptIds.length > 0) {
          // Por RELACIÓN, no por rol: líderes de colaboradores cuyo departamento
          // tiene bajo cumplimiento. Targeting por role='leader' dejaba ciegos a
          // los 51 duales (role distinto que igual lideran) — justo lo que RH más
          // necesita escalar.
          const { data: rels } = await admin
            .from('leadership_relations')
            .select('leader_id, collaborator:users!leadership_relations_collaborator_id_fkey(department_id)')
            .is('ended_at', null)
          for (const rel of (rels ?? []) as Array<{
            leader_id: string
            collaborator: { department_id: string | null } | Array<{ department_id: string | null }> | null
          }>) {
            const col = Array.isArray(rel.collaborator) ? rel.collaborator[0] : rel.collaborator
            if (col?.department_id && lowDeptIds.includes(col.department_id)) {
              recipients.add(rel.leader_id)
            }
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

      case 'reminder_pre_1to1': {
        // 1:1 agendadas en las próximas 48h → recordar a ambos participantes
        // (previene no-shows, lo único que ATACA el incumplimiento en vez de
        // detectarlo a posteriori).
        const now = new Date()
        const in48h = new Date(now.getTime() + 48 * 3600 * 1000)
        const { data: upcoming } = await admin
          .from('one_on_ones')
          .select('leader_id, collaborator_id')
          .eq('status', 'agendada')
          .gte('scheduled_at', now.toISOString())
          .lte('scheduled_at', in48h.toISOString())
        const rows = (upcoming ?? []) as Array<{ leader_id: string; collaborator_id: string }>
        if (audience.has('leader')) for (const r of rows) recipients.add(r.leader_id)
        if (audience.has('collaborator')) for (const r of rows) recipients.add(r.collaborator_id)
        if (audience.has('hr')) for (const id of await getHrUserIds()) recipients.add(id)
        break
      }

      case 'vobo_pendiente': {
        // 1:1 ya ocurridas (agendadas, fecha pasada) sin VoBo del participante →
        // recordar a quien falta confirmar.
        const { data: past } = await admin
          .from('one_on_ones')
          .select('leader_id, collaborator_id, vobos(user_id)')
          .eq('status', 'agendada')
          .lt('scheduled_at', new Date().toISOString())
        for (const m of (past ?? []) as Array<{
          leader_id: string; collaborator_id: string; vobos: Array<{ user_id: string }>
        }>) {
          const voters = new Set(m.vobos.map((v) => v.user_id))
          if (audience.has('leader') && !voters.has(m.leader_id)) recipients.add(m.leader_id)
          if (audience.has('collaborator') && !voters.has(m.collaborator_id)) recipients.add(m.collaborator_id)
        }
        if (audience.has('hr')) for (const id of await getHrUserIds()) recipients.add(id)
        break
      }

      case 'calidez_baja': {
        // Señal coarse a RH (su audiencia natural). El umbral fino sobre
        // warmth_survey es mejora futura; por ahora se informa a RH si aplica.
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
        // Opt-out granular (H4.1): si el destinatario desactivó este canal para
        // este trigger, saltar. in_app no es desactivable; ausencia de fila =
        // opt-in por defecto.
        if (channel !== 'in_app' && optOut.has(`${recipientId}|${rule.trigger_type}|${channel}`)) {
          continue
        }
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

        const { error } = await admin
          .from('notification_dispatches')
          .insert({
            rule_id: rule.id,
            recipient_id: recipientId,
            channel,
            context: { trigger: rule.trigger_type, rule_name: rule.name },
            status: delivered ? 'sent' : 'failed',
            failed_reason: failedReason,
            delivered_at: delivered ? new Date().toISOString() : null,
          })
        if (!error && delivered) {
          totalDispatched++
        }
        // Cooldown unique-index violations are expected and ignored.
      }
    }
  }

  // Plan Hobby: solo 2 cron jobs agendables en Vercel. Este cron diario también
  // dispara la alarma de cadencia, los avisos de "acuerdo por vencer mañana" y
  // los reportes programados. Cada sub-job AISLADO (H4.2): un fallo se reporta a
  // Sentry y no tumba a los demás. Sus rutas standalone quedan para trigger manual.
  async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | { error: string }> {
    try {
      return await fn()
    } catch (e) {
      Sentry.captureException(e, { tags: { cron: 'check-thresholds', subjob: label } })
      return { error: e instanceof Error ? e.message : 'error' }
    }
  }
  const cadence = await safe('cadence', () => runCadenceCheck(admin))
  const due_agreements = await safe('due_agreements', () => runDueAgreementsNotifications(admin))
  const scheduled_reports = await safe('scheduled_reports', () => runScheduledReports(admin))

  return NextResponse.json({
    rules_evaluated: rules.length,
    total_dispatched: totalDispatched,
    cadence,
    due_agreements,
    scheduled_reports,
  })
}
