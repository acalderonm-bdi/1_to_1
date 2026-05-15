'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireHR } from '@/lib/auth-guards'
import type { ActionResult } from '@/types/domain'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().optional(),
})

export async function createDepartment(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult<{ id: string }>> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const insertResult = await guard.supabase
    .from('departments')
    .insert({ name: parsed.data.name, parent_id: parsed.data.parentId ?? null })
    .select('id')
    .single()

  if (insertResult.error || !insertResult.data) {
    return { success: false, error: insertResult.error?.message ?? 'No se pudo crear' }
  }
  revalidatePath('/arquitectura-humana/estructura')
  return { success: true, data: { id: insertResult.data.id } }
}

const renameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
})

export async function renameDepartment(
  id: string,
  name: string,
): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }

  const parsed = renameSchema.safeParse({ id, name: name.trim() })
  if (!parsed.success) return { success: false, error: 'Nombre inválido' }

  const { error } = await guard.supabase
    .from('departments')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/arquitectura-humana/estructura')
  return { success: true }
}

export async function deleteDepartment(
  id: string,
): Promise<ActionResult<{ blocked?: boolean; userCount?: number }>> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }

  const { count, error: countErr } = await guard.supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('department_id', id)

  if (countErr) return { success: false, error: countErr.message }

  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: `No se puede eliminar — tiene ${count} usuario${count === 1 ? '' : 's'} asignado${count === 1 ? '' : 's'}.`,
      data: { blocked: true, userCount: count ?? 0 },
    }
  }

  const { error } = await guard.supabase.from('departments').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/arquitectura-humana/estructura')
  return { success: true }
}
