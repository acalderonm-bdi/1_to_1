'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult, OneOnOne } from '@/types/domain'

const scheduleSchema = z.object({
  collaboratorId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(120).default(30),
  modality: z.enum(['virtual', 'presencial']),
  location: z.string().optional(),
  meetLink: z.string().url().optional(),
})

export async function scheduleOneOnOne(
  input: z.infer<typeof scheduleSchema>
): Promise<ActionResult<OneOnOne>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = scheduleSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos' }
  }

  const { collaboratorId, scheduledAt, durationMinutes, modality, location, meetLink } = parsed.data

  const { data, error } = await supabase
    .from('one_on_ones')
    .insert({
      leader_id: user.id,
      collaborator_id: collaboratorId,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      modality,
      location: location ?? null,
      meet_link: meetLink ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/colaborador')
  revalidatePath('/lider')

  return { success: true, data }
}

const cancelSchema = z.object({
  oneOnOneId: z.string().uuid(),
  reason: z.enum(['reagendada', 'cancelada_cargas', 'ausencia', 'sin_justificacion']),
})

export async function cancelOneOnOne(
  input: z.infer<typeof cancelSchema>
): Promise<ActionResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = cancelSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { error } = await supabase
    .from('one_on_ones')
    .update({
      status: 'no_realizada',
      non_realization_reason: parsed.data.reason,
    })
    .eq('id', parsed.data.oneOnOneId)
    .or(`leader_id.eq.${user.id},collaborator_id.eq.${user.id}`)

  if (error) return { success: false, error: error.message }

  revalidatePath('/colaborador')
  revalidatePath('/lider')

  return { success: true }
}
