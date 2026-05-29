'use server'

import { requireHR } from '@/lib/auth-guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseOrgCsv, syncOrg, type SyncReport } from '@/lib/sync/org-sync'
import { logAudit } from '@/lib/utils/audit'
import type { ActionResult } from '@/types/domain'

/**
 * Preview (dry-run) del org-sync para RH: parsea el CSV y calcula el diff real
 * SIN escribir. Solo HR. Usa el admin client (service_role) para leer el estado.
 */
export async function previewOrgSync(csvText: string): Promise<ActionResult<SyncReport>> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  try {
    const rows = parseOrgCsv(csvText)
    const report = await syncOrg(createAdminClient(), rows, { dryRun: true })
    return { success: true, data: report }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'No se pudo procesar el CSV' }
  }
}

/**
 * Aplica el org-sync (escribe). Solo HR. Registra en audit_logs.
 *
 * Nota: para el PRIMER import masivo (~313 personas) conviene el CLI
 * `pnpm org-sync` (sin límite de tiempo serverless). Esta acción es ideal para
 * re-syncs incrementales (diffs chicos).
 */
export async function applyOrgSync(csvText: string): Promise<ActionResult<SyncReport>> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  try {
    const rows = parseOrgCsv(csvText)
    const report = await syncOrg(createAdminClient(), rows, { dryRun: false })
    if (report.validationErrors.length === 0) {
      await logAudit({
        userId: guard.user.id,
        action: 'org_sync_applied',
        resourceType: 'organization',
        metadata: {
          usersCreated: report.usersCreated,
          usersUpdated: report.usersUpdated,
          usersReactivated: report.usersReactivated,
          relationsCreated: report.relationsCreated,
          relationsClosed: report.relationsClosed,
          deactivated: report.deactivated.length,
        },
      })
    }
    return { success: true, data: report }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'No se pudo aplicar la sincronización' }
  }
}
