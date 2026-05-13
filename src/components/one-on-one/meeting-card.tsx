'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Clock, Video, MapPin, ExternalLink, ArrowRight } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/constants'
import { NonRealizationModal } from './non-realization-modal'

const STATUS_TONE: Record<string, string> = {
  agendada: 'blue', realizada: 'green', no_realizada: 'red', en_disputa: 'orange',
}

interface MeetingCardProps {
  meeting: {
    id: string
    scheduled_at: string
    duration_minutes: number
    modality: string
    location: string | null
    meet_link: string | null
    status: string
  }
  partnerName: string
  partnerInitials: string
  partnerColor?: string
  href: string
}

export function MeetingCard({ meeting, partnerName, partnerInitials, partnerColor = 'av-blue', href }: MeetingCardProps) {
  const [showNonRealization, setShowNonRealization] = useState(false)
  const date = new Date(meeting.scheduled_at)
  const dateLabel = date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = date.toTimeString().slice(0, 5)
  const isVirtual = meeting.modality === 'virtual'
  const canMarkNonRealized = meeting.status === 'agendada' && date < new Date()

  return (
    <div className="ui-card ui-card--hover" style={{ padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div className={`avatar avatar--md avatar--ring ${partnerColor}`}>{partnerInitials}</div>
          <div style={{ minWidth: 0 }}>
            <div className="u-truncate" style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.008em' }}>
              {partnerName}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              1:1 · {meeting.duration_minutes} min
            </div>
          </div>
        </div>
        <span className={`ui-badge ui-badge--${STATUS_TONE[meeting.status] ?? 'slate'}`}>
          {STATUS_LABELS[meeting.status]}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span className="agreement__meta-item">
          <Calendar size={13} /> {dateLabel}
        </span>
        <span className="agreement__meta-item">
          <Clock size={13} /> {time}
        </span>
        <span className="agreement__meta-item">
          {isVirtual ? <Video size={13} /> : <MapPin size={13} />}
          {isVirtual ? 'Virtual' : (meeting.location || 'Presencial')}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-c)' }}>
        {meeting.meet_link ? (
          <a className="ui-btn ui-btn--lime ui-btn--sm" href={meeting.meet_link} target="_blank" rel="noreferrer">
            <Video size={13} /> <span>Unirse a Meet</span> <ExternalLink size={11} />
          </a>
        ) : <span />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {canMarkNonRealized && (
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--sm"
              onClick={() => setShowNonRealization(true)}
            >
              Marcar como no realizada
            </button>
          )}
          <Link href={href} className="ui-btn ui-btn--outline ui-btn--sm">
            <span>Ver detalle</span> <ArrowRight size={12} />
          </Link>
        </div>
      </div>
      {canMarkNonRealized && (
        <NonRealizationModal
          oneOnOneId={meeting.id}
          open={showNonRealization}
          onOpenChange={setShowNonRealization}
        />
      )}
    </div>
  )
}
