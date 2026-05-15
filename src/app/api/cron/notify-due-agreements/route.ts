import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const { data: dueTomorrow } = await admin
    .from('agreements')
    .select('id, description, responsible_id, users!agreements_responsible_id_fkey(full_name, role)')
    .eq('status', 'pendiente')
    .eq('due_date', tomorrowStr)

  // Link role-aware: colab → /colaborador/acuerdos; líder con acuerdo asignado → /lider/equipo
  function linkForResponsible(role: string | undefined): string {
    if (role === 'leader') return '/lider/equipo'
    if (role === 'hr') return '/arquitectura-humana'
    return '/colaborador/acuerdos'
  }

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

  return NextResponse.json({
    ok: true,
    notified: dueTomorrow?.length ?? 0,
    error: error?.message ?? null,
  })
}
