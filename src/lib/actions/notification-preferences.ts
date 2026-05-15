'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult, NotificationTriggerType } from '@/types/domain'

// Mirror of the union exposed by `src/types/database.augmentation.ts`. Kept
// here as a literal tuple so zod can validate input at the action boundary
// (the DB stores plain text and has no FK to an enum).
export const TRIGGER_TYPES = [
  'cumplimiento_bajo',
  'acuerdo_vencido',
  'vobo_pendiente',
  'calidez_baja',
  'disputa_nueva',
  'reminder_pre_1to1',
] as const satisfies readonly NotificationTriggerType[]

export const CHANNELS = ['in_app', 'email', 'slack'] as const
export type PreferenceChannel = (typeof CHANNELS)[number]

const triggerEnum = z.enum(TRIGGER_TYPES)
const channelEnum = z.enum(CHANNELS)

const setPreferenceSchema = z.object({
  trigger_type: triggerEnum,
  channel: channelEnum,
  enabled: z.boolean(),
})

export type SetPreferenceInput = z.infer<typeof setPreferenceSchema>

export interface NotificationPreference {
  trigger_type: NotificationTriggerType
  channel: PreferenceChannel
  enabled: boolean
}

interface PreferenceRow {
  trigger_type: string
  channel: string
  enabled: boolean
}

/**
 * Returns the full 6 × 3 matrix of preferences for the current user. Combos
 * without a row default to `enabled: true` (opt-OUT model).
 */
export async function getMyPreferences(): Promise<ActionResult<NotificationPreference[]>> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('trigger_type, channel, enabled')
    .eq('user_id', user.id)

  if (error) return { success: false, error: error.message }

  // Index existing rows by composite key, then fill in defaults for the rest.
  const rowsByKey = new Map<string, PreferenceRow>()
  for (const row of (data ?? []) as PreferenceRow[]) {
    rowsByKey.set(`${row.trigger_type}::${row.channel}`, row)
  }

  const matrix: NotificationPreference[] = []
  for (const trigger of TRIGGER_TYPES) {
    for (const channel of CHANNELS) {
      const existing = rowsByKey.get(`${trigger}::${channel}`)
      if (existing && isKnownTrigger(existing.trigger_type) && isKnownChannel(existing.channel)) {
        matrix.push({
          trigger_type: existing.trigger_type,
          channel: existing.channel,
          enabled: existing.enabled,
        })
      } else {
        matrix.push({ trigger_type: trigger, channel, enabled: true })
      }
    }
  }

  return { success: true, data: matrix }
}

/**
 * Upserts a single (user × trigger × channel) preference. The RLS policy
 * additionally enforces `user_id = auth.uid()` so even a forged client cannot
 * write into another user's row.
 */
export async function setPreference(
  input: SetPreferenceInput,
): Promise<ActionResult> {
  const parsed = setPreferenceSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: user.id,
        trigger_type: parsed.data.trigger_type,
        channel: parsed.data.channel,
        enabled: parsed.data.enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,trigger_type,channel' },
    )

  if (error) return { success: false, error: error.message }

  revalidatePath('/colaborador/configuracion')
  revalidatePath('/lider/configuracion')
  return { success: true }
}

function isKnownTrigger(value: string): value is NotificationTriggerType {
  return (TRIGGER_TYPES as readonly string[]).includes(value)
}

function isKnownChannel(value: string): value is PreferenceChannel {
  return (CHANNELS as readonly string[]).includes(value)
}
