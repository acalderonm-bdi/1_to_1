'use client'

import { useState, useTransition } from 'react'
import { Check, X, ShieldCheck, Loader2 } from 'lucide-react'
import { submitVobo } from '@/lib/actions/vobos'

interface VoboButtonProps {
  oneOnOneId: string
  userVobo: boolean | null
  /** Información del compañero para mostrar "esperando a X" o el conteo. */
  partnerName?: string
  partnerVobo?: boolean | null
  /** Si la 1:1 todavía no tiene acuerdos registrados, el VoBo está bloqueado. */
  agreementsCount: number
}

function ApprovalCounter({ mine, partner }: { mine: boolean | null; partner: boolean | null }) {
  const mineApproved = mine === true
  const partnerApproved = partner === true
  const approvedCount = (mineApproved ? 1 : 0) + (partnerApproved ? 1 : 0)
  const tone = approvedCount === 2 ? 'green' : approvedCount === 1 ? 'amber' : 'slate'
  return (
    <span className={`ui-badge ui-badge--${tone}`} style={{ fontSize: 11.5 }}>
      <ShieldCheck size={12} /> {approvedCount}/2 aprobaciones
    </span>
  )
}

export function VoboButton({ oneOnOneId, userVobo, partnerName, partnerVobo = null, agreementsCount }: VoboButtonProps) {
  const [myVobo, setMyVobo] = useState<boolean | null>(userVobo)
  const [isPending, startTransition] = useTransition()

  async function handleVobo(confirmed: boolean) {
    startTransition(async () => {
      const result = await submitVobo({ oneOnOneId, confirmed })
      if (result.success) {
        setMyVobo(confirmed)
      }
    })
  }

  const partnerFirst = partnerName?.split(' ')[0] ?? 'la otra persona'

  // Sin acuerdos no se puede aprobar todavía.
  if (agreementsCount === 0) {
    return (
      <div className="vobo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h3 className="vobo__title" style={{ margin: 0 }}>¿Apruebas los acuerdos?</h3>
          <ApprovalCounter mine={null} partner={null} />
        </div>
        <p className="vobo__sub">
          Aún no hay acuerdos registrados. Agreguen al menos uno (manual o vía IA) para poder aprobar y cerrar la reunión.
        </p>
      </div>
    )
  }

  // Ya voté
  if (myVobo !== null) {
    const bothApproved = myVobo === true && partnerVobo === true
    const bothDenied = myVobo === false && partnerVobo === false
    const conflict = (myVobo === true && partnerVobo === false) || (myVobo === false && partnerVobo === true)
    const waiting = partnerVobo === null

    return (
      <div className="vobo">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: myVobo ? 'hsl(var(--success) / 0.15)' : 'hsl(var(--destructive) / 0.15)',
              color: myVobo ? 'hsl(var(--success))' : 'hsl(var(--destructive))',
              display: 'grid', placeItems: 'center',
            }}>
              {myVobo ? <Check size={18} /> : <X size={18} />}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {myVobo ? 'Aprobaste los acuerdos' : 'Indicaste que no apruebas'}
                <ApprovalCounter mine={myVobo} partner={partnerVobo} />
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {bothApproved && '✓ Ambos aprobaron — la reunión se marcó como realizada'}
                {bothDenied && '✗ Ambos indicaron que no aprueban — reunión marcada como no realizada'}
                {conflict && '⚠ Hay discrepancia — la 1:1 entró en disputa, revisará Arquitectura Humana'}
                {waiting && `Esperando aprobación de ${partnerFirst}`}
              </div>
            </div>
          </div>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setMyVobo(null)} disabled={isPending}>
            <span>Cambiar</span>
          </button>
        </div>
      </div>
    )
  }

  // No he votado
  return (
    <div className="vobo">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <h3 className="vobo__title" style={{ margin: 0 }}>¿Apruebas los acuerdos registrados?</h3>
        <ApprovalCounter mine={null} partner={partnerVobo} />
      </div>
      <p className="vobo__sub">
        Tu aprobación confirma que la reunión se realizó y que los compromisos quedan tal como están listados arriba.
        {partnerVobo === true && ` ${partnerFirst} ya aprobó — falta tu confirmación para cerrar.`}
        {partnerVobo === false && ` ${partnerFirst} indicó que no aprueba — si tú lo haces, se levantará una disputa.`}
        {' '}Si modifican los acuerdos después, ambos deberán aprobar de nuevo.
      </p>
      <div className="vobo__buttons">
        <button
          type="button"
          className="ui-btn ui-btn--success ui-btn--lg"
          onClick={() => handleVobo(true)}
          disabled={isPending}
        >
          {isPending ? <Loader2 size={15} className="spinner" /> : <Check size={15} />}
          <span>Sí, apruebo</span>
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--danger-outline ui-btn--lg"
          onClick={() => handleVobo(false)}
          disabled={isPending}
        >
          <X size={15} />
          <span>No estoy de acuerdo</span>
        </button>
      </div>
    </div>
  )
}
