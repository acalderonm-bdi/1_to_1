'use client'

import { useState, useTransition } from 'react'
import { Bell, Pencil, Send, Trash2, Plus } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import {
  deleteNotificationRule,
  testFireRule,
  toggleNotificationRule,
} from '@/lib/actions/notification-rules'
import type { NotificationRuleRow } from '@/types/domain'
import {
  NotificationRuleModal,
  labelForAudience,
  labelForChannel,
  labelForTrigger,
} from './notification-rule-modal'

interface NotificationRulesClientProps {
  initialRules: NotificationRuleRow[]
}

export function NotificationRulesClient({ initialRules }: NotificationRulesClientProps) {
  const [rules, setRules] = useState<NotificationRuleRow[]>(initialRules)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRuleRow | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function openCreate() {
    setEditingRule(null)
    setModalOpen(true)
  }

  function openEdit(rule: NotificationRuleRow) {
    setEditingRule(rule)
    setModalOpen(true)
  }

  function handleSaved(saved: NotificationRuleRow) {
    setRules((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id)
      if (idx === -1) return [saved, ...prev]
      const next = [...prev]
      next[idx] = saved
      return next
    })
  }

  function handleToggle(rule: NotificationRuleRow, enabled: boolean) {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled } : r)))
    startTransition(async () => {
      const r = await toggleNotificationRule(rule.id, enabled)
      if (!r.success) {
        toast({ title: 'No se pudo actualizar', description: r.error, variant: 'destructive' })
        setRules((prev) =>
          prev.map((x) => (x.id === rule.id ? { ...x, enabled: !enabled } : x)),
        )
      }
    })
  }

  function handleTestFire(rule: NotificationRuleRow) {
    startTransition(async () => {
      const r = await testFireRule(rule.id)
      if (!r.success) {
        toast({ title: 'No se pudo disparar', description: r.error, variant: 'destructive' })
        return
      }
      toast({
        title: 'Prueba enviada',
        description: 'Se generó un dispatch de prueba en la app.',
      })
    })
  }

  function confirmDelete() {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    startTransition(async () => {
      const r = await deleteNotificationRule(id)
      if (!r.success) {
        toast({ title: 'No se pudo eliminar', description: r.error, variant: 'destructive' })
        return
      }
      setRules((prev) => prev.filter((x) => x.id !== id))
      setPendingDeleteId(null)
      toast({ title: 'Regla eliminada' })
    })
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: 14,
        }}
      >
        <button type="button" className="ui-btn ui-btn--accent" onClick={openCreate}>
          <Plus size={14} /> Nueva regla
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="ui-card">
          <EmptyState
            illustration="list"
            title="Sin reglas configuradas"
            description="Creá tu primera regla para automatizar avisos a líderes, colaboradores y Arquitectura Humana."
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rules.map((rule) => (
            <div key={rule.id} className="ui-card">
              <div className="ui-card__head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Bell size={15} style={{ color: rule.enabled ? 'var(--text-c)' : 'var(--text-muted)' }} />
                  <div>
                    <h3
                      className="ui-card__title"
                      style={{ opacity: rule.enabled ? 1 : 0.7 }}
                    >
                      {rule.name}
                    </h3>
                    <p className="ui-card__desc">{labelForTrigger(rule.trigger_type)}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(v) => handleToggle(rule, v)}
                    disabled={isPending}
                  />
                </div>
              </div>
              <div className="ui-card__body">
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: 10,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Destinatarios:</span>
                  {rule.audience.map((a) => (
                    <span key={a} className="ui-badge ui-badge--neutral" style={{ fontSize: 11 }}>
                      {labelForAudience(a)}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: 14,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Canales:</span>
                  {rule.channels.map((c) => (
                    <span key={c} className="ui-badge ui-badge--accent" style={{ fontSize: 11 }}>
                      {labelForChannel(c)}
                    </span>
                  ))}
                </div>
                {rule.threshold && (
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      marginBottom: 12,
                    }}
                  >
                    {renderThresholdSummary(rule)}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="ui-btn ui-btn--ghost ui-btn--sm"
                    onClick={() => openEdit(rule)}
                    disabled={isPending}
                  >
                    <Pencil size={12} /> Editar
                  </button>
                  <button
                    type="button"
                    className="ui-btn ui-btn--ghost ui-btn--sm"
                    onClick={() => handleTestFire(rule)}
                    disabled={isPending}
                  >
                    <Send size={12} /> Disparo de prueba
                  </button>
                  <button
                    type="button"
                    className="ui-btn ui-btn--ghost ui-btn--sm"
                    onClick={() => setPendingDeleteId(rule.id)}
                    disabled={isPending}
                    style={{ color: 'var(--destructive, #c0392b)' }}
                  >
                    <Trash2 size={12} /> Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NotificationRuleModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingRule={editingRule}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(v) => !v && setPendingDeleteId(null)}
        title="Eliminar regla"
        description="Esta acción no se puede deshacer. Los dispatches ya enviados se conservan."
        confirmLabel="Eliminar"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  )
}

function renderThresholdSummary(rule: NotificationRuleRow): string {
  const t = rule.threshold ?? {}
  switch (rule.trigger_type) {
    case 'cumplimiento_bajo':
      return `Dispara cuando cumplimiento < ${t.value ?? '?'}% (${t.scope ?? 'global'})`
    case 'calidez_baja':
      return `Dispara cuando calidez < ${t.value ?? '?'} / 5`
    case 'vobo_pendiente':
      return `Dispara tras ${t.days ?? '?'} día(s) sin VoBo`
    case 'reminder_pre_1to1':
      return `Recordatorio ${t.days ?? '?'} día(s) antes de la 1:1`
    case 'acuerdo_vencido':
      return 'Dispara cuando un acuerdo pasa su fecha límite'
    case 'disputa_nueva':
      return 'Dispara cuando se abre una disputa nueva'
    default:
      return ''
  }
}
