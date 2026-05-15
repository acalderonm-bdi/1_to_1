'use server'

/**
 * Server actions para CRUD de `scheduled_reports` (Pack 3).
 *
 * - `createScheduledReport` valida con zod, calcula `next_run_at` via
 *   cron-parser y mete la fila bajo RLS HR (`requireHR()`).
 * - `toggleScheduledReport` flippea `enabled`.
 * - `deleteScheduledReport` borra.
 * - `runReportNow` genera el CSV y registra dispatches a
 *   `notification_dispatches` (canal `email`). El envío real queda en
 *   stub (console.log) hasta que se integre Resend/SMTP — la tabla
 *   queda con el audit trail.
 *
 * Notas de tipos:
 *   - `cron-parser` v5 expone `CronExpressionParser.parse(expr).next()`
 *     que devuelve un `CronDate` con `.toISOString()`.
 */

import { revalidatePath } from 'next/cache'

import { CronExpressionParser } from 'cron-parser'
import { z } from 'zod'

import { requireHR } from '@/lib/auth-guards'
import type { ActionResult, ScheduledReportType } from '@/types/domain'

const scheduleSchema = z.object({
  name: z.string().min(1).max(100),
  reportType: z.enum([
    'cumplimiento_mensual',
    'acuerdos_baja_calidad',
    'calidez_por_lider',
  ]),
  scheduleCron: z.string().min(1).max(120),
  recipients: z.array(z.string().email()).min(1).max(50),
  filters: z.record(z.unknown()).optional(),
})

export type ScheduledReportInput = z.infer<typeof scheduleSchema>

function computeNextRun(cronExpr: string): string {
  const expr = CronExpressionParser.parse(cronExpr)
  const iso = expr.next().toISOString()
  if (!iso) throw new Error('cron-parser devolvió una fecha inválida')
  return iso
}

export async function createScheduledReport(
  input: ScheduledReportInput,
): Promise<ActionResult<{ id: string }>> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }

  const parsed = scheduleSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  let nextRun: string
  try {
    nextRun = computeNextRun(parsed.data.scheduleCron)
  } catch {
    return { success: false, error: 'Cron expression inválida' }
  }

  const insertResult = await guard.supabase
    .from('scheduled_reports')
    .insert({
      name: parsed.data.name,
      report_type: parsed.data.reportType,
      schedule_cron: parsed.data.scheduleCron,
      recipients: parsed.data.recipients,
      filters: parsed.data.filters ?? null,
      next_run_at: nextRun,
      created_by: guard.user.id,
    })
    .select('id')
    .single()

  if (insertResult.error || !insertResult.data) {
    return {
      success: false,
      error: insertResult.error?.message ?? 'No se pudo crear',
    }
  }

  revalidatePath('/arquitectura-humana/exportes')
  return { success: true, data: { id: insertResult.data.id } }
}

export async function toggleScheduledReport(
  id: string,
  enabled: boolean,
): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: 'ID inválido' }
  }

  const { error } = await guard.supabase
    .from('scheduled_reports')
    .update({ enabled })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/arquitectura-humana/exportes')
  return { success: true }
}

export async function deleteScheduledReport(id: string): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: 'ID inválido' }
  }

  const { error } = await guard.supabase
    .from('scheduled_reports')
    .delete()
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/arquitectura-humana/exportes')
  return { success: true }
}

export async function runReportNow(
  id: string,
): Promise<ActionResult<{ dispatched: number }>> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: 'ID inválido' }
  }

  const reportResult = await guard.supabase
    .from('scheduled_reports')
    .select('id, name, report_type, recipients, schedule_cron')
    .eq('id', id)
    .single()

  if (reportResult.error || !reportResult.data) {
    return {
      success: false,
      error: reportResult.error?.message ?? 'Reporte no encontrado',
    }
  }

  // `report_type` is a string column at the DB level; the domain narrowing to
  // `ScheduledReportType` is enforced by the zod schema on write.
  const report = reportResult.data as typeof reportResult.data & {
    report_type: ScheduledReportType
  }

  // Generar el CSV correspondiente.
  let csv: { filename: string; content: string }
  try {
    if (report.report_type === 'cumplimiento_mensual') {
      csv = await (
        await import('@/lib/exports/cumplimiento-csv')
      ).generateCumplimientoCSV()
    } else if (report.report_type === 'acuerdos_baja_calidad') {
      csv = await (await import('@/lib/exports/acuerdos-csv')).generateAcuerdosCSV()
    } else {
      csv = await (await import('@/lib/exports/calidez-csv')).generateCalidezCSV()
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error generando CSV'
    return { success: false, error: message }
  }

  // STUB email send — log + audit a notification_dispatches.
  // eslint-disable-next-line no-console
  console.log(
    `[scheduled-report] would send ${csv.filename} to ${report.recipients.join(', ')}`,
  )

  let dispatched = 0
  for (const recipient of report.recipients) {
    const { data: userRow } = await guard.supabase
      .from('users')
      .select('id')
      .eq('email', recipient)
      .maybeSingle()

    if (!userRow) continue

    const { error: insErr } = await guard.supabase
      .from('notification_dispatches')
      .insert({
        rule_id: null,
        recipient_id: userRow.id,
        channel: 'email',
        context: {
          scheduled_report_id: report.id,
          report_name: report.name,
          filename: csv.filename,
          manual_run: true,
        },
        status: 'sent',
      })

    if (!insErr) dispatched++
  }

  // Update last_run_at + recalcular next_run_at.
  let nextRun: string | null = null
  try {
    nextRun = computeNextRun(report.schedule_cron)
  } catch {
    /* schedule inválido — dejamos next_run_at en null para que no se relance */
  }

  await guard.supabase
    .from('scheduled_reports')
    .update({
      last_run_at: new Date().toISOString(),
      next_run_at: nextRun,
    })
    .eq('id', id)

  revalidatePath('/arquitectura-humana/exportes')
  return { success: true, data: { dispatched } }
}
