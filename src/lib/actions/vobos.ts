'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
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
    .select('id, leader_id, collaborator_id')
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

  revalidatePath('/colaborador')
  revalidatePath('/lider')
  revalidatePath('/arquitectura-humana/disputas')

  return { success: true }
}
