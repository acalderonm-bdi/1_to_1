/**
 * Tarea de cron: enviar los reportes programados (`scheduled_reports`) cuyo
 * `next_run_at` ya pasó. Genera el CSV, notifica al canal de RH en Slack
 * (best-effort) y registra dispatches en `notification_dispatches`.
 * Recalcula `next_run_at` con `cron-parser` v5.
 *
 * Lógica compartida entre la ruta standalone `/api/cron/send-scheduled-reports`
 * (trigger manual con CRON_SECRET) y el cron diario `check-thresholds`, que la
 * invoca porque el plan Hobby de Vercel solo permite 2 cron jobs agendados.
 *
 * Nota Hobby: al correr una vez al día, los reportes se entregan con
 * granularidad diaria. Reportes con cron sub-diario (p.ej. cada hora) solo
 * dispararán una vez al día. Requiere plan Pro para frecuencia real.
 */
import { CronExpressionParser } from 'cron-parser'

import { generateAcuerdosCSV } from '@/lib/exports/acuerdos-csv'
import { generateCalidezCSV } from '@/lib/exports/calidez-csv'
import { generateCumplimientoCSV } from '@/lib/exports/cumplimiento-csv'
import { notifyByEmail, escapeHtml } from '@/lib/email/notify'
import { notifyHRReport } from '@/lib/slack/notify'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { ScheduledReportType } from '@/types/domain'

type AdminClient = ReturnType<typeof createAdminClient>

interface DueReportRow {
  id: string
  name: string
  report_type: ScheduledReportType
  recipients: string[]
  schedule_cron: string
}

function safeNextRun(cronExpr: string): string | null {
  try {
    const iso = CronExpressionParser.parse(cronExpr).next().toISOString()
    return iso ?? null
  } catch {
    return null
  }
}

export async function runScheduledReports(
  admin: AdminClient,
): Promise<{ reports_processed: number; total_dispatched: number }> {
  const nowIso = new Date().toISOString()

  const dueResult = await admin
    .from('scheduled_reports')
    .select('id, name, report_type, recipients, schedule_cron')
    .eq('enabled', true)
    .lte('next_run_at', nowIso)

  // `report_type` is `string` in the generated types; narrow at the boundary
  // because writes are zod-validated against the `ScheduledReportType` union.
  const reports = (dueResult.data ?? []) as unknown as DueReportRow[]
  let totalDispatched = 0

  for (const report of reports) {
    let csv: { filename: string; content: string }
    try {
      if (report.report_type === 'cumplimiento_mensual') {
        csv = await generateCumplimientoCSV()
      } else if (report.report_type === 'acuerdos_baja_calidad') {
        csv = await generateAcuerdosCSV()
      } else {
        csv = await generateCalidezCSV()
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[cron-reports] CSV generation failed:', err)
      continue
    }

    // Slack al canal RH (best-effort). El helper hace skip si no hay
    // SLACK_BOT_TOKEN, y guardamos contra falla de la API.
    const slackChannel = process.env.SLACK_DEFAULT_CHANNEL
    if (slackChannel) {
      const lineCount = (csv.content.match(/\n/g)?.length ?? 1) - 1
      const summary = [
        `Archivo: \`${csv.filename}\` (${Math.max(lineCount, 0)} filas)`,
        `Destinatarios: ${report.recipients.join(', ')}`,
        `Descargar: <${process.env.NEXT_PUBLIC_APP_URL ?? ''}/arquitectura-humana/exportes|/arquitectura-humana/exportes>`,
      ].join('\n')
      const slackRes = await notifyHRReport(slackChannel, report.name, summary)
      if (!slackRes.sent && !slackRes.skipped) {
        // eslint-disable-next-line no-console
        console.warn(`[cron-reports] Slack notify falló: ${slackRes.error}`)
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const lineCount = (csv.content.match(/\n/g)?.length ?? 1) - 1
    const exportesUrl = `${appUrl}/arquitectura-humana/exportes`

    for (const recipient of report.recipients) {
      const { data: userRow } = await admin
        .from('users')
        .select('id')
        .eq('email', recipient)
        .maybeSingle()

      if (!userRow) continue

      // Envío real de email vía Resend. notifyByEmail hace skip silencioso si
      // RESEND_API_KEY o EMAIL_FROM no están configurados (dev/CI).
      const emailRes = await notifyByEmail({
        to: [recipient],
        subject: `[1to1] Reporte: ${report.name}`,
        html:
          `<p>Tu reporte programado "<strong>${escapeHtml(report.name)}</strong>" está listo.</p>` +
          `<p>Archivo: <code>${escapeHtml(csv.filename)}</code> (${Math.max(lineCount, 0)} filas)</p>` +
          `<p><a href="${exportesUrl}" style="background:#ED6134;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Ver en Exportes</a></p>`,
        recipientRole: 'hr',
      })

      const dispatchStatus = emailRes.sent ? 'sent' : emailRes.skipped ? 'skipped' : 'failed'
      const { error: insErr } = await admin
        .from('notification_dispatches')
        .insert({
          rule_id: null,
          recipient_id: userRow.id,
          channel: 'email',
          context: {
            scheduled_report_id: report.id,
            report_name: report.name,
            filename: csv.filename,
            cron_dispatch: true,
          },
          status: dispatchStatus,
        })

      if (!insErr && emailRes.sent) totalDispatched++
    }

    const nextRun = safeNextRun(report.schedule_cron)

    await admin
      .from('scheduled_reports')
      .update({
        last_run_at: nowIso,
        next_run_at: nextRun,
      })
      .eq('id', report.id)
  }

  return { reports_processed: reports.length, total_dispatched: totalDispatched }
}
