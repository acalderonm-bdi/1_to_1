/**
 * CSV generator: cumplimiento por departamento.
 *
 * Lee la vista `compliance_metrics` (definida en Wave 0/F4) que agrega
 * por departamento los conteos de 1:1s y acuerdos. Devuelve un CSV con
 * BOM UTF-8 (para que Excel detecte encoding y los caracteres con tilde
 * se vean bien).
 *
 * Server-only: usa el client SSR de Supabase (`@/lib/supabase/server`)
 * y queda detrás del `requireHR()` del endpoint que lo invoca.
 */
import { createClient } from '@/lib/supabase/server'

export interface CSVResult {
  filename: string
  content: string
}

const BOM = '﻿'

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function generateCumplimientoCSV(): Promise<CSVResult> {
  const supabase = createClient()

  // La vista `compliance_metrics` aparece en database.types (Views) con
  // los siguientes campos: department_id, department_name,
  // total_meetings, realized_meetings, missed_meetings, disputed_meetings,
  // total_agreements, fulfilled_agreements, unfulfilled_agreements,
  // compliance_rate.
  const { data } = (await supabase
    .from('compliance_metrics')
    .select(
      'department_id, department_name, total_meetings, realized_meetings, missed_meetings, disputed_meetings, compliance_rate',
    )
    .order('compliance_rate', { ascending: true })) as unknown as {
    data: Array<{
      department_id: string | null
      department_name: string | null
      total_meetings: number | null
      realized_meetings: number | null
      missed_meetings: number | null
      disputed_meetings: number | null
      compliance_rate: number | null
    }> | null
  }

  const rows = data ?? []

  const header =
    'departamento,reuniones_totales,realizadas,no_realizadas,en_disputa,cumplimiento_pct'

  const body = rows
    .map((r) => {
      const dept = csvEscape(r.department_name ?? 'Sin departamento')
      const total = r.total_meetings ?? 0
      const realized = r.realized_meetings ?? 0
      const missed = r.missed_meetings ?? 0
      const disputed = r.disputed_meetings ?? 0
      const rate = r.compliance_rate ?? 0
      // La view ya emite compliance_rate como porcentaje (0-100) en otros
      // consumidores (mapa-calor lo usa directo con umbrales 80/60/40).
      // Mantenemos el formato con 2 decimales.
      const pct = Number(rate).toFixed(2)
      return `${dept},${total},${realized},${missed},${disputed},${pct}`
    })
    .join('\n')

  const content = `${BOM}${header}\n${body}${body ? '\n' : ''}`

  return {
    filename: `cumplimiento-${todayISO()}.csv`,
    content,
  }
}
