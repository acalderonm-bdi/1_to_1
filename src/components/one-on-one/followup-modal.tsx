'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { reportAgreementFollowup } from '@/lib/actions/agreements'
import { AGREEMENT_LABELS } from '@/lib/constants'

interface PendingAgreement { id: string; description: string; due_date: string | null }
interface FollowupModalProps {
  agreements: PendingAgreement[]
  oneOnOneId: string
  open: boolean
  onClose: () => void
}

export function FollowupModal({ agreements, oneOnOneId, open, onClose }: FollowupModalProps) {
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(agreements.map(a => [a.id, 'pendiente']))
  )
  const [isPending, startTransition] = useTransition()
  const [justifications, setJustifications] = useState<Record<string, string>>({})

  async function handleSubmit() {
    startTransition(async () => {
      await Promise.all(
        Object.entries(statuses).map(([agreementId, reportedStatus]) =>
          reportAgreementFollowup({
            agreementId,
            reportedStatus: reportedStatus as 'pendiente' | 'cumplido' | 'parcial' | 'no_cumplido',
            justification: justifications[agreementId] || undefined,
            reportedInOneOnOneId: oneOnOneId,
          })
        )
      )
      onClose()
    })
  }

  if (!open) return null

  const allDecided = Object.values(statuses).every(s => s !== 'pendiente' || true)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-c)',
          boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '22px 24px 8px' }}>
          <h2 className="font-serif" style={{ fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>
            Antes de confirmar — seguimiento de acuerdos anteriores
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '6px 0 0' }}>
            Quedaron {agreements.length} acuerdo{agreements.length !== 1 ? 's' : ''} pendiente{agreements.length !== 1 ? 's' : ''} de la 1:1 anterior. ¿Cómo quedaron?
          </p>
        </div>
        <div style={{ padding: '16px 24px', display: 'grid', gap: 12 }}>
          {agreements.map(a => (
            <div key={a.id} className="agreement">
              <p className="agreement__desc" style={{ marginBottom: 10 }}>{a.description}</p>
              {a.due_date && (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Vencía: {a.due_date}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {Object.entries(AGREEMENT_LABELS).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={`status-select status-select--${k}`}
                    style={statuses[a.id] === k
                      ? { boxShadow: '0 0 0 2px currentColor', cursor: 'pointer' }
                      : { opacity: 0.55, cursor: 'pointer' }}
                    onClick={() => setStatuses(prev => ({ ...prev, [a.id]: k }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {statuses[a.id] && statuses[a.id] !== 'cumplido' && (
                <input
                  className="ui-input"
                  placeholder="Justificación (opcional)"
                  value={justifications[a.id] ?? ''}
                  onChange={e => setJustifications(prev => ({ ...prev, [a.id]: e.target.value }))}
                  style={{ fontSize: 12.5 }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="ui-btn ui-btn--accent" onClick={handleSubmit} disabled={isPending || !allDecided}>
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Continuar al VoBo
          </button>
        </div>
      </div>
    </div>
  )
}
