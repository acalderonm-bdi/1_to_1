'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types/domain'

const saveMinuteSchema = z.object({
  oneOnOneId: z.string().uuid(),
  rawContent: z.string().min(1).max(5000),
})

export async function saveMinute(
  input: z.infer<typeof saveMinuteSchema>
): Promise<ActionResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = saveMinuteSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { error } = await supabase
    .from('minutes')
    .upsert(
      {
        one_on_one_id: parsed.data.oneOnOneId,
        author_id: user.id,
        raw_content: parsed.data.rawContent,
      },
      { onConflict: 'one_on_one_id,author_id' }
    )

  if (error) return { success: false, error: error.message }

  revalidatePath('/colaborador')
  revalidatePath('/lider')

  return { success: true }
}
