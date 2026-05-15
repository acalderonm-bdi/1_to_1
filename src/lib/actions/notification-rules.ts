'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireHR } from '@/lib/auth-guards'
import type { ActionResult } from '@/types/domain'

const thresholdSchema = z
  .object({
    value: z.number().optional(),
    unit: z.enum(['percent', 'days', 'score']).optional(),
    scope: z.enum(['global', 'department', 'leader']).optional(),
    days: z.number().optional(),
  })
  .passthrough()
  .nullable()

const ruleSchema = z.object({
  name: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
  triggerType: z.enum([
    'cumplimiento_bajo',
    'acuerdo_vencido',
    'vobo_pendiente',
    'calidez_baja',
    'disputa_nueva',
    'reminder_pre_1to1',
  ]),
  threshold: thresholdSchema.default(null),
  audience: z.array(z.enum(['leader', 'collaborator', 'hr'])).min(1),
  channels: z.array(z.enum(['in_app', 'email', 'slack'])).min(1),
})

export type RuleInput = z.infer<typeof ruleSchema>

export async function createNotificationRule(
  input: RuleInput,
): Promise<ActionResult<{ id: string }>> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  const parsed = ruleSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const insertResult = await guard.supabase
    .from('notification_rules')
    .insert({
      name: parsed.data.name,
      enabled: parsed.data.enabled,
      trigger_type: parsed.data.triggerType,
      threshold: parsed.data.threshold,
      audience: parsed.data.audience,
      channels: parsed.data.channels,
      created_by: guard.user.id,
    })
    .select('id')
    .single()

  if (insertResult.error || !insertResult.data) {
    return { success: false, error: insertResult.error?.message ?? 'No se pudo crear' }
  }

  revalidatePath('/arquitectura-humana/notificaciones')
  return { success: true, data: { id: insertResult.data.id } }
}

export async function updateNotificationRule(
  id: string,
  input: RuleInput,
): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: 'ID inválido' }
  }
  const parsed = ruleSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { error } = await guard.supabase
    .from('notification_rules')
    .update({
      name: parsed.data.name,
      enabled: parsed.data.enabled,
      trigger_type: parsed.data.triggerType,
      threshold: parsed.data.threshold,
      audience: parsed.data.audience,
      channels: parsed.data.channels,
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/arquitectura-humana/notificaciones')
  return { success: true }
}

export async function toggleNotificationRule(
  id: string,
  enabled: boolean,
): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: 'ID inválido' }
  }

  const { error } = await guard.supabase
    .from('notification_rules')
    .update({ enabled })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/arquitectura-humana/notificaciones')
  return { success: true }
}

export async function deleteNotificationRule(id: string): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: 'ID inválido' }
  }

  const { error } = await guard.supabase
    .from('notification_rules')
    .delete()
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/arquitectura-humana/notificaciones')
  return { success: true }
}

export async function testFireRule(
  id: string,
): Promise<ActionResult<{ dispatched: number }>> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: 'ID inválido' }
  }

  const ruleResult = await guard.supabase
    .from('notification_rules')
    .select('id, name')
    .eq('id', id)
    .single()

  if (ruleResult.error || !ruleResult.data) {
    return { success: false, error: ruleResult.error?.message ?? 'Regla no encontrada' }
  }

  const { error: insErr } = await guard.supabase
    .from('notification_dispatches')
    .insert({
      rule_id: ruleResult.data.id,
      recipient_id: guard.user.id,
      channel: 'in_app',
      context: { test_fire: true, rule_name: ruleResult.data.name },
      status: 'sent',
    })

  if (insErr) return { success: false, error: insErr.message }

  return { success: true, data: { dispatched: 1 } }
}
