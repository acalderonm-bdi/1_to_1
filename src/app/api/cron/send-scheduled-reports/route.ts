/**
 * Cron: send-scheduled-reports (hourly).
 *
 * Vercel cron en `vercel.json` `0 * * * *`. Selecciona los reports
 * habilitados cuyo `next_run_at <= now()`, genera el CSV, hace un
 * stub-send a los recipients y registra dispatches en
 * `notification_dispatches` (`channel = 'email'`, `rule_id = null`).
 * Recalcula `next_run_at` con `cron-parser` v5 (`CronExpressionParser.parse`).
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (mismo patrón que
 * `check-thresholds`). Usa `createAdminClient` para bypass RLS,
 * idéntico al cron de notificaciones.
 *
 */
import { NextResponse, type NextRequest } from 'next/server'

import { CronExpressionParser } from 'cron-parser'

import { generateAcuerdosCSV } from '@/lib/exports/acuerdos-csv'
import { generateCalidezCSV } from '@/lib/exports/calidez-csv'
import { generateCumplimientoCSV } from '@/lib/exports/cumplimiento-csv'
import { notifyHRReport } from '@/lib/slack/notify'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ScheduledReportType } from '@/types/domain'

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

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
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

    // eslint-disable-next-line no-console
    console.log(
      `[cron-reports] would send ${csv.filename} to ${report.recipients.join(', ')}`,
    )

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

    for (const recipient of report.recipients) {
      const { data: userRow } = await admin
        .from('users')
        .select('id')
        .eq('email', recipient)
        .maybeSingle()

      if (!userRow) continue

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
          status: 'sent',
        })

      if (!insErr) totalDispatched++
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

  return NextResponse.json({
    reports_processed: reports.length,
    total_dispatched: totalDispatched,
  })
}
