'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deriveStatusFromVobos } from '@/lib/meetings/status'
import type { ActionResult } from '@/types/domain'

const voboSchema = z.object({
  oneOnOneId: z.string().uuid(),
  confirmed: z.boolean(),
})

export async function submitVobo(
  input: z.infer<typeof voboSchema>
): Promise<ActionResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = voboSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  // Verificar que el usuario es participante
  const { data: meeting } = await supabase
    .from('one_on_ones')
    .select('id, leader_id, collaborator_id, status')
    .eq('id', parsed.data.oneOnOneId)
    .or(`leader_id.eq.${user.id},collaborator_id.eq.${user.id}`)
    .maybeSingle()

  if (!meeting) return { success: false, error: 'No tienes permiso para esta 1:1' }

  // Gate F6: el VoBo del colaborador requiere haber respondido la encuesta de calidez.
  if (parsed.data.confirmed && (meeting as { collaborator_id: string }).collaborator_id === user.id) {
    const warmthQuery = await supabase
      .from('meeting_warmth_responses')
      .select('id', { count: 'exact', head: true })
      .eq('one_on_one_id', parsed.data.oneOnOneId)
      .eq('collaborator_id', user.id)

    if (!warmthQuery.count || warmthQuery.count === 0) {
      return {
        success: false,
        error: 'Completá la encuesta de calidez antes de dar tu VoBo.',
      }
    }
  }

  const { error } = await supabase
    .from('vobos')
    .upsert(
      {
        one_on_one_id: parsed.data.oneOnOneId,
        user_id: user.id,
        confirmed: parsed.data.confirmed,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: 'one_on_one_id,user_id' }
    )

  if (error) return { success: false, error: error.message }

  // F3: dejar la columna `status` consistente con los VoBos de ambos (fuente
  // única de verdad). Antes el status quedaba en 'agendada' aunque ambos
  // aprobaran, y cada vista derivaba el estado distinto (líder "Agendada" /
  // colaborador "Realizada"). Solo se toca cuando la 1:1 sigue en 'agendada':
  // así NO se pisa un estado ya decidido por RH (resolución de disputa) ni por
  // otro flujo. Se usa el admin client porque la RLS no deja al colaborador
  // actualizar la 1:1.
  const m = meeting as { leader_id: string; collaborator_id: string; status: string }
  if (m.status === 'agendada') {
    const admin = createAdminClient()
    const { data: allVobos } = await admin
      .from('vobos')
      .select('user_id, confirmed')
      .eq('one_on_one_id', parsed.data.oneOnOneId)
    const leaderVobo = (allVobos ?? []).find((v) => v.user_id === m.leader_id)
    const collaboratorVobo = (allVobos ?? []).find((v) => v.user_id === m.collaborator_id)
    const newStatus = deriveStatusFromVobos(leaderVobo, collaboratorVobo)
    if (newStatus) {
      await admin.from('one_on_ones').update({ status: newStatus }).eq('id', parsed.data.oneOnOneId)
    }
  }

  revalidatePath('/colaborador')
  revalidatePath('/lider')
  revalidatePath('/arquitectura-humana/disputas')

  return { success: true }
}
