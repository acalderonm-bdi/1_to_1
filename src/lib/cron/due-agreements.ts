/**
 * Tarea de cron: avisar (in-app) a los responsables de acuerdos que vencen MAÑANA.
 *
 * Lógica compartida entre la ruta standalone `/api/cron/notify-due-agreements`
 * (trigger manual con CRON_SECRET) y el cron diario `check-thresholds`, que la
 * invoca porque el plan Hobby de Vercel solo permite 2 cron jobs agendados.
 */
import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

/** Deep-link role-aware: colab → acuerdos; líder → equipo; HR → panel. */
function linkForResponsible(role: string | undefined): string {
  if (role === 'leader') return '/lider/equipo'
  if (role === 'hr') return '/arquitectura-humana'
  return '/colaborador/acuerdos'
}

export async function runDueAgreementsNotifications(
  admin: AdminClient,
): Promise<{ notified: number; error: string | null }> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const { data: dueTomorrow } = await admin
    .from('agreements')
    .select('id, description, responsible_id, users!agreements_responsible_id_fkey(full_name, role)')
    .eq('status', 'pendiente')
    .eq('due_date', tomorrowStr)

  const { error } = await admin.from('notifications').insert(
    (dueTomorrow ?? []).map((agr) => {
      const userRel = (agr as { users?: { role?: string } | { role?: string }[] }).users
      const role = Array.isArray(userRel) ? userRel[0]?.role : userRel?.role
      return {
        user_id: agr.responsible_id,
        channel: 'in_app' as const,
        title: 'Acuerdo por vencer',
        content: `Tu acuerdo "${agr.description}" vence mañana`,
        link: linkForResponsible(role),
      }
    }),
  )

  return { notified: dueTomorrow?.length ?? 0, error: error?.message ?? null }
}
