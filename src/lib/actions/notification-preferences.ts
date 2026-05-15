'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  CHANNELS,
  TRIGGER_TYPES,
  isKnownChannel,
  isKnownTrigger,
  type NotificationPreference,
  type SetPreferenceInput,
} from '@/lib/notifications/preferences-config'
import type { ActionResult } from '@/types/domain'

const triggerEnum = z.enum(TRIGGER_TYPES)
const channelEnum = z.enum(CHANNELS)

const setPreferenceSchema = z.object({
  trigger_type: triggerEnum,
  channel: channelEnum,
  enabled: z.boolean(),
})

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
