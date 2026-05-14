'use client'

import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

interface ParamsSectionProps {
  title: string
  desc?: string
  dirty: boolean
  isPending: boolean
  onSave: () => void
  children: ReactNode
}

export function ParamsSection({
  title,
  desc,
  dirty,
  isPending,
  onSave,
  children,
}: ParamsSectionProps) {
  return (
    <div className="ui-card">
      <div className="ui-card__head">
        <div>
          <h3 className="ui-card__title">{title}</h3>
          {desc && <p className="ui-card__desc">{desc}</p>}
        </div>
        <button
          type="button"
          className="ui-btn ui-btn--accent ui-btn--sm"
          onClick={onSave}
          disabled={!dirty || isPending}
        >
          <Check size={13} /> Guardar
        </button>
      </div>
      <div className="ui-card__body">{children}</div>
    </div>
  )
}
