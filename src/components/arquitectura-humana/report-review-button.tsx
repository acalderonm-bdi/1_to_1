'use client'

import { useTransition } from 'react'
import { Check } from 'lucide-react'
import { markReportReviewed } from '@/lib/actions/reports'

interface Props {
  reportId: string
  reviewed: boolean
}

export function ReportReviewButton({ reportId, reviewed }: Props) {
  const [pending, startTransition] = useTransition()

  if (reviewed) {
    return (
      <span className="ui-badge ui-badge--slate ui-badge--plain" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Check size={11} /> Revisado
      </span>
    )
  }

  return (
    <button
      type="button"
      className="ui-btn ui-btn--ghost ui-btn--sm"
      disabled={pending}
      onClick={() => startTransition(async () => { await markReportReviewed({ reportId }) })}
    >
      <Check size={13} /> <span>Marcar como revisado</span>
    </button>
  )
}
