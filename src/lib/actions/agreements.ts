'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult, Agreement } from '@/types/domain'

const createAgreementSchema = z.object({
  oneOnOneId: z.string().uuid(),
  description: z.string().min(10).max(500),
  responsibleId: z.string().uuid(),
  dueDate: z.string().optional().nullable(),
  aiGenerated: z.boolean().default(false),
  aiConfidence: z.number().min(0).max(1).optional().nullable(),
})

export async function createAgreement(
  input: z.infer<typeof createAgreementSchema>
): Promise<ActionResult<Agreement>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = createAgreementSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { data, error } = await supabase
    .from('agreements')
    .insert({
      one_on_one_id: parsed.data.oneOnOneId,
      description: parsed.data.description,
      responsible_id: parsed.data.responsibleId,
      due_date: parsed.data.dueDate ?? null,
      ai_generated: parsed.data.aiGenerated,
      ai_confidence: parsed.data.aiConfidence ?? null,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/colaborador')
  revalidatePath('/lider')

  return { success: true, data }
}

const updateStatusSchema = z.object({
  agreementId: z.string().uuid(),
  status: z.enum(['pendiente', 'cumplido', 'parcial', 'no_cumplido']),
})

export async function updateAgreementStatus(
  input: z.infer<typeof updateStatusSchema>
): Promise<ActionResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = updateStatusSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { error } = await supabase
    .from('agreements')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.agreementId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/colaborador')
  revalidatePath('/lider')

  return { success: true }
}

const deleteSchema = z.object({
  agreementId: z.string().uuid(),
})

export async function deleteAgreement(
  input: z.infer<typeof deleteSchema>
): Promise<ActionResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = deleteSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  // Antes de borrar, obtenemos el one_on_one_id para revalidar el path correcto.
  const { data: ag } = await supabase
    .from('agreements')
    .select('one_on_one_id')
    .eq('id', parsed.data.agreementId)
    .single<{ one_on_one_id: string }>()

  const { error } = await supabase
    .from('agreements')
    .delete()
    .eq('id', parsed.data.agreementId)

  if (error) return { success: false, error: error.message }

  // Audit
  if (ag) {
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'agreement_deleted',
      resource_type: 'agreement',
      resource_id: parsed.data.agreementId,
      metadata: { one_on_one_id: ag.one_on_one_id },
    })
    revalidatePath(`/lider/1to1/${ag.one_on_one_id}`)
    revalidatePath(`/colaborador/1to1/${ag.one_on_one_id}`)
  }
  revalidatePath('/colaborador')
  revalidatePath('/lider')
  revalidatePath('/colaborador/acuerdos')

  return { success: true }
}

const followupSchema = z.object({
  agreementId: z.string().uuid(),
  reportedStatus: z.enum(['pendiente', 'cumplido', 'parcial', 'no_cumplido']),
  justification: z.string().max(500).optional(),
  reportedInOneOnOneId: z.string().uuid().optional(),
})

export async function reportAgreementFollowup(
  input: z.infer<typeof followupSchema>
): Promise<ActionResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = followupSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { error } = await supabase
    .from('agreement_followups')
    .insert({
      agreement_id: parsed.data.agreementId,
      reported_by_id: user.id,
      reported_status: parsed.data.reportedStatus,
      justification: parsed.data.justification ?? null,
      reported_in_one_on_one_id: parsed.data.reportedInOneOnOneId ?? null,
    })

  if (error) return { success: false, error: error.message }

  // Actualizar el status en la tabla agreements
  await supabase
    .from('agreements')
    .update({ status: parsed.data.reportedStatus })
    .eq('id', parsed.data.agreementId)

  revalidatePath('/colaborador')
  revalidatePath('/lider')

  return { success: true }
}
