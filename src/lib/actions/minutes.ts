'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { extractAgreements } from '@/lib/ai/extract-agreements'
import type { ActionResult } from '@/types/domain'

const saveMinuteSchema = z.object({
  oneOnOneId: z.string().uuid(),
  rawContent: z.string().min(1).max(5000),
})

interface SaveMinuteResult {
  extractedCount: number
  aiError?: string
}

export async function saveMinute(
  input: z.infer<typeof saveMinuteSchema>
): Promise<ActionResult<SaveMinuteResult>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = saveMinuteSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  // Minuta compartida: una por 1:1, ambos participantes pueden editar.
  // author_id se actualiza al último que guardó.
  const { error } = await supabase
    .from('minutes')
    .upsert(
      {
        one_on_one_id: parsed.data.oneOnOneId,
        author_id: user.id,
        raw_content: parsed.data.rawContent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'one_on_one_id' }
    )

  if (error) return { success: false, error: error.message }

  // Auto-extracción de acuerdos con IA — corre tras guardar.
  // Si la IA falla, el guardado de minuta NO se rompe.
  let extractedCount = 0
  let aiError: string | undefined

  try {
    const { data: meeting } = await supabase
      .from('one_on_ones')
      .select(`
        leader_id, collaborator_id,
        leader:users!one_on_ones_leader_id_fkey(id, full_name, email),
        collaborator:users!one_on_ones_collaborator_id_fkey(id, full_name, email)
      `)
      .eq('id', parsed.data.oneOnOneId)
      .single()

    if (meeting) {
      const leader = (Array.isArray(meeting.leader) ? meeting.leader[0] : meeting.leader) as
        { id: string; full_name: string; email: string } | null
      const collaborator = (Array.isArray(meeting.collaborator) ? meeting.collaborator[0] : meeting.collaborator) as
        { id: string; full_name: string; email: string } | null

      if (leader && collaborator) {
        const result = await extractAgreements({
          rawMinute: parsed.data.rawContent,
          leader: { name: leader.full_name, email: leader.email },
          collaborator: { name: collaborator.full_name, email: collaborator.email },
        })

        if (result.error) {
          aiError = result.error
        } else if (result.agreements.length > 0) {
          // Idempotencia: remplazamos los acuerdos AI previos de esta 1:1.
          await supabase
            .from('agreements')
            .delete()
            .eq('one_on_one_id', parsed.data.oneOnOneId)
            .eq('ai_generated', true)
            .eq('status', 'pendiente')

          const emailToId: Record<string, string> = {
            [leader.email]: leader.id,
            [collaborator.email]: collaborator.id,
          }

          const rows = result.agreements
            .map(a => {
              const responsibleId = emailToId[a.responsible_email] ?? collaborator.id
              return {
                one_on_one_id: parsed.data.oneOnOneId,
                description: a.description,
                responsible_id: responsibleId,
                due_date: a.due_date,
                status: 'pendiente' as const,
                ai_generated: true,
                ai_confidence: a.confidence ?? null,
              }
            })

          const { error: insErr } = await supabase.from('agreements').insert(rows)
          if (!insErr) extractedCount = rows.length
          else aiError = insErr.message
        }
      }
    }
  } catch (err) {
    aiError = err instanceof Error ? err.message : 'IA no disponible'
  }

  revalidatePath('/colaborador')
  revalidatePath('/lider')
  revalidatePath(`/lider/1to1/${parsed.data.oneOnOneId}`)
  revalidatePath(`/colaborador/1to1/${parsed.data.oneOnOneId}`)

  return { success: true, data: { extractedCount, aiError } }
}
