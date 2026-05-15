'use client'

import { useState } from 'react'
import { CalendarX, AlertTriangle } from 'lucide-react'
import { NonRealizationModal } from './non-realization-modal'

interface NonRealizationCTAProps {
  oneOnOneId: string
  scheduledAt: string
  status: string
  /** Auth user id viendo la página — para detectar si fue el primer en marcar */
  currentUserId: string
  /** Quien marcó la no-realización (si alguien lo hizo); null si todavía nadie */
  markedById: string | null
}

/**
 * Botón para marcar una 1:1 como no realizada o, si el otro participante ya
 * marcó con un motivo distinto, generar una disputa.
 *
 * Reglas:
 *  - status='agendada' + scheduled_at en el pasado: mostrar "Marcar como no realizada"
 *  - status='no_realizada' + el current user NO fue quien marcó: mostrar
 *    "Marcar con otro motivo" (esto disparará goToDispute en la action si el
 *    motivo elegido difiere del previo)
 *  - status='en_disputa' o realizada: no mostrar nada (la disputa está en
 *    manos de RH; el participante no puede re-marcar)
 */
export function NonRealizationCTA({
  oneOnOneId,
  scheduledAt,
  status,
  currentUserId,
  markedById,
}: NonRealizationCTAProps) {
  const [open, setOpen] = useState(false)

  const isPast = new Date(scheduledAt) < new Date()
  const canMarkFirst = status === 'agendada' && isPast
  const canDispute = status === 'no_realizada' && markedById !== null && markedById !== currentUserId
  const visible = canMarkFirst || canDispute

  if (!visible) return null

  return (
    <>
      <button
        type="button"
        className={canDispute ? 'ui-btn ui-btn--outline ui-btn--sm' : 'ui-btn ui-btn--ghost ui-btn--sm'}
        onClick={() => setOpen(true)}
        title={canDispute ? 'Marcá con otro motivo si no coincidís — se genera una disputa para revisión de RH' : undefined}
      >
        {canDispute ? <AlertTriangle size={13} /> : <CalendarX size={13} />}
        {canDispute ? 'Marcar con otro motivo' : 'Marcar como no realizada'}
      </button>
      <NonRealizationModal
        oneOnOneId={oneOnOneId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
