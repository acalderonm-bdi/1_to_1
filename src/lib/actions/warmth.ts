'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types/domain'

const submitSchema = z.object({
  oneOnOneId: z.string().uuid(),
  feltHeard: z.number().int().min(1).max(5),
  comfortableSharing: z.number().int().min(1).max(5),
  leaderEngaged: z.number().int().min(1).max(5),
  conversationQuality: z.number().int().min(1).max(5),
  clarityAfterSession: z.number().int().min(1).max(5),
  freeComment: z.string().max(1000).optional(),
})

export async function submitWarmthResponse(
  input: z.infer<typeof submitSchema>
): Promise<ActionResult<{ id: string }>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = submitSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  // Verify caller is the collaborator of this meeting
  const { data: meeting } = await supabase
    .from('one_on_ones')
    .select('collaborator_id')
    .eq('id', parsed.data.oneOnOneId)
    .single<{ collaborator_id: string }>()

  if (!meeting) return { success: false, error: 'Reunión no encontrada' }
  if (meeting.collaborator_id !== user.id) {
    return { success: false, error: 'Solo el colaborador puede responder la encuesta' }
  }

  const insertPayload = {
    one_on_one_id: parsed.data.oneOnOneId,
    collaborator_id: user.id,
    felt_heard: parsed.data.feltHeard,
    comfortable_sharing: parsed.data.comfortableSharing,
    leader_engaged: parsed.data.leaderEngaged,
    conversation_quality: parsed.data.conversationQuality,
    clarity_after_session: parsed.data.clarityAfterSession,
    free_comment: parsed.data.freeComment ?? null,
  }

  const insertResult = await supabase
    .from('meeting_warmth_responses')
    .insert(insertPayload)
    .select('id')
    .single()

  if (insertResult.error) return { success: false, error: insertResult.error.message }
  if (!insertResult.data) return { success: false, error: 'No se pudo crear la respuesta' }

  // Audit log (mirror existing pattern: user_id/action/resource_type/resource_id/metadata)
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'warmth_submitted',
    resource_type: 'meeting_warmth_response',
    resource_id: insertResult.data.id,
    metadata: { one_on_one_id: parsed.data.oneOnOneId },
  })

  revalidatePath(`/colaborador/1to1/${parsed.data.oneOnOneId}`)
  return { success: true, data: { id: insertResult.data.id } }
}
