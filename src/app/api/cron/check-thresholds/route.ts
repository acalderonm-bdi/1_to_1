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
 * Auth: `assertCronAuth` (bearer timing-safe + rechazo de secretos débiles).
 *
 * Note: rows from `notification_rules` come back with DB-level types
 * (`trigger_type: string`, `audience: string[]`, etc.). We narrow to the
 * stricter domain `NotificationRuleRow` shape at the boundary because writes
 * are zod-validated against the union types in `notification-rules.ts`.
 */
import * as Sentry from '@sentry/nextjs'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDueAgreementsNotifications } from '@/lib/cron/due-agreements'
import { runScheduledReports } from '@/lib/cron/scheduled-reports'
import { runCadenceCheck } from '@/lib/cron/cadence'
import { assertCronAuth } from '@/lib/cron/auth'
import { escapeHtml, notifyByEmail } from '@/lib/email/notify'
import { notifySlackGeneric } from '@/lib/slack/notify'
import type { NotificationRuleRow } from '@/types/domain'

// HTML builders para templates de email — usamos strings directas porque
// react-dom/server no está permitido en Route Handlers de Next.js App Router.
function voboRequestHtml(p: { recipientName: string; partnerName: string; meetingDate: string; voboUrl: string }): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
<h1 style="color:#1e293b">¿Se realizó tu 1:1?</h1>
<p>Hola ${escapeHtml(p.recipientName)},</p>
<p>Por favor confirma si tu 1:1 del <strong>${escapeHtml(p.meetingDate)}</strong> con <strong>${escapeHtml(p.partnerName)}</strong> se llevó a cabo.</p>
<a href="${p.voboUrl}" style="display:inline-block;padding:12px 24px;background:#1e293b;color:#fff;text-decoration:none;border-radius:6px">Dar VoBo</a>
<hr/><small style="color:#64748b">Sistema de 1:1s</small></div>`
}
function meetingReminderHtml(p: { recipientName: string; partnerName: string; meetingDate: string; meetingTime: string; modality: string; meetLink?: string; location?: string }): string {
  const link = p.modality === 'virtual' && p.meetLink
    ? `<p><a href="${p.meetLink}" style="color:#3b82f6">Unirse a Google Meet</a></p>` : ''
  const loc = p.modality === 'presencial' && p.location
    ? `<p>Lugar: ${escapeHtml(p.location)}</p>` : ''
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
<h1 style="color:#1e293b">Recordatorio: 1:1 en 1 hora</h1>
<p>Hola ${escapeHtml(p.recipientName)},</p>
<p>Tu 1:1 con <strong>${escapeHtml(p.partnerName)}</strong> es hoy a las <strong>${escapeHtml(p.meetingTime)}</strong> (${escapeHtml(p.meetingDate)}).</p>
${link}${loc}<hr/><small style="color:#64748b">Sistema de 1:1s</small></div>`
}

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
  const authErr = assertCronAuth(request)
  if (authErr) return authErr

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
        // `compliance_metrics.compliance_rate` viene como PORCENTAJE 0-100 (la
        // vista multiplica por 100, ver migración 29). El umbral de la regla
        // también es 0-100, así que se comparan DIRECTAMENTE — NO dividir entre
        // 100 (bug histórico que dejaba la alarma muda salvo a 0%). No normalizar
        // la vista a 0-1: la usan mapa-calor y exports con la convención 0-100.
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
          // los duales (role distinto que igual lideran) — justo lo que RH más
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

      case 'vobo_pendiente': {
        // Busca 1:1s cuyo VoBo aún está pendiente (status='agendada' y
        // scheduled_at ya pasó hace más de `threshold.days` días, default 2).
        // La audiencia correcta es el colaborador que debe dar su VoBo.
        const pendingDays =
          typeof rule.threshold?.days === 'number' ? rule.threshold.days : 2
        const cutoff = new Date(Date.now() - pendingDays * 24 * 60 * 60 * 1000).toISOString()

        const { data: pendingVobos } = await admin
          .from('one_on_ones')
          .select('id, collaborator_id, leader_id, scheduled_at, modality, location, meet_link')
          .eq('status', 'agendada')
          .lt('scheduled_at', cutoff)
        const voboRows = (pendingVobos ?? []) as Array<{
          id: string
          collaborator_id: string
          leader_id: string
          scheduled_at: string
          modality: string
          location: string | null
          meet_link: string | null
        }>

        // Notificar al colaborador (y al líder si está en la audiencia).
        for (const row of voboRows) {
          if (audience.has('collaborator')) recipients.add(row.collaborator_id)
          if (audience.has('leader')) recipients.add(row.leader_id)
        }
        if (audience.has('hr')) {
          for (const id of await getHrUserIds()) recipients.add(id)
        }

        // Envío temprano con template VoboRequestEmail (solo para colaboradores).
        // Los demás destinatarios recibirán el email genérico del bucle principal.
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
        for (const row of voboRows) {
          const { data: collabRow } = await admin
            .from('users')
            .select('id, email, full_name, slack_user_id, role')
            .eq('id', row.collaborator_id)
            .single<RecipientRow>()
          if (!collabRow) continue

          const { data: leaderRow } = await admin
            .from('users')
            .select('full_name')
            .eq('id', row.leader_id)
            .single<{ full_name: string | null }>()
          const leaderName = leaderRow?.full_name ?? ''
          const meetingDate = new Date(row.scheduled_at).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'long', year: 'numeric',
          })

          for (const channel of rule.channels) {
            let delivered = false
            let failedReason: string | null = null

            if (channel === 'in_app') {
              const { error } = await admin.from('notifications').insert({
                user_id: row.collaborator_id,
                channel: 'in_app',
                title: `[${rule.name}]`,
                content: `Tu VoBo para la 1:1 del ${meetingDate} con ${leaderName} está pendiente.`,
                link: `/colaborador/1to1/${row.id}`,
              })
              delivered = !error
              failedReason = error?.message ?? null
            } else if (channel === 'email' && collabRow.email) {
              const html = voboRequestHtml({
                recipientName: collabRow.full_name ?? '',
                partnerName: leaderName,
                meetingDate,
                voboUrl: `${appUrl}/colaborador/1to1/${row.id}`,
              })
              const res = await notifyByEmail({
                to: [collabRow.email],
                subject: `[1to1] VoBo pendiente: 1:1 del ${meetingDate}`,
                html,
                recipientRole: 'collaborator',
              })
              delivered = res.sent
              failedReason = res.error ?? (res.skipped ? 'EMAIL_NOT_CONFIGURED' : null)
            } else if (channel === 'slack' && collabRow.slack_user_id) {
              const voboUrl = `${appUrl}/colaborador/1to1/${row.id}`
              const res = await notifySlackGeneric(
                collabRow.slack_user_id,
                rule.name,
                `Tu VoBo para la 1:1 del ${meetingDate} con ${escapeHtml(leaderName)} está pendiente.`,
                voboUrl,
              )
              delivered = res.sent
              failedReason = res.error ?? (res.skipped ? 'SLACK_NOT_CONFIGURED' : null)
            } else {
              // Canal no aplicable para este colaborador en esta iteración.
              continue
            }

            await admin.from('notification_dispatches').insert({
              rule_id: rule.id,
              recipient_id: row.collaborator_id,
              channel,
              context: {
                trigger: rule.trigger_type,
                rule_name: rule.name,
                one_on_one_id: row.id,
              },
              status: delivered ? 'sent' : 'failed',
              failed_reason: failedReason,
              delivered_at: delivered ? new Date().toISOString() : null,
            })
            if (delivered) totalDispatched++
          }

          // Quitar al colaborador del set para evitar doble-envío en el bucle genérico.
          recipients.delete(row.collaborator_id)
        }
        break
      }

      case 'calidez_baja': {
        // Consulta la vista `warmth_metrics_by_leader` para líderes cuyo
        // avg_overall esté por debajo del threshold (default: 3 sobre 5).
        const thresholdScore =
          typeof rule.threshold?.value === 'number' ? rule.threshold.value : 3

        const { data: lowWarmth } = await admin
          .from('warmth_metrics_by_leader')
          .select('leader_id, avg_overall')
          .lt('avg_overall', thresholdScore)
        const warmthRows = (lowWarmth ?? []) as Array<{
          leader_id: string
          avg_overall: number | null
        }>

        if (audience.has('leader')) {
          for (const r of warmthRows) recipients.add(r.leader_id)
        }
        if (audience.has('hr')) {
          for (const id of await getHrUserIds()) recipients.add(id)
        }
        break
      }

      case 'reminder_pre_1to1': {
        // Busca 1:1s con scheduled_at en la ventana de anticipación configurable.
        // Default: ventana de las próximas 24 horas.
        const windowHours =
          typeof rule.threshold?.value === 'number' ? rule.threshold.value : 24
        const now = new Date()
        const windowEnd = new Date(now.getTime() + windowHours * 60 * 60 * 1000)

        const { data: upcoming } = await admin
          .from('one_on_ones')
          .select('id, leader_id, collaborator_id, scheduled_at, modality, location, meet_link')
          .eq('status', 'agendada')
          .gte('scheduled_at', now.toISOString())
          .lte('scheduled_at', windowEnd.toISOString())
        const meetingRows = (upcoming ?? []) as Array<{
          id: string
          leader_id: string
          collaborator_id: string
          scheduled_at: string
          modality: string
          location: string | null
          meet_link: string | null
        }>

        // Notificar tanto al líder como al colaborador.
        for (const row of meetingRows) {
          if (audience.has('leader')) recipients.add(row.leader_id)
          if (audience.has('collaborator')) recipients.add(row.collaborator_id)
        }
        if (audience.has('hr')) {
          for (const id of await getHrUserIds()) recipients.add(id)
        }

        // Envío temprano con template MeetingReminderEmail para líder y colaborador.
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
        for (const row of meetingRows) {
          const participants: Array<{ userId: string; isLeader: boolean }> = []
          if (audience.has('leader')) participants.push({ userId: row.leader_id, isLeader: true })
          if (audience.has('collaborator')) participants.push({ userId: row.collaborator_id, isLeader: false })

          for (const { userId, isLeader } of participants) {
            const { data: recipUser } = await admin
              .from('users')
              .select('id, email, full_name, slack_user_id, role')
              .eq('id', userId)
              .single<RecipientRow>()
            if (!recipUser) continue

            const partnerId = isLeader ? row.collaborator_id : row.leader_id
            const { data: partnerRow } = await admin
              .from('users')
              .select('full_name')
              .eq('id', partnerId)
              .single<{ full_name: string | null }>()
            const partnerName = partnerRow?.full_name ?? ''

            const scheduledDate = new Date(row.scheduled_at)
            const meetingDate = scheduledDate.toLocaleDateString('es-MX', {
              day: '2-digit', month: 'long', year: 'numeric',
            })
            const meetingTime = scheduledDate.toLocaleTimeString('es-MX', {
              hour: '2-digit', minute: '2-digit',
            })
            const deepLink = isLeader ? '/lider' : '/colaborador'

            for (const channel of rule.channels) {
              let delivered = false
              let failedReason: string | null = null

              if (channel === 'in_app') {
                const { error } = await admin.from('notifications').insert({
                  user_id: userId,
                  channel: 'in_app',
                  title: `[${rule.name}]`,
                  content: `Tu 1:1 con ${partnerName} es hoy a las ${meetingTime}.`,
                  link: `${deepLink}`,
                })
                delivered = !error
                failedReason = error?.message ?? null
              } else if (channel === 'email' && recipUser.email) {
                const html = meetingReminderHtml({
                  recipientName: recipUser.full_name ?? '',
                  partnerName,
                  meetingDate,
                  meetingTime,
                  modality: row.modality as 'virtual' | 'presencial',
                  meetLink: row.meet_link ?? undefined,
                  location: row.location ?? undefined,
                })
                const res = await notifyByEmail({
                  to: [recipUser.email],
                  subject: `[1to1] Recordatorio: 1:1 hoy a las ${meetingTime}`,
                  html,
                  recipientRole: recipUser.role,
                })
                delivered = res.sent
                failedReason = res.error ?? (res.skipped ? 'EMAIL_NOT_CONFIGURED' : null)
              } else if (channel === 'slack' && recipUser.slack_user_id) {
                const meetUrl = row.meet_link ?? `${appUrl}${deepLink}`
                const res = await notifySlackGeneric(
                  recipUser.slack_user_id,
                  rule.name,
                  `Tu 1:1 con ${escapeHtml(partnerName)} es hoy a las ${meetingTime}.`,
                  meetUrl,
                )
                delivered = res.sent
                failedReason = res.error ?? (res.skipped ? 'SLACK_NOT_CONFIGURED' : null)
              } else {
                continue
              }

              await admin.from('notification_dispatches').insert({
                rule_id: rule.id,
                recipient_id: userId,
                channel,
                context: {
                  trigger: rule.trigger_type,
                  rule_name: rule.name,
                  one_on_one_id: row.id,
                },
                status: delivered ? 'sent' : 'failed',
                failed_reason: failedReason,
                delivered_at: delivered ? new Date().toISOString() : null,
              })
              if (delivered) totalDispatched++
            }

            // Quitar del set genérico para evitar doble-envío.
            recipients.delete(userId)
          }
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
        // Fase 7.A — opt-out granular: consultar notification_preferences.
        // Si el usuario desactivó este trigger_type × channel, omitir.
        // Si no existe row, asumir habilitado (default opt-in).
        const { data: pref } = await admin
          .from('notification_preferences')
          .select('enabled')
          .eq('user_id', recipientId)
          .eq('trigger_type', rule.trigger_type)
          .eq('channel', channel)
          .maybeSingle()
        if (pref && pref.enabled === false) continue

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

        // Persistimos failed_reason/delivered_at (migración 31) para que la
        // matriz de RH muestre el estado real de entrega, no solo sent/failed.
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
  // los reportes programados. Cada sub-job AISLADO: un fallo se reporta a Sentry
  // y no tumba a los demás. Sus rutas standalone quedan para trigger manual.
  // Ver vercel.json y docs/architecture.md.
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
