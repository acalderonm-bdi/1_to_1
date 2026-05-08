'use client'

import { useState, useTransition } from 'react'
import { Check, X } from 'lucide-react'
import { submitVobo } from '@/lib/actions/vobos'

interface VoboButtonProps {
  oneOnOneId: string
  userVobo: boolean | null
  onVobo?: (confirmed: boolean) => void
  partnerName?: string
}

export function VoboButton({ oneOnOneId, userVobo, onVobo, partnerName }: VoboButtonProps) {
  const [myVobo, setMyVobo] = useState<boolean | null>(userVobo)
  const [isPending, startTransition] = useTransition()

  async function handleVobo(confirmed: boolean) {
    startTransition(async () => {
      const result = await submitVobo({ oneOnOneId, confirmed })
      if (result.success) {
        setMyVobo(confirmed)
        onVobo?.(confirmed)
      }
    })
  }

  if (myVobo !== null) {
    return (
      <div className="vobo">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: myVobo ? 'var(--green-100)' : 'var(--red-100)',
              color: myVobo ? 'var(--green-700)' : 'var(--red-700)',
              display: 'grid', placeItems: 'center'
            }}>
              {myVobo ? <Check size={18} /> : <X size={18} />}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {myVobo ? 'Confirmaste que sí se realizó' : 'Indicaste que no se realizó'}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {partnerName ? `Esperando confirmación de ${partnerName.split(' ')[0]}` : 'Confirmación registrada'}
              </div>
            </div>
          </div>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setMyVobo(null)}>
            <span>Cambiar</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="vobo">
      <h3 className="vobo__title">¿Esta reunión se realizó?</h3>
      <p className="vobo__sub">Tu confirmación es independiente. Si hay contradicción, se levanta una disputa para revisión.</p>
      <div className="vobo__buttons">
        <button
          type="button"
          className="ui-btn ui-btn--success ui-btn--lg"
          onClick={() => handleVobo(true)}
          disabled={isPending}
        >
          {isPending ? <span className="spinner" /> : <Check size={15} />}
          <span>Sí, se realizó</span>
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--danger-outline ui-btn--lg"
          onClick={() => handleVobo(false)}
          disabled={isPending}
        >
          <X size={15} />
          <span>No se realizó</span>
        </button>
      </div>
    </div>
  )
}
