'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Video, MapPin, ExternalLink } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/dates'
import { STATUS_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils/cn'

interface MeetingCardProps {
  meeting: {
    id: string
    scheduled_at: string
    duration_minutes: number
    modality: string
    location: string | null
    meet_link: string | null
    status: string
    leader: { full_name: string } | null
    collaborator: { full_name: string } | null
  }
  currentUserId: string
  href: string
}

const STATUS_COLORS: Record<string, string> = {
  agendada: 'bg-blue-100 text-blue-800',
  realizada: 'bg-green-100 text-green-800',
  no_realizada: 'bg-red-100 text-red-800',
  en_disputa: 'bg-orange-100 text-orange-800',
}

export function MeetingCard({ meeting, href }: MeetingCardProps) {
  return (
    <Card className="hover:border-slate-300 transition-colors">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="text-sm font-medium">{formatDateTime(meeting.scheduled_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              {meeting.modality === 'virtual' ? (
                <Video className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              ) : (
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
              <span className="text-xs text-slate-500 capitalize">
                {meeting.modality === 'virtual' ? 'Virtual' : `Presencial${meeting.location ? ` · ${meeting.location}` : ''}`}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {meeting.meet_link && meeting.status === 'agendada' && (
                <a
                  href={meeting.meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                  Unirse a Meet
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={cn('text-xs font-medium px-2 py-1 rounded-full', STATUS_COLORS[meeting.status] ?? 'bg-slate-100 text-slate-700')}>
              {STATUS_LABELS[meeting.status] ?? meeting.status}
            </span>
            <Button asChild size="sm" variant="outline" className="text-xs h-7">
              <Link href={href}>Ver detalle</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
