'use client'

import { useState, useTransition } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { reportAgreementFollowup } from '@/lib/actions/agreements'
import { AGREEMENT_LABELS } from '@/lib/constants'

interface PendingAgreement {
  id: string
  description: string
  due_date: string | null
}

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

  async function handleSubmit() {
    startTransition(async () => {
      await Promise.all(
        Object.entries(statuses).map(([agreementId, reportedStatus]) =>
          reportAgreementFollowup({
            agreementId,
            reportedStatus: reportedStatus as 'pendiente' | 'cumplido' | 'parcial' | 'no_cumplido',
            reportedInOneOnOneId: oneOnOneId,
          })
        )
      )
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Seguimiento de acuerdos anteriores</DialogTitle>
          <DialogDescription>
            Antes de dar VoBo, reporta el estado de los compromisos de la última 1:1.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {agreements.map(agr => (
            <div key={agr.id} className="space-y-1.5">
              <p className="text-sm text-slate-700">{agr.description}</p>
              {agr.due_date && <p className="text-xs text-slate-400">Vencía: {agr.due_date}</p>}
              <Select
                value={statuses[agr.id]}
                onValueChange={val => setStatuses(prev => ({ ...prev, [agr.id]: val }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AGREEMENT_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Omitir</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar y continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
