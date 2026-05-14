/**
 * CSV generator: calidez por líder.
 *
 * Lee la vista `warmth_metrics_by_leader` (definida en migración 17).
 * La vista no expone el nombre del líder (sólo `leader_id`), así que
 * hacemos un lookup separado contra `users` para resolver `full_name`.
 *
 * La vista no está en `database.types.ts` (aún), por eso casteamos con
 * `as never` / `as unknown as`.
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

function fmtAvg(n: number | null | undefined): string {
  if (n == null) return ''
  return Number(n).toFixed(2)
}

export async function generateCalidezCSV(): Promise<CSVResult> {
  const supabase = createClient()

  const byLeaderQuery = (await supabase
    .from('warmth_metrics_by_leader' as never)
    .select(
      'leader_id, response_count, avg_overall, avg_felt_heard, avg_comfortable_sharing, avg_leader_engaged, avg_conversation_quality, avg_clarity_after_session',
    )
    .order('avg_overall' as never, { ascending: true })) as unknown as {
    data: Array<{
      leader_id: string
      response_count: number
      avg_overall: number | null
      avg_felt_heard: number | null
      avg_comfortable_sharing: number | null
      avg_leader_engaged: number | null
      avg_conversation_quality: number | null
      avg_clarity_after_session: number | null
    }> | null
  }

  const rows = byLeaderQuery.data ?? []
  const leaderIds = rows.map((r) => r.leader_id)

  const nameMap = new Map<string, string>()
  if (leaderIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', leaderIds)
    for (const u of (users ?? []) as Array<{ id: string; full_name: string }>) {
      nameMap.set(u.id, u.full_name)
    }
  }

  const header =
    'lider,respuestas,promedio_general,me_senti_escuchado,comodo_compartiendo,lider_comprometido,calidad_conversacion,claridad_final'

  const body = rows
    .map((r) => {
      const leader = csvEscape(nameMap.get(r.leader_id) ?? 'Sin nombre')
      return [
        leader,
        r.response_count ?? 0,
        fmtAvg(r.avg_overall),
        fmtAvg(r.avg_felt_heard),
        fmtAvg(r.avg_comfortable_sharing),
        fmtAvg(r.avg_leader_engaged),
        fmtAvg(r.avg_conversation_quality),
        fmtAvg(r.avg_clarity_after_session),
      ].join(',')
    })
    .join('\n')

  const content = `${BOM}${header}\n${body}${body ? '\n' : ''}`

  return {
    filename: `calidez-${todayISO()}.csv`,
    content,
  }
}
