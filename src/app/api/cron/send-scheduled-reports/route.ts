/**
 * Ruta cron: send-scheduled-reports (trigger manual).
 *
 * NO está agendada en `vercel.json` (plan Hobby permite solo 2 crons). La
 * lógica vive en `runScheduledReports` y el cron diario `check-thresholds`
 * la dispara a diario (granularidad diaria; ver nota en el módulo). Esta ruta
 * queda para invocación manual con `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse, type NextRequest } from 'next/server'

import { runScheduledReports } from '@/lib/cron/scheduled-reports'
import { assertCronAuth } from '@/lib/cron/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const authErr = assertCronAuth(request)
  if (authErr) return authErr

  const admin = createAdminClient()
  const result = await runScheduledReports(admin)

  return NextResponse.json(result)
}
