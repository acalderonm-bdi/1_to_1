import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Video, MapPin, Users, ExternalLink } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/dates'
import { STATUS_LABELS } from '@/lib/constants'
import { AgendaList } from '@/components/one-on-one/agenda-list'
import { DetailInteraction } from '@/components/one-on-one/detail-interaction'
import { LeaderInsightPanel } from '@/components/one-on-one/leader-insight-panel'

interface PageProps {
  params: { id: string }
}

export default async function LiderOneOnOneDetailPage({ params }: PageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawMeeting } = await supabase
    .from('one_on_ones')
    .select(`
      id, scheduled_at, duration_minutes, modality, location, meet_link, status,
      leader:users!one_on_ones_leader_id_fkey(id, full_name, email),
      collaborator:users!one_on_ones_collaborator_id_fkey(id, full_name, email)
    `)
    .eq('id', params.id)
    .single()

  if (!rawMeeting) notFound()

  type Participant = { id: string; full_name: string; email: string }
  type MeetingRow = {
    id: string
    scheduled_at: string
    duration_minutes: number
    modality: string
    location: string | null
    meet_link: string | null
    status: string
    leader: Participant | Participant[] | null
    collaborator: Participant | Participant[] | null
  }
  const meeting = rawMeeting as MeetingRow

  const leader = (
    Array.isArray(meeting.leader) ? meeting.leader[0] : meeting.leader
  ) as Participant | null
  const collaborator = (
    Array.isArray(meeting.collaborator)
      ? meeting.collaborator[0]
      : meeting.collaborator
  ) as Participant | null

  if (leader?.id !== user.id) redirect('/lider')

  const [
    { data: agendaItems },
    { data: myMinute },
    { data: agreements },
    { data: myVobo },
    { data: insights },
  ] = await Promise.all([
    supabase
      .from('agenda_items')
      .select('id, content, author_id')
      .eq('one_on_one_id', params.id)
      .order('created_at'),
    supabase
      .from('minutes')
      .select('raw_content')
      .eq('one_on_one_id', params.id)
      .eq('author_id', user.id)
      .maybeSingle(),
    supabase
      .from('agreements')
      .select('id, description, responsible_id, due_date, status, ai_generated')
      .eq('one_on_one_id', params.id)
      .order('created_at'),
    supabase
      .from('vobos')
      .select('confirmed')
      .eq('one_on_one_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('ai_insights')
      .select('id, type, content, created_at')
      .eq('leader_id', user.id)
      .eq('collaborator_id', collaborator?.id ?? '')
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const isPastMeeting = new Date(meeting.scheduled_at) < new Date()
  const participants =
    leader && collaborator
      ? {
          leader: {
            id: leader.id,
            name: leader.full_name,
            email: leader.email,
          },
          collaborator: {
            id: collaborator.id,
            name: collaborator.full_name,
            email: collaborator.email,
          },
        }
      : null

  const voboValue =
    (myVobo as { confirmed: boolean } | null)?.confirmed ?? null

  const STATUS_COLORS: Record<string, string> = {
    agendada: 'bg-blue-100 text-blue-800',
    realizada: 'bg-green-100 text-green-800',
    no_realizada: 'bg-red-100 text-red-800',
    en_disputa: 'bg-orange-100 text-orange-800',
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reunión 1:1</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {formatDateTime(meeting.scheduled_at)} · {meeting.duration_minutes}{' '}
            min
          </p>
        </div>
        <span
          className={`text-sm font-medium px-3 py-1 rounded-full ${STATUS_COLORS[meeting.status] ?? 'bg-slate-100 text-slate-700'}`}
        >
          {STATUS_LABELS[meeting.status] ?? meeting.status}
        </span>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-slate-400" />
            <span>
              <strong>{leader?.full_name}</strong>{' '}
              <span className="text-slate-400">(tú)</span> con{' '}
              <strong>{collaborator?.full_name}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {meeting.modality === 'virtual' ? (
              <Video className="h-4 w-4 text-slate-400" />
            ) : (
              <MapPin className="h-4 w-4 text-slate-400" />
            )}
            <span className="capitalize">
              {meeting.modality === 'virtual'
                ? 'Virtual'
                : `Presencial${meeting.location ? ` · ${meeting.location}` : ''}`}
            </span>
            {meeting.meet_link && (
              <a
                href={meeting.meet_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs flex items-center gap-1 ml-2"
              >
                <ExternalLink className="h-3 w-3" /> Unirse a Meet
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sugerencias de IA para el líder */}
      {collaborator && (
        <LeaderInsightPanel
          collaboratorId={collaborator.id}
          collaboratorName={collaborator.full_name}
          insights={
            (insights ?? []) as Array<{
              id: string
              type: string
              content: unknown
              created_at: string
            }>
          }
        />
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agenda pre-reunión</CardTitle>
        </CardHeader>
        <CardContent>
          <AgendaList
            oneOnOneId={params.id}
            initialItems={
              (agendaItems ?? []) as Array<{
                id: string
                content: string
                author_id: string
              }>
            }
            currentUserId={user.id}
          />
        </CardContent>
      </Card>

      {isPastMeeting && participants && (
        <DetailInteraction
          oneOnOneId={params.id}
          initialMinuteContent={
            (myMinute as { raw_content: string } | null)?.raw_content ?? ''
          }
          initialAgreements={
            (agreements ?? []) as Array<{
              id: string
              description: string
              responsible_id: string
              due_date: string | null
              status: string
              ai_generated: boolean
            }>
          }
          participants={participants}
          hasVobo={myVobo !== null}
          voboValue={voboValue}
          pendingPrevAgreements={[]}
          currentUserId={user.id}
          meetingStatus={meeting.status}
        />
      )}

      {!isPastMeeting && (
        <p className="text-sm text-slate-400 text-center py-4">
          La minuta y acuerdos estarán disponibles después de la reunión.
        </p>
      )}
    </div>
  )
}
