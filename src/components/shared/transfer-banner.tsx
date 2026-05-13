'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { dismissTransferBanner } from '@/lib/actions/one-on-ones'

interface TransferBannerProps {
  leadershipRelationId: string
  collaboratorName: string
  previousLeaderName: string
  openAgreementsCount: number
}

export function TransferBanner({
  leadershipRelationId,
  collaboratorName,
  previousLeaderName,
  openAgreementsCount,
}: TransferBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (dismissed) return null

  function handleDismiss() {
    startTransition(async () => {
      const result = await dismissTransferBanner({ leadershipRelationId })
      if (result.success) setDismissed(true)
    })
  }

  const plural = openAgreementsCount === 1 ? '' : 's'

  return (
    <div
      role="status"
      className="ui-card"
      style={{
        borderLeft: '4px solid hsl(var(--warning))',
        background: 'hsl(var(--warning) / 0.08)',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '1rem',
      }}
    >
      <div>
        <p style={{ fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: '0.25rem' }}>
          Heredaste {openAgreementsCount} acuerdo{plural} abierto{plural} de {previousLeaderName}
        </p>
        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
          Estos compromisos quedaron pendientes con {collaboratorName} cuando su líder anterior se desvinculó. Repasalos en su próxima 1:1.
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        disabled={isPending}
        aria-label="Cerrar este aviso"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: isPending ? 'wait' : 'pointer',
          color: 'hsl(var(--muted-foreground))',
          padding: '0.25rem',
          flexShrink: 0,
        }}
      >
        <X size={18} />
      </button>
    </div>
  )
}
