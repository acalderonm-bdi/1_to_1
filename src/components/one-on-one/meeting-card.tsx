'use client'

import Link from 'next/link'
import { Calendar, Clock, Video, MapPin, ExternalLink, ArrowRight } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/constants'

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
  const date = new Date(meeting.scheduled_at)
  const dateLabel = date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = date.toTimeString().slice(0, 5)
  const isVirtual = meeting.modality === 'virtual'

  return (
    <div className="ui-card ui-card--hover" style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`avatar avatar--md ${partnerColor}`}>{partnerInitials}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.005em' }}>
              {partnerName}
            </div>
          </div>
        </div>
        <span className={`ui-badge ui-badge--${STATUS_TONE[meeting.status] ?? 'slate'}`}>
          {STATUS_LABELS[meeting.status]}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Calendar size={13} /> {dateLabel}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Clock size={13} /> {time} · {meeting.duration_minutes} min
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {isVirtual ? <Video size={13} /> : <MapPin size={13} />}
          {isVirtual ? 'Virtual' : (meeting.location || 'Presencial')}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid var(--border-c)', marginTop: 4 }}>
        {meeting.meet_link ? (
          <a className="ui-btn ui-btn--ghost ui-btn--sm" href={meeting.meet_link} target="_blank" rel="noreferrer">
            <Video size={13} /> Unirse a Meet <ExternalLink size={11} />
          </a>
        ) : <span />}
        <Link href={href} className="ui-btn ui-btn--outline ui-btn--sm">
          Ver detalle <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  )
}
