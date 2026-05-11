'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types/domain'

const resolveSchema = z.object({
  oneOnOneId: z.string().uuid(),
  resolution: z.enum(['realizada', 'no_realizada']),
  reason: z.string().max(500).optional(),
})

export async function resolveDispute(
  input: z.infer<typeof resolveSchema>
): Promise<ActionResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // Solo HR puede resolver disputas.
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()
  if (profile?.role !== 'hr') {
    return { success: false, error: 'Solo Arquitectura Humana puede resolver disputas' }
  }

  const parsed = resolveSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const updates: Record<string, unknown> = { status: parsed.data.resolution }
  if (parsed.data.resolution === 'no_realizada') {
    updates['non_realization_reason'] = 'sin_justificacion'
  }

  const { error } = await supabase
    .from('one_on_ones')
    .update(updates)
    .eq('id', parsed.data.oneOnOneId)
    .eq('status', 'en_disputa')

  if (error) return { success: false, error: error.message }

  // Log de auditoría (best-effort)
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'dispute_resolved',
    resource_type: 'one_on_one',
    resource_id: parsed.data.oneOnOneId,
    metadata: { resolution: parsed.data.resolution, reason: parsed.data.reason ?? null },
  })

  revalidatePath('/arquitectura-humana/disputas')
  revalidatePath('/arquitectura-humana')

  return { success: true }
}
