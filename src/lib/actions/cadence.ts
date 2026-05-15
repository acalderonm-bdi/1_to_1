'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireHR } from '@/lib/auth-guards'
import type { ActionResult } from '@/types/domain'

const upsertGlobalSchema = z.object({
  frequencyDays: z.number().int().min(1).max(90),
})

export async function upsertGlobalCadence(
  input: z.infer<typeof upsertGlobalSchema>,
): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  const parsed = upsertGlobalSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { supabase, user } = guard

  const { data: existing } = await supabase
    .from('cadence_configs')
    .select('id')
    .eq('scope_type', 'global')
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('cadence_configs')
      .update({ frequency_days: parsed.data.frequencyDays })
      .eq('id', existing.id)
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase
      .from('cadence_configs')
      .insert({
        scope_type: 'global',
        frequency_days: parsed.data.frequencyDays,
        created_by: user.id,
      })
    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/arquitectura-humana/cadencias')
  return { success: true }
}

const upsertDeptSchema = z.object({
  departmentId: z.string().uuid(),
  frequencyDays: z.number().int().min(1).max(90),
})

export async function upsertDepartmentCadence(
  input: z.infer<typeof upsertDeptSchema>,
): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  const parsed = upsertDeptSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { supabase, user } = guard

  // Schema uses `scope_id` (not `department_id`) for the FK target — see
  // supabase/migrations/00000000000001_initial_schema.sql:65-76. The unique
  // index `idx_cadence_scope` enforces one row per (scope_type, scope_id).
  const { data: existing } = await supabase
    .from('cadence_configs')
    .select('id')
    .eq('scope_type', 'department')
    .eq('scope_id', parsed.data.departmentId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('cadence_configs')
      .update({ frequency_days: parsed.data.frequencyDays })
      .eq('id', existing.id)
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase
      .from('cadence_configs')
      .insert({
        scope_type: 'department',
        scope_id: parsed.data.departmentId,
        frequency_days: parsed.data.frequencyDays,
        created_by: user.id,
      })
    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/arquitectura-humana/cadencias')
  return { success: true }
}

export async function removeDepartmentCadence(id: string): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }

  const { error } = await guard.supabase
    .from('cadence_configs')
    .delete()
    .eq('id', id)
    .eq('scope_type', 'department')

  if (error) return { success: false, error: error.message }
  revalidatePath('/arquitectura-humana/cadencias')
  return { success: true }
}
