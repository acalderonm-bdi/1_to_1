import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Calendar, Clock, Video, MapPin, ChevronLeft, MoreHorizontal, ArrowRight } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/constants'
import { AgendaList } from '@/components/one-on-one/agenda-list'
import { DetailInteraction } from '@/components/one-on-one/detail-interaction'
import { LeaderInsightPanel } from '@/components/one-on-one/leader-insight-panel'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { InitialsAvatar } from '@/components/shared/initials-avatar'

const STATUS_VARIANT: Record<string, 'muted' | 'success' | 'destructive' | 'warning'> = {
  agendada: 'muted',
  realizada: 'success',
  no_realizada: 'destructive',
  en_disputa: 'warning',
}

interface Participant { id: string; full_name: string; email: string }
interface MeetingRow {
  id: string; scheduled_at: string; duration_minutes: number
  modality: string; location: string | null; meet_link: string | null; status: string
  leader: Participant | Participant[] | null
  collaborator: Participant | Participant[] | null
}

export default async function LiderOneOnOneDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: raw } = await supabase
    .from('one_on_ones')
    .select(`
      id, scheduled_at, duration_minutes, modality, location, meet_link, status,
      leader:users!one_on_ones_leader_id_fkey(id, full_name, email),
      collaborator:users!one_on_ones_collaborator_id_fkey(id, full_name, email)
    `)
    .eq('id', params.id).single()
  if (!raw) notFound()
  const meeting = raw as MeetingRow
  const leader = (Array.isArray(meeting.leader) ? meeting.leader[0] : meeting.leader) as Participant | null
  const collaborator = (Array.isArray(meeting.collaborator) ? meeting.collaborator[0] : meeting.collaborator) as Participant | null
  if (leader?.id !== user.id) redirect('/lider')

  const [
    { data: rawAgenda }, { data: rawMinute }, { data: rawAgreements }, { data: rawVobo }, { data: rawInsights },
  ] = await Promise.all([
    supabase.from('agenda_items').select('id, content, author_id').eq('one_on_one_id', params.id).order('created_at'),
    supabase.from('minutes').select('raw_content').eq('one_on_one_id', params.id).eq('author_id', user.id).maybeSingle(),
    supabase.from('agreements').select('id, description, responsible_id, due_date, status, ai_generated').eq('one_on_one_id', params.id).order('created_at'),
    supabase.from('vobos').select('confirmed').eq('one_on_one_id', params.id).eq('user_id', user.id).maybeSingle(),
    supabase.from('ai_insights').select('id, type, content, created_at').eq('leader_id', user.id).eq('collaborator_id', collaborator?.id ?? '').eq('used', false).order('created_at', { ascending: false }).limit(3),
  ])

  const isPastMeeting = new Date(meeting.scheduled_at) < new Date()
  const myVobo = rawVobo as { confirmed: boolean } | null
  const date = new Date(meeting.scheduled_at)
  const dateLabel = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = date.toTimeString().slice(0, 5)

  const participants = leader && collaborator
    ? {
        leader: { id: leader.id, name: leader.full_name, email: leader.email },
        collaborator: { id: collaborator.id, name: collaborator.full_name, email: collaborator.email },
      }
    : null
  const partnerName = collaborator?.full_name ?? ''

  const authorMap: Record<string, string> = {}
  if (leader) authorMap[leader.id] = leader.full_name
  if (collaborator) authorMap[collaborator.id] = collaborator.full_name

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 anim-fade-in">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/lider"><ChevronLeft className="size-3.5" /> Volver al inicio</Link>
        </Button>
      </div>

      <Card className="mb-5">
        <div className="px-6 py-5 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant={STATUS_VARIANT[meeting.status] ?? 'muted'}>{STATUS_LABELS[meeting.status]}</Badge>
              <span className="text-[11px] text-muted-foreground uppercase tracking-[0.08em] font-medium">· 1:1 quincenal</span>
            </div>
            <h1 className="text-[26px] font-medium tracking-tight leading-tight">1:1 con {partnerName}</h1>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 mt-3 text-[13.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5" /> {dateLabel}</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" /> {time} · {meeting.duration_minutes} min</span>
              <span className="inline-flex items-center gap-1.5">
                {meeting.modality === 'virtual' ? <Video className="size-3.5" /> : <MapPin className="size-3.5" />}
                {meeting.modality === 'virtual' ? 'Google Meet' : (meeting.location ?? 'Presencial')}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-5 px-3.5 py-2.5 border rounded-md bg-secondary/40 w-fit">
              <ParticipantChip name={leader?.full_name ?? ''} role="Tú · Líder" />
              <ArrowRight className="size-3.5 text-muted-foreground/60" />
              <ParticipantChip name={collaborator?.full_name ?? ''} role="Colaborador" />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {meeting.meet_link && (
              <Button asChild variant="brand">
                <a href={meeting.meet_link} target="_blank" rel="noreferrer">
                  <Video className="size-3.5" /> Unirse a Meet
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon" aria-label="Más opciones">
              <MoreHorizontal className="size-4" />
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="grid gap-5 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Agenda</CardTitle>
              <CardDescription>Temas para esta reunión.</CardDescription>
            </CardHeader>
            <CardContent>
              <AgendaList
                oneOnOneId={params.id}
                initialItems={(rawAgenda ?? []) as Array<{ id: string; content: string; author_id: string }>}
                currentUserId={user.id}
                authorMap={authorMap}
              />
            </CardContent>
          </Card>

          {isPastMeeting && participants && (
            <DetailInteraction
              oneOnOneId={params.id}
              initialMinuteContent={(rawMinute as { raw_content: string } | null)?.raw_content ?? ''}
              initialAgreements={(rawAgreements ?? []) as Array<{ id: string; description: string; responsible_id: string; due_date: string | null; status: string; ai_generated: boolean }>}
              participants={participants}
              hasVobo={myVobo !== null}
              voboValue={myVobo?.confirmed ?? null}
              pendingPrevAgreements={[]}
              currentUserId={user.id}
              meetingStatus={meeting.status}
              partnerName={partnerName}
            />
          )}

          {!isPastMeeting && (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={Clock}
                  title="Aún no es hora"
                  description="La minuta y los acuerdos estarán disponibles después de la reunión. Mientras tanto, agreguen los temas que quieran tratar en la agenda."
                />
              </CardContent>
            </Card>
          )}
        </div>

        {collaborator && (
          <LeaderInsightPanel
            collaboratorId={collaborator.id}
            collaboratorName={collaborator.full_name}
            insights={(rawInsights ?? []) as Array<{ id: string; type: string; content: unknown; created_at: string }>}
          />
        )}
      </div>
    </div>
  )
}

function ParticipantChip({ name, role }: { name: string; role: string }) {
  return (
    <div className="flex items-center gap-2">
      <InitialsAvatar name={name} size="sm" />
      <div className="leading-tight">
        <div className="text-[13px] font-medium">{name}</div>
        <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">{role}</div>
      </div>
    </div>
  )
}
