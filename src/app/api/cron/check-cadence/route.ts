/**
 * Cron: check-cadence — alarma del north star ("quién NO está haciendo 1:1s").
 *
 * Lee la vista `overdue_relations` (única fuente: computa la cadencia EFECTIVA
 * relation>dept>global e is_overdue) y entrega al líder por in_app + email
 * (Slack opcional). Antes esto: usaba solo la cadencia global, hacía N+1, y
 * descartaba ~100% de los avisos en silencio si el líder no tenía Slack.
 *
 * Dedupe: si el líder ya tiene un aviso in_app SIN LEER para esa misma 1:1
 * pendiente, no se re-notifica (evita spam diario hasta que agende o lo lea).
 *
 * Auth: assertCronAuth. La vista la consulta el admin client (service_role).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertCronAuth } from '@/lib/cron/auth'
import { notifyMissedMeeting } from '@/lib/slack/notify'
import { notifyByEmail, escapeHtml } from '@/lib/email/notify'

export async function GET(request: NextRequest) {
  const authErr = assertCronAuth(request)
  if (authErr) return authErr

  const admin = createAdminClient()

  const { data: overdue, error } = await admin
    .from('overdue_relations')
    .select(
      'relation_id, leader_id, leader_name, leader_email, leader_slack_user_id, collaborator_id, collaborator_name, days_since, cadence_days',
    )
    .eq('is_overdue', true)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  let notified = 0
  let skipped = 0

  for (const row of overdue ?? []) {
    // La vista tipa todo como nullable; sin estos ids no podemos notificar.
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

    const hasHistory = row.days_since != null
    const days = hasHistory ? row.days_since! : (row.cadence_days ?? 0)
    const colName = row.collaborator_name ?? 'tu colaborador'
    const title = hasHistory ? 'Sin reunión hace varios días' : 'Aún sin tu primera 1:1'
    const content = hasHistory
      ? `Han pasado ${days} días desde tu última 1:1 con ${colName}. Agenda la próxima.`
      : `Aún no has tenido una 1:1 con ${colName}. Agenda la primera.`

    // in_app (disponible para todos)
    await admin.from('notifications').insert({
      user_id: row.leader_id,
      channel: 'in_app',
      title,
      content,
      link: deepLink,
    })

    // email (todos tienen correo empresarial)
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

    // slack (opcional)
    if (row.leader_slack_user_id) {
      await notifyMissedMeeting(row.leader_slack_user_id, row.leader_name ?? '', colName, days, row.collaborator_id)
    }

    notified++
  }

  return NextResponse.json({ ok: true, overdue: overdue?.length ?? 0, notified, skipped })
}
