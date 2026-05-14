'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  createNotificationRule,
  updateNotificationRule,
  type RuleInput,
} from '@/lib/actions/notification-rules'
import type {
  NotificationAudience,
  NotificationChannelExt,
  NotificationRuleRow,
  NotificationTriggerType,
} from '@/types/domain'

export const TRIGGER_OPTIONS: Array<{ value: NotificationTriggerType; label: string }> = [
  { value: 'cumplimiento_bajo', label: 'Cumplimiento bajo' },
  { value: 'acuerdo_vencido', label: 'Acuerdo vencido' },
  { value: 'vobo_pendiente', label: 'VoBo pendiente' },
  { value: 'calidez_baja', label: 'Calidez baja' },
  { value: 'disputa_nueva', label: 'Disputa nueva' },
  { value: 'reminder_pre_1to1', label: 'Recordatorio pre-1:1' },
]

const DEFAULT_THRESHOLD_BY_TRIGGER: Record<NotificationTriggerType, { value?: number; days?: number }> = {
  cumplimiento_bajo: { value: 50 },
  calidez_baja: { value: 3 },
  vobo_pendiente: { days: 3 },
  reminder_pre_1to1: { days: 2 },
  acuerdo_vencido: {},
  disputa_nueva: {},
}

const AUDIENCE_OPTIONS: Array<{ value: NotificationAudience; label: string }> = [
  { value: 'leader', label: 'Líder' },
  { value: 'collaborator', label: 'Colaborador' },
  { value: 'hr', label: 'Arquitectura Humana' },
]

const CHANNEL_OPTIONS: Array<{ value: NotificationChannelExt; label: string }> = [
  { value: 'in_app', label: 'En la app' },
  { value: 'email', label: 'Correo' },
  { value: 'slack', label: 'Slack' },
]

interface NotificationRuleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingRule?: NotificationRuleRow | null
  onSaved: (rule: NotificationRuleRow) => void
}

export function NotificationRuleModal({
  open,
  onOpenChange,
  editingRule,
  onSaved,
}: NotificationRuleModalProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [triggerType, setTriggerType] = useState<NotificationTriggerType>('cumplimiento_bajo')
  const [thresholdValue, setThresholdValue] = useState<number>(50)
  const [thresholdScope, setThresholdScope] = useState<'global' | 'department' | 'leader'>('global')
  const [thresholdDays, setThresholdDays] = useState<number>(2)
  const [audience, setAudience] = useState<NotificationAudience[]>(['hr'])
  const [channels, setChannels] = useState<NotificationChannelExt[]>(['in_app'])

  useEffect(() => {
    if (!open) return
    if (editingRule) {
      setName(editingRule.name)
      setEnabled(editingRule.enabled)
      setTriggerType(editingRule.trigger_type)
      const t = editingRule.threshold ?? {}
      setThresholdValue(typeof t.value === 'number' ? t.value : 50)
      setThresholdScope(
        t.scope === 'department' || t.scope === 'leader' ? t.scope : 'global',
      )
      setThresholdDays(typeof t.days === 'number' ? t.days : 2)
      setAudience(editingRule.audience)
      setChannels(editingRule.channels)
    } else {
      setName('')
      setEnabled(true)
      setTriggerType('cumplimiento_bajo')
      setThresholdValue(50)
      setThresholdScope('global')
      setThresholdDays(2)
      setAudience(['hr'])
      setChannels(['in_app'])
    }
  }, [editingRule, open])

  function handleTriggerChange(newTrigger: NotificationTriggerType) {
    setTriggerType(newTrigger)
    const defaults = DEFAULT_THRESHOLD_BY_TRIGGER[newTrigger] ?? {}
    if (typeof defaults.value === 'number') setThresholdValue(defaults.value)
    if (typeof defaults.days === 'number') setThresholdDays(defaults.days)
    // Reset scope al default global cuando cambia el trigger.
    setThresholdScope('global')
  }

  function buildThreshold(): RuleInput['threshold'] {
    switch (triggerType) {
      case 'cumplimiento_bajo':
        return { value: thresholdValue, unit: 'percent', scope: thresholdScope }
      case 'vobo_pendiente':
        return { days: thresholdDays, unit: 'days' }
      case 'calidez_baja':
        return { value: thresholdValue, unit: 'score' }
      case 'reminder_pre_1to1':
        return { days: thresholdDays, unit: 'days' }
      case 'acuerdo_vencido':
      case 'disputa_nueva':
      default:
        return null
    }
  }

  function toggleAudience(v: NotificationAudience) {
    setAudience((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  function toggleChannel(v: NotificationChannelExt) {
    setChannels((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast({ title: 'Nombre requerido', variant: 'destructive' })
      return
    }
    if (audience.length === 0) {
      toast({ title: 'Seleccioná al menos un destinatario', variant: 'destructive' })
      return
    }
    if (channels.length === 0) {
      toast({ title: 'Seleccioná al menos un canal', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    const payload: RuleInput = {
      name: name.trim(),
      enabled,
      triggerType,
      threshold: buildThreshold(),
      audience,
      channels,
    }

    try {
      if (editingRule) {
        const r = await updateNotificationRule(editingRule.id, payload)
        if (!r.success) {
          toast({ title: 'No se pudo actualizar', description: r.error, variant: 'destructive' })
          return
        }
        const updated: NotificationRuleRow = {
          ...editingRule,
          name: payload.name,
          enabled: payload.enabled,
          trigger_type: payload.triggerType,
          threshold: payload.threshold,
          audience: payload.audience,
          channels: payload.channels,
          updated_at: new Date().toISOString(),
        }
        onSaved(updated)
        toast({ title: 'Regla actualizada' })
      } else {
        const r = await createNotificationRule(payload)
        if (!r.success || !r.data) {
          toast({ title: 'No se pudo crear', description: r.error, variant: 'destructive' })
          return
        }
        const created: NotificationRuleRow = {
          id: r.data.id,
          name: payload.name,
          enabled: payload.enabled,
          trigger_type: payload.triggerType,
          threshold: payload.threshold,
          audience: payload.audience,
          channels: payload.channels,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        onSaved(created)
        toast({ title: 'Regla creada' })
      }
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  const showValuePercent = triggerType === 'cumplimiento_bajo'
  const showValueScore = triggerType === 'calidez_baja'
  const showDays = triggerType === 'vobo_pendiente' || triggerType === 'reminder_pre_1to1'
  const showScope = triggerType === 'cumplimiento_bajo'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingRule ? 'Editar regla' : 'Nueva regla de notificación'}</DialogTitle>
          <DialogDescription>
            Configurá cuándo se dispara, a quién avisa y por qué canal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="rule-name" className="ui-label">Nombre</Label>
            <input
              id="rule-name"
              type="text"
              className="ui-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="Ej: Cumplimiento por debajo del 50%"
              style={{ width: '100%' }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-trigger" className="ui-label">Disparador</Label>
            <Select value={triggerType} onValueChange={(v) => handleTriggerChange(v as NotificationTriggerType)}>
              <SelectTrigger id="rule-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(showValuePercent || showValueScore || showDays || showScope) && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                padding: 12,
                background: 'var(--bg-soft, rgba(0,0,0,0.02))',
                borderRadius: 8,
              }}
            >
              {showValuePercent && (
                <div className="space-y-1" style={{ flex: '1 1 140px' }}>
                  <Label className="ui-label">Umbral (%)</Label>
                  <input
                    type="number"
                    className="ui-input"
                    min={0}
                    max={100}
                    value={thresholdValue}
                    onChange={(e) => setThresholdValue(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
              {showValueScore && (
                <div className="space-y-1" style={{ flex: '1 1 140px' }}>
                  <Label className="ui-label">Umbral (0-5)</Label>
                  <input
                    type="number"
                    className="ui-input"
                    min={0}
                    max={5}
                    step={0.1}
                    value={thresholdValue}
                    onChange={(e) => setThresholdValue(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
              {showDays && (
                <div className="space-y-1" style={{ flex: '1 1 140px' }}>
                  <Label className="ui-label">Días</Label>
                  <input
                    type="number"
                    className="ui-input"
                    min={0}
                    max={30}
                    value={thresholdDays}
                    onChange={(e) => setThresholdDays(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
              {showScope && (
                <div className="space-y-1" style={{ flex: '1 1 160px' }}>
                  <Label className="ui-label">Alcance</Label>
                  <Select
                    value={thresholdScope}
                    onValueChange={(v) =>
                      setThresholdScope(v as 'global' | 'department' | 'leader')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global</SelectItem>
                      <SelectItem value="department">Por área</SelectItem>
                      <SelectItem value="leader">Por líder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label className="ui-label">Destinatarios</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {AUDIENCE_OPTIONS.map((opt) => {
                const active = audience.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`ui-btn ui-btn--sm ${active ? 'ui-btn--accent' : 'ui-btn--ghost'}`}
                    onClick={() => toggleAudience(opt.value)}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="ui-label">Canales</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CHANNEL_OPTIONS.map((opt) => {
                const active = channels.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`ui-btn ui-btn--sm ${active ? 'ui-btn--accent' : 'ui-btn--ghost'}`}
                    onClick={() => toggleChannel(opt.value)}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5 }}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Habilitada
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Guardando…' : editingRule ? 'Guardar cambios' : 'Crear regla'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function labelForTrigger(t: NotificationTriggerType): string {
  return TRIGGER_OPTIONS.find((o) => o.value === t)?.label ?? t
}

export function labelForAudience(a: NotificationAudience): string {
  return AUDIENCE_OPTIONS.find((o) => o.value === a)?.label ?? a
}

export function labelForChannel(c: NotificationChannelExt): string {
  return CHANNEL_OPTIONS.find((o) => o.value === c)?.label ?? c
}
