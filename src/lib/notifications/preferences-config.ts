// Config compartido para notification preferences. NO es un 'use server' file
// — Next.js no permite exports no-async desde archivos de server actions, así
// que las constantes/tipos viven acá y las server actions los importan.

import type { NotificationTriggerType } from '@/types/domain'

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

export interface NotificationPreference {
  trigger_type: NotificationTriggerType
  channel: PreferenceChannel
  enabled: boolean
}

export interface SetPreferenceInput {
  trigger_type: NotificationTriggerType
  channel: PreferenceChannel
  enabled: boolean
}

export function isKnownTrigger(value: string): value is NotificationTriggerType {
  return (TRIGGER_TYPES as readonly string[]).includes(value)
}

export function isKnownChannel(value: string): value is PreferenceChannel {
  return (CHANNELS as readonly string[]).includes(value)
}
