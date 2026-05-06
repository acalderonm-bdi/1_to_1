import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzePatterns } from '@/lib/ai/analyze-patterns'
import { z } from 'zod'

const schema = z.object({
  leaderId: z.string().uuid(),
  collaboratorId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Solo RH puede solicitar análisis de patrones
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'hr') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const body: unknown = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const admin = createAdminClient()
  const { leaderId, collaboratorId } = parsed.data

  const [
    { data: meetings },
    { data: agreements },
    { data: relation },
  ] = await Promise.all([
    admin.from('one_on_ones').select('id, status, scheduled_at').eq('leader_id', leaderId).eq('collaborator_id', collaboratorId),
    admin.from('agreements').select('description, status').in(
      'one_on_one_id',
      (await admin.from('one_on_ones').select('id').eq('leader_id', leaderId).eq('collaborator_id', collaboratorId)).data?.map(m => m.id) ?? []
    ),
    admin.from('leadership_relations').select('started_at').eq('leader_id', leaderId).eq('collaborator_id', collaboratorId).is('ended_at', null).single(),
  ])

  const startDate = relation?.started_at ? new Date(relation.started_at) : new Date()
  const monthsDiff = Math.max(1, Math.round((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))

  const result = await analyzePatterns({
    relationshipMonths: monthsDiff,
    totalMeetings: meetings?.length ?? 0,
    missedMeetings: meetings?.filter(m => m.status === 'no_realizada').length ?? 0,
    disputedMeetings: meetings?.filter(m => m.status === 'en_disputa').length ?? 0,
    agreements: (agreements ?? []).map(a => ({ description: a.description, status: a.status })),
    recentHistory: `Últimas ${Math.min(meetings?.length ?? 0, 5)} reuniones registradas`,
  })

  return NextResponse.json(result)
}
