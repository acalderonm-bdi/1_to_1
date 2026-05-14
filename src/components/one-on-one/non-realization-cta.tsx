'use client'

import { useState } from 'react'
import { CalendarX } from 'lucide-react'
import { NonRealizationModal } from './non-realization-modal'

interface NonRealizationCTAProps {
  oneOnOneId: string
  scheduledAt: string
  status: string
}

export function NonRealizationCTA({ oneOnOneId, scheduledAt, status }: NonRealizationCTAProps) {
  const [open, setOpen] = useState(false)

  const isPast = new Date(scheduledAt) < new Date()
  if (status !== 'agendada' || !isPast) return null

  return (
    <>
      <button
        type="button"
        className="ui-btn ui-btn--ghost ui-btn--sm"
        onClick={() => setOpen(true)}
      >
        <CalendarX size={13} /> Marcar como no realizada
      </button>
      <NonRealizationModal
        oneOnOneId={oneOnOneId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
