/**
 * Ruta cron: notify-due-agreements (trigger manual).
 *
 * NO está agendada en `vercel.json` (plan Hobby permite solo 2 crons). La
 * lógica vive en `runDueAgreementsNotifications` y el cron diario
 * `check-thresholds` la dispara a diario. Esta ruta queda para invocación
 * manual con `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse, type NextRequest } from 'next/server'

import { runDueAgreementsNotifications } from '@/lib/cron/due-agreements'
import { assertCronAuth } from '@/lib/cron/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const authErr = assertCronAuth(request)
  if (authErr) return authErr

  const admin = createAdminClient()
  const result = await runDueAgreementsNotifications(admin)

  return NextResponse.json({ ok: true, ...result })
}
