/**
 * Tarea de cron: alarma de cadencia ("quién NO está haciendo 1:1s").
 *
 * Lógica compartida entre la ruta standalone `/api/cron/check-cadence` (trigger
 * manual) y el cron diario `check-thresholds`, que la dispara plegada (plan
 * Hobby = 2 crons agendables). Lee `overdue_relations` (cadencia efectiva +
 * is_overdue en SQL) y entrega al líder por in_app + email (Slack opcional),
 * con dedupe por aviso in_app sin leer.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { notifyMissedMeeting } from '@/lib/slack/notify'
import { notifyByEmail, escapeHtml } from '@/lib/email/notify'

type AdminClient = SupabaseClient<Database>

export interface CadenceResult {
  overdue: number
  notified: number
  skipped: number
  error?: string
}

/**
 * Construye el aviso de cadencia (pura, testeable). `daysSince === null` =
 * nunca tuvieron 1:1 → mensaje de "primera"; si no, "hace N días".
 */
export function cadenceMessage(
  daysSince: number | null,
  cadenceDays: number,
  collaboratorName: string,
): { title: string; content: string; days: number } {
  const colName = collaboratorName || 'tu colaborador'
  if (daysSince == null) {
    return {
      days: cadenceDays,
      title: 'Aún sin tu primera 1:1',
      content: `Aún no has tenido una 1:1 con ${colName}. Agenda la primera.`,
    }
  }
  return {
    days: daysSince,
    title: 'Sin reunión hace varios días',
    content: `Han pasado ${daysSince} días desde tu última 1:1 con ${colName}. Agenda la próxima.`,
  }
}

export async function runCadenceCheck(admin: AdminClient): Promise<CadenceResult> {
  const { data: overdue, error } = await admin
    .from('overdue_relations')
    .select(
      'relation_id, leader_id, leader_name, leader_email, leader_slack_user_id, collaborator_id, collaborator_name, days_since, cadence_days',
    )
    .eq('is_overdue', true)

  if (error) return { overdue: 0, notified: 0, skipped: 0, error: error.message }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  let notified = 0
  let skipped = 0

  for (const row of overdue ?? []) {
    if (!row.leader_id || !row.collaborator_id) continue
    const deepLink = `/lider/1to1/nueva?colab=${row.collaborator_id}`

    // Cooldown: aviso in_app sin leer pendiente para esta misma 1:1 → no repetir.
    const { data: pending } = await admin
      .from('notifications')
      .select('id')
      .eq('user_id', row.leader_id)
      .eq('link', deepLink)
      .eq('read', false)
      .limit(1)
      .maybeSingle()
    if (pending) { skipped++; continue }

    const colName = row.collaborator_name ?? 'tu colaborador'
    const { title, content, days } = cadenceMessage(row.days_since, row.cadence_days ?? 0, row.collaborator_name ?? '')

    await admin.from('notifications').insert({
      user_id: row.leader_id, channel: 'in_app', title, content, link: deepLink,
    })

    if (row.leader_email) {
      await notifyByEmail({
        to: [row.leader_email],
        subject: `[1to1] ${title} — ${colName}`,
        html:
          `<p>Hola ${escapeHtml(row.leader_name ?? '')}, ${escapeHtml(content)}</p>` +
          `<p><a href="${appUrl}${deepLink}" style="background:#ED6134;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Agendar 1:1</a></p>`,
        recipientRole: 'leader',
      })
    }
    if (row.leader_slack_user_id) {
      await notifyMissedMeeting(row.leader_slack_user_id, row.leader_name ?? '', colName, days, row.collaborator_id)
    }
    notified++
  }

  return { overdue: overdue?.length ?? 0, notified, skipped }
}
