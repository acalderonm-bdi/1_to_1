import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractAgreements } from '@/lib/ai/extract-agreements'
import { z } from 'zod'

const schema = z.object({
  oneOnOneId: z.string().uuid(),
  rawContent: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body: unknown = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const { oneOnOneId, rawContent } = parsed.data

  // Obtener participantes
  const { data: meeting } = await supabase
    .from('one_on_ones')
    .select(`
      leader_id, collaborator_id,
      leader:users!one_on_ones_leader_id_fkey(full_name, email),
      collaborator:users!one_on_ones_collaborator_id_fkey(full_name, email)
    `)
    .eq('id', oneOnOneId)
    .or(`leader_id.eq.${user.id},collaborator_id.eq.${user.id}`)
    .single()

  if (!meeting) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const leader = Array.isArray(meeting.leader) ? meeting.leader[0] : meeting.leader
  const collaborator = Array.isArray(meeting.collaborator) ? meeting.collaborator[0] : meeting.collaborator

  if (!leader || !collaborator) {
    return NextResponse.json({ agreements: [], error: 'No se encontraron participantes' })
  }

  const result = await extractAgreements({
    rawMinute: rawContent,
    leader: { name: leader.full_name, email: leader.email },
    collaborator: { name: collaborator.full_name, email: collaborator.email },
  })

  return NextResponse.json(result)
}
