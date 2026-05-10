'use client'

import Link from 'next/link'
import { Calendar, Clock, Video, MapPin, ExternalLink, ArrowRight } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/constants'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InitialsAvatar } from '@/components/shared/initials-avatar'

const STATUS_VARIANT: Record<string, 'muted' | 'success' | 'destructive' | 'warning'> = {
  agendada: 'muted',
  realizada: 'success',
  no_realizada: 'destructive',
  en_disputa: 'warning',
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
  partnerInitials?: string  // kept for backwards compat — InitialsAvatar derives them
  partnerColor?: string     // unused in new DS; kept for compat
  href: string
}

export function MeetingCard({ meeting, partnerName, href }: MeetingCardProps) {
  const date = new Date(meeting.scheduled_at)
  const dateLabel = date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = date.toTimeString().slice(0, 5)
  const isVirtual = meeting.modality === 'virtual'

  return (
    <Card className="p-4 grid gap-3 hover:bg-secondary/30 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <InitialsAvatar name={partnerName} size="md" />
          <div className="text-sm font-medium tracking-tight truncate">{partnerName}</div>
        </div>
        <Badge variant={STATUS_VARIANT[meeting.status] ?? 'muted'} className="text-[10.5px]">
          {STATUS_LABELS[meeting.status]}
        </Badge>
      </div>
      <div className="flex items-center gap-4 flex-wrap text-[12.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Calendar className="size-3" /> {dateLabel}</span>
        <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {time} · {meeting.duration_minutes} min</span>
        <span className="inline-flex items-center gap-1">
          {isVirtual ? <Video className="size-3" /> : <MapPin className="size-3" />}
          {isVirtual ? 'Virtual' : (meeting.location || 'Presencial')}
        </span>
      </div>
      <div className="flex items-center justify-between pt-2 border-t mt-1">
        {meeting.meet_link ? (
          <Button asChild size="sm" variant="ghost">
            <a href={meeting.meet_link} target="_blank" rel="noreferrer">
              <Video className="size-3" /> Unirse a Meet <ExternalLink className="size-3" />
            </a>
          </Button>
        ) : <span />}
        <Button asChild size="sm" variant="outline">
          <Link href={href}>Ver detalle <ArrowRight className="size-3" /></Link>
        </Button>
      </div>
    </Card>
  )
}
