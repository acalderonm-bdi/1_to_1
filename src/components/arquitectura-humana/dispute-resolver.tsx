'use client'

import { useTransition } from 'react'
import { Check, X } from 'lucide-react'
import { resolveDispute } from '@/lib/actions/disputes'

interface Props {
  oneOnOneId: string
}

export function DisputeResolver({ oneOnOneId }: Props) {
  const [pending, startTransition] = useTransition()

  function resolve(resolution: 'realizada' | 'no_realizada') {
    if (pending) return
    if (!confirm(
      resolution === 'realizada'
        ? '¿Marcar esta 1:1 como REALIZADA? Esto cierra la disputa.'
        : '¿Marcar esta 1:1 como NO REALIZADA? Esto cierra la disputa.'
    )) return
    startTransition(async () => {
      await resolveDispute({ oneOnOneId, resolution })
    })
  }

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      marginTop: 16,
      paddingTop: 14,
      borderTop: '1px dashed var(--orange-200)',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', alignSelf: 'center', marginRight: 4 }}>
        Resolución HR:
      </span>
      <button
        type="button"
        className="ui-btn ui-btn--success ui-btn--sm"
        onClick={() => resolve('realizada')}
        disabled={pending}
      >
        <Check size={13} /> <span>Sí se realizó</span>
      </button>
      <button
        type="button"
        className="ui-btn ui-btn--danger-outline ui-btn--sm"
        onClick={() => resolve('no_realizada')}
        disabled={pending}
      >
        <X size={13} /> <span>No se realizó</span>
      </button>
    </div>
  )
}
