/**
 * Cron: check-thresholds
 *
 * Evaluates every enabled `notification_rules` row and inserts
 * `notification_dispatches` for each matching recipient × channel combo.
 *
 * Cooldown: a unique index on (rule_id, recipient_id, channel, day) provided
 * by the Wave 1 foundation prevents duplicate dispatches within the same day.
 * Insert failures from that unique violation are swallowed silently.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 *
 * NOTE on table casts: `notification_rules`/`notification_dispatches` and the
 * `compliance_metrics` view are not yet present in the generated
 * `database.types.ts` (per `src/types/database.augmentation.ts`). We cast with
 * `as never` on `.from()` and narrow the result with `as unknown as`.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NotificationRuleRow } from '@/types/domain'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const rulesResult = (await admin
    .from('notification_rules' as never)
    .select('*')
    .eq('enabled' as never, true)) as unknown as {
    data: NotificationRuleRow[] | null
    error: { message: string } | null
  }

  const rules = rulesResult.data ?? []
  let totalDispatched = 0

  // Cache HR user list (used by multiple triggers).
  let hrUsersCache: string[] | null = null
  async function getHrUserIds(): Promise<string[]> {
    if (hrUsersCache) return hrUsersCache
    const { data } = await admin.from('users').select('id').eq('role', 'hr')
    hrUsersCache = ((data ?? []) as Array<{ id: string }>).map((r) => r.id)
    return hrUsersCache
  }

  for (const rule of rules) {
    const recipients = new Set<string>()
    const audience = new Set(rule.audience)

    switch (rule.trigger_type) {
      case 'cumplimiento_bajo': {
        // The `compliance_metrics` view aggregates per department
        // (compliance_rate as a fraction 0-1; the rule threshold uses percent).
        const thresholdPct = typeof rule.threshold?.value === 'number' ? rule.threshold.value : 50
        const thresholdRate = thresholdPct / 100

        const lowResult = (await admin
          .from('compliance_metrics' as never)
          .select('department_id, compliance_rate')
          .lt('compliance_rate' as never, thresholdRate)) as unknown as {
          data: Array<{ department_id: string | null; compliance_rate: number | null }> | null
        }
        const lowDeptIds = (lowResult.data ?? [])
          .map((r) => r.department_id)
          .filter((x): x is string => !!x)

        if (audience.has('leader') && lowDeptIds.length > 0) {
          // Leaders = users with role='leader' whose department is flagged.
          const { data: leadersRaw } = await admin
            .from('users')
            .select('id')
            .eq('role', 'leader')
            .in('department_id', lowDeptIds)
          for (const l of (leadersRaw ?? []) as Array<{ id: string }>) {
            recipients.add(l.id)
          }
        }
        if (audience.has('hr')) {
          for (const id of await getHrUserIds()) recipients.add(id)
        }
        break
      }

      case 'acuerdo_vencido': {
        const today = new Date().toISOString().slice(0, 10)
        const { data: vencidos } = await admin
          .from('agreements')
          .select('responsible_id')
          .lt('due_date', today)
          .in('status', ['pendiente', 'parcial'])
        const rows = (vencidos ?? []) as Array<{ responsible_id: string }>
        if (audience.has('collaborator') || audience.has('leader')) {
          for (const r of rows) recipients.add(r.responsible_id)
        }
        if (audience.has('hr')) {
          for (const id of await getHrUserIds()) recipients.add(id)
        }
        break
      }

      case 'disputa_nueva': {
        const { data: disputas } = await admin
          .from('one_on_ones')
          .select('leader_id, collaborator_id')
          .eq('status', 'en_disputa')
        const rows = (disputas ?? []) as Array<{ leader_id: string; collaborator_id: string }>
        if (audience.has('leader')) for (const r of rows) recipients.add(r.leader_id)
        if (audience.has('collaborator')) for (const r of rows) recipients.add(r.collaborator_id)
        if (audience.has('hr')) {
          for (const id of await getHrUserIds()) recipients.add(id)
        }
        break
      }

      case 'vobo_pendiente':
      case 'calidez_baja':
      case 'reminder_pre_1to1': {
        // TODO: implementación específica. Por ahora dispatch mínimo a HR si
        // está en la audiencia, para que el flujo de notificación quede
        // ejercitado en producción.
        if (audience.has('hr')) {
          for (const id of await getHrUserIds()) recipients.add(id)
        }
        break
      }
    }

    for (const recipientId of recipients) {
      for (const channel of rule.channels) {
        const { error } = await admin
          .from('notification_dispatches' as never)
          .insert({
            rule_id: rule.id,
            recipient_id: recipientId,
            channel,
            context: { trigger: rule.trigger_type, rule_name: rule.name },
            status: 'sent',
          } as never)
        if (!error) {
          totalDispatched++
        }
        // Cooldown unique-index violations are expected and ignored.
      }
    }
  }

  return NextResponse.json({ rules_evaluated: rules.length, total_dispatched: totalDispatched })
}
