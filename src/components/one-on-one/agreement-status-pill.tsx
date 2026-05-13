'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'
import { updateAgreementStatus } from '@/lib/actions/agreements'
import { AGREEMENT_LABELS } from '@/lib/constants'

const TONE: Record<string, string> = {
  pendiente: 'amber', cumplido: 'green', parcial: 'blue', no_cumplido: 'red',
}
const OPTIONS = ['pendiente', 'cumplido', 'parcial', 'no_cumplido'] as const

interface Props {
  agreementId: string
  status: string
  overdue?: boolean
}

export function AgreementStatusPill({ agreementId, status, overdue = false }: Props) {
  const [open, setOpen] = useState(false)
  const [optimistic, setOptimistic] = useState(status)
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => setOptimistic(status), [status])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function pick(next: typeof OPTIONS[number]) {
    if (next === optimistic) { setOpen(false); return }
    setOptimistic(next)
    setOpen(false)
    startTransition(async () => {
      const result = await updateAgreementStatus({ agreementId, status: next })
      if (!result.success) {
        setOptimistic(status)
      } else {
        router.refresh()
      }
    })
  }

  const tone = overdue && optimistic === 'pendiente' ? 'red' : TONE[optimistic] ?? 'slate'
  const label = overdue && optimistic === 'pendiente' ? 'Vencido' : AGREEMENT_LABELS[optimistic] ?? optimistic

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={pending}
        className={`ui-badge ui-badge--${tone}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          border: 'none',
          cursor: pending ? 'wait' : 'pointer',
          font: 'inherit',
          opacity: pending ? 0.7 : 1,
          transition: 'opacity 0.15s',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {label}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div
          className="popover anim-fade-in"
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 160,
            zIndex: 20,
            padding: 6,
            display: 'grid',
            gap: 2,
          }}
        >
          {OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => pick(opt)}
              className="popover__item"
              role="option"
              aria-selected={opt === optimistic}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 10px',
                fontSize: 13,
                background: opt === optimistic ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                color: 'var(--text-c)',
                font: 'inherit',
              }}
            >
              <span
                className={`ui-badge ui-badge--${TONE[opt]}`}
                style={{ minWidth: 86, justifyContent: 'center' }}
              >
                {AGREEMENT_LABELS[opt]}
              </span>
              {opt === optimistic && <Check size={13} style={{ marginLeft: 'auto', color: 'hsl(var(--primary))' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
