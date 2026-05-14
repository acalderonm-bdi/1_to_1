import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { suggestQuestions } from '@/lib/ai/suggest-questions'

const schema = z.object({
  collaboratorId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body: unknown = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const { collaboratorId } = parsed.data

  // Defense: solo el líder activo de ese colaborador (o HR) puede generar sugerencias
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()

  if (profile?.role !== 'hr') {
    const { data: rel } = await supabase
      .from('leadership_relations')
      .select('id')
      .eq('leader_id', user.id)
      .eq('collaborator_id', collaboratorId)
      .is('ended_at', null)
      .maybeSingle()
    if (!rel) return NextResponse.json({ error: 'Sin permisos para este colaborador' }, { status: 403 })
  }

  const { data: collaborator } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', collaboratorId)
    .single<{ full_name: string }>()

  const { data: recentMeetings } = await supabase
    .from('one_on_ones')
    .select('scheduled_at, agreements(description)')
    .eq('leader_id', user.id)
    .eq('collaborator_id', collaboratorId)
    .eq('status', 'realizada')
    .order('scheduled_at', { ascending: false })
    .limit(3)

  const { data: pending } = await supabase
    .from('agreements')
    .select('description, due_date, status')
    .eq('responsible_id', collaboratorId)
    .eq('status', 'pendiente')
    .limit(10)

  const result = await suggestQuestions({
    collaboratorName: collaborator?.full_name ?? 'Colaborador',
    recentMeetings: (recentMeetings ?? []).map((m) => ({
      date: m.scheduled_at as string,
      agreements: ((m.agreements as { description: string }[] | null) ?? []).map((a) => a.description),
    })),
    pendingAgreements: (pending ?? []).map((a) => ({
      description: a.description as string,
      dueDate: a.due_date as string | null,
      status: a.status as string,
    })),
  })

  return NextResponse.json(result)
}
