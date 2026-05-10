'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { reportAgreementFollowup } from '@/lib/actions/agreements'
import { AGREEMENT_LABELS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'

interface PendingAgreement { id: string; description: string; due_date: string | null }
interface FollowupModalProps {
  agreements: PendingAgreement[]
  oneOnOneId: string
  open: boolean
  onClose: () => void
}

const STATUS_TONE: Record<string, string> = {
  pendiente: 'border-warning/40 bg-warning-muted text-warning',
  cumplido: 'border-success/40 bg-success-muted text-success',
  parcial: 'border-brand/40 bg-brand-muted text-brand',
  no_cumplido: 'border-destructive/40 bg-destructive/10 text-destructive',
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

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-6 bg-black/40 backdrop-blur-[2px] anim-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-popover border rounded-lg w-full max-w-[720px] max-h-[90vh] overflow-auto anim-scale-in"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ boxShadow: 'var(--shadow-popover)' }}
      >
        <div className="px-6 py-5 border-b">
          <h2 className="text-xl font-medium tracking-tight">Antes de confirmar — seguimiento de acuerdos anteriores</h2>
          <p className="text-[13px] text-muted-foreground mt-1.5">
            Quedaron {agreements.length} acuerdo{agreements.length !== 1 ? 's' : ''} pendiente{agreements.length !== 1 ? 's' : ''} de la 1:1 anterior. ¿Cómo quedaron?
          </p>
        </div>

        <div className="px-6 py-5 grid gap-3">
          {agreements.map(a => (
            <Card key={a.id} className="px-4 py-3.5">
              <p className="text-[13.5px] leading-relaxed mb-2.5">{a.description}</p>
              {a.due_date && (
                <div className="text-[11.5px] text-muted-foreground mb-2.5">Vencía: {a.due_date}</div>
              )}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {Object.entries(AGREEMENT_LABELS).map(([k, label]) => {
                  const active = statuses[a.id] === k
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setStatuses(prev => ({ ...prev, [a.id]: k }))}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-all',
                        STATUS_TONE[k] ?? 'border-border bg-secondary text-muted-foreground',
                        active ? 'ring-2 ring-current ring-offset-1 ring-offset-background' : 'opacity-60 hover:opacity-100',
                      )}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {label}
                    </button>
                  )
                })}
              </div>
              {statuses[a.id] && statuses[a.id] !== 'cumplido' && (
                <Input
                  placeholder="Justificación (opcional)"
                  value={justifications[a.id] ?? ''}
                  onChange={e => setJustifications(prev => ({ ...prev, [a.id]: e.target.value }))}
                  className="text-[12.5px]"
                />
              )}
            </Card>
          ))}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="button" variant="brand" onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            Continuar al VoBo
          </Button>
        </div>
      </div>
    </div>
  )
}
