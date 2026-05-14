/**
 * CSV generator: acuerdos con responsable, líder, due_date, status,
 * score IA.
 *
 * Lee `agreements` con joins a `users` (responsible) y `one_on_ones`
 * (leader). Las columnas `ai_quality_score`/`ai_quality_warnings` se
 * agregaron en la migración 16 pero todavía no aparecen en
 * `database.types.ts`, por eso casteamos el resultado con `as unknown as`
 * para tipar las nuevas columnas.
 *
 * Server-only: usa el client SSR y queda detrás de `requireHR()`.
 */
import { createClient } from '@/lib/supabase/server'

import type { CSVResult } from './cumplimiento-csv'

const BOM = '﻿'

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface AgreementRow {
  id: string
  description: string
  due_date: string | null
  status: string
  ai_quality_score: number | null
  created_at: string
  responsible: { full_name: string } | { full_name: string }[] | null
  one_on_one: {
    leader: { full_name: string } | { full_name: string }[] | null
  } | Array<{
    leader: { full_name: string } | { full_name: string }[] | null
  }> | null
}

function pickName(
  v: { full_name: string } | { full_name: string }[] | null | undefined,
): string {
  if (!v) return ''
  if (Array.isArray(v)) return v[0]?.full_name ?? ''
  return v.full_name ?? ''
}

export async function generateAcuerdosCSV(): Promise<CSVResult> {
  const supabase = createClient()

  const { data } = (await supabase
    .from('agreements')
    .select(`
      id,
      description,
      due_date,
      status,
      ai_quality_score,
      created_at,
      responsible:users!agreements_responsible_id_fkey(full_name),
      one_on_one:one_on_ones!agreements_one_on_one_id_fkey(
        leader:users!one_on_ones_leader_id_fkey(full_name)
      )
    `)
    .order('created_at', { ascending: false })) as unknown as {
    data: AgreementRow[] | null
  }

  const rows = data ?? []

  const header =
    'descripcion,responsable,lider,due_date,status,ai_quality_score,created_at'

  const body = rows
    .map((r) => {
      const desc = csvEscape(r.description ?? '')
      const responsable = csvEscape(pickName(r.responsible))
      const oneOnOne = Array.isArray(r.one_on_one) ? r.one_on_one[0] : r.one_on_one
      const lider = csvEscape(pickName(oneOnOne?.leader ?? null))
      const due = r.due_date ?? ''
      const status = csvEscape(r.status ?? '')
      const score = r.ai_quality_score == null ? '' : Number(r.ai_quality_score).toFixed(2)
      const created = r.created_at ?? ''
      return `${desc},${responsable},${lider},${due},${status},${score},${created}`
    })
    .join('\n')

  const content = `${BOM}${header}\n${body}${body ? '\n' : ''}`

  return {
    filename: `acuerdos-${todayISO()}.csv`,
    content,
  }
}
