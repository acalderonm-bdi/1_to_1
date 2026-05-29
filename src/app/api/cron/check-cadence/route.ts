/**
 * Cron: check-cadence — alarma del north star ("quién NO está haciendo 1:1s").
 *
 * Ruta standalone (trigger manual). La lógica vive en `runCadenceCheck` y el
 * cron diario `check-thresholds` la dispara plegada (plan Hobby = 2 crons).
 *
 * Auth: assertCronAuth.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertCronAuth } from '@/lib/cron/auth'
import { runCadenceCheck } from '@/lib/cron/cadence'

export async function GET(request: NextRequest) {
  const authErr = assertCronAuth(request)
  if (authErr) return authErr

  const result = await runCadenceCheck(createAdminClient())
  return NextResponse.json({ ok: !result.error, ...result }, { status: result.error ? 500 : 200 })
}
