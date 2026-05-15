'use client'

import { useMemo, useState, useTransition } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  CHANNELS,
  TRIGGER_TYPES,
  setPreference,
  type NotificationPreference,
  type PreferenceChannel,
} from '@/lib/actions/notification-preferences'
import type { NotificationTriggerType } from '@/types/domain'

interface NotificationPreferencesFormProps {
  initialPreferences: NotificationPreference[]
}

const TRIGGER_LABELS: Record<NotificationTriggerType, string> = {
  cumplimiento_bajo: 'Cumplimiento bajo',
  acuerdo_vencido: 'Acuerdo vencido',
  vobo_pendiente: 'VoBo pendiente',
  calidez_baja: 'Calidez baja',
  disputa_nueva: 'Disputa nueva',
  reminder_pre_1to1: 'Recordatorio pre-1:1',
}

const CHANNEL_LABELS: Record<PreferenceChannel, string> = {
  in_app: 'En la app',
  email: 'Email',
  slack: 'Slack',
}

type MatrixKey = `${NotificationTriggerType}::${PreferenceChannel}`

function keyOf(trigger: NotificationTriggerType, channel: PreferenceChannel): MatrixKey {
  return `${trigger}::${channel}` satisfies MatrixKey
}

export function NotificationPreferencesForm({
  initialPreferences,
}: NotificationPreferencesFormProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  // Hydrate matrix from initial server-fetched preferences.
  const initialMatrix = useMemo(() => {
    const map = new Map<MatrixKey, boolean>()
    for (const trigger of TRIGGER_TYPES) {
      for (const channel of CHANNELS) {
        map.set(keyOf(trigger, channel), true)
      }
    }
    for (const pref of initialPreferences) {
      map.set(keyOf(pref.trigger_type, pref.channel), pref.enabled)
    }
    return map
  }, [initialPreferences])

  const [matrix, setMatrix] = useState<Map<MatrixKey, boolean>>(initialMatrix)
  const [savedMatrix, setSavedMatrix] = useState<Map<MatrixKey, boolean>>(initialMatrix)

  const dirtyEntries = useMemo(() => {
    const out: Array<{ trigger: NotificationTriggerType; channel: PreferenceChannel; enabled: boolean }> = []
    for (const trigger of TRIGGER_TYPES) {
      for (const channel of CHANNELS) {
        const k = keyOf(trigger, channel)
        const next = matrix.get(k) ?? true
        const prev = savedMatrix.get(k) ?? true
        if (next !== prev) out.push({ trigger, channel, enabled: next })
      }
    }
    return out
  }, [matrix, savedMatrix])

  const dirty = dirtyEntries.length > 0

  function toggle(trigger: NotificationTriggerType, channel: PreferenceChannel) {
    const k = keyOf(trigger, channel)
    const current = matrix.get(k) ?? true
    const next = new Map(matrix)
    next.set(k, !current)
    setMatrix(next)
  }

  function onSave() {
    if (!dirty) return
    // Optimistic UI: assume success, persist saved snapshot after server confirms.
    const snapshot = new Map(matrix)
    startTransition(async () => {
      const failures: string[] = []
      for (const entry of dirtyEntries) {
        const result = await setPreference({
          trigger_type: entry.trigger,
          channel: entry.channel,
          enabled: entry.enabled,
        })
        if (!result.success) {
          failures.push(
            `${TRIGGER_LABELS[entry.trigger]} · ${CHANNEL_LABELS[entry.channel]}: ${result.error ?? 'error desconocido'}`,
          )
        }
      }
      if (failures.length === 0) {
        setSavedMatrix(snapshot)
        toast({ title: 'Preferencias actualizadas' })
      } else {
        toast({
          title: 'Algunas preferencias no se guardaron',
          description: failures.join(' · '),
          variant: 'destructive',
        })
      }
    })
  }

  return (
    <div className="ui-card">
      <div className="ui-card__head">
        <div>
          <h3 className="ui-card__title font-serif" style={{ fontSize: 18 }}>
            Notificaciones por evento
          </h3>
          <p className="ui-card__desc">
            Elegí qué canales recibís para cada disparador. Por defecto todo está activo.
          </p>
        </div>
        <button
          type="button"
          className="ui-btn ui-btn--accent ui-btn--sm"
          onClick={onSave}
          disabled={!dirty || isPending}
          aria-disabled={!dirty || isPending}
        >
          {isPending ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <div className="ui-card__body" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                Evento
              </th>
              {CHANNELS.map((channel) => (
                <th
                  key={channel}
                  style={{
                    textAlign: 'center',
                    padding: '8px 12px',
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                  }}
                >
                  {CHANNEL_LABELS[channel]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRIGGER_TYPES.map((trigger) => (
              <tr key={trigger} style={{ borderTop: '1px solid var(--border-c)' }}>
                <td style={{ padding: '10px 12px' }}>{TRIGGER_LABELS[trigger]}</td>
                {CHANNELS.map((channel) => {
                  const k = keyOf(trigger, channel)
                  const checked = matrix.get(k) ?? true
                  return (
                    <td key={channel} style={{ textAlign: 'center', padding: '10px 12px' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(trigger, channel)}
                        aria-label={`${TRIGGER_LABELS[trigger]} – ${CHANNEL_LABELS[channel]}`}
                        disabled={isPending}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
