'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types/domain'

const reviewSchema = z.object({
  reportId: z.string().uuid(),
})

export async function markReportReviewed(
  input: z.infer<typeof reviewSchema>
): Promise<ActionResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()
  if (profile?.role !== 'hr') {
    return { success: false, error: 'Solo Arquitectura Humana puede marcar reportes' }
  }

  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { error } = await supabase
    .from('ai_reports')
    .update({ reviewed: true, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', parsed.data.reportId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/arquitectura-humana/reportes')
  revalidatePath('/arquitectura-humana')

  return { success: true }
}
