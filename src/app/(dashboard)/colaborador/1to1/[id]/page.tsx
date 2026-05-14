import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Calendar, Clock, Video, MapPin, ChevronLeft, MoreHorizontal, ArrowRight } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/constants'
import { AgendaList } from '@/components/one-on-one/agenda-list'
import { DetailInteraction } from '@/components/one-on-one/detail-interaction'
import { labelForReason } from '@/components/one-on-one/non-realization-modal'
import { EmptyState } from '@/components/shared/empty-state'
import { getOrgSetting } from '@/lib/org-settings'

const STATUS_TONE: Record<string, string> = {
  agendada: 'blue', realizada: 'green', no_realizada: 'red', en_disputa: 'orange',
}

interface Participant { id: string; full_name: string; email: string }
interface Marker { id: string; full_name: string }
// Las columnas non_realization_note/marked_by/marked_at fueron añadidas en la
// migración 7b pero todavía no están en el tipo `Database` generado. Las
// reflejamos manualmente acá (ver `src/types/database.augmentation.ts`).
interface MeetingDetail {
  id: string; scheduled_at: string; duration_minutes: number
  modality: string; location: string | null; meet_link: string | null
  status: string; non_realization_reason: string | null
  non_realization_note: string | null
  non_realization_marked_by: string | null
  non_realization_marked_at: string | null
  leader: Participant | Participant[] | null
  collaborator: Participant | Participant[] | null
  non_realization_marker: Marker | Marker[] | null
}

export default async function OneOnOneDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawMeeting } = await supabase
    .from('one_on_ones')
    .select(`
      id, scheduled_at, duration_minutes, modality, location, meet_link, status, non_realization_reason,
      non_realization_note, non_realization_marked_by, non_realization_marked_at,
      leader:users!one_on_ones_leader_id_fkey(id, full_name, email),
      collaborator:users!one_on_ones_collaborator_id_fkey(id, full_name, email),
      non_realization_marker:users!one_on_ones_non_realization_marked_by_fkey(id, full_name)
    `)
    .eq('id', params.id).single()
  if (!rawMeeting) notFound()
  const meeting = rawMeeting as unknown as MeetingDetail
  const leader = (Array.isArray(meeting.leader) ? meeting.leader[0] : meeting.leader) as Participant | null
  const collaborator = (Array.isArray(meeting.collaborator) ? meeting.collaborator[0] : meeting.collaborator) as Participant | null
  const nonRealizationMarker = (Array.isArray(meeting.non_realization_marker)
    ? meeting.non_realization_marker[0]
    : meeting.non_realization_marker) as Marker | null

  const isParticipant = leader?.id === user.id || collaborator?.id === user.id
  if (!isParticipant) redirect('/colaborador')

  const { data: rawAgenda } = await supabase
    .from('agenda_items').select('id, content, author_id').eq('one_on_one_id', params.id).order('created_at')
  const { data: rawMinute } = await supabase
    .from('minutes').select('raw_content, author_id, updated_at').eq('one_on_one_id', params.id).maybeSingle()
  const { data: rawAgreements } = await supabase
    .from('agreements').select('id, description, responsible_id, due_date, status, ai_generated').eq('one_on_one_id', params.id).order('created_at')
  const { data: rawVobos } = await supabase
    .from('vobos').select('user_id, confirmed').eq('one_on_one_id', params.id)

  // F6: ¿el colaborador ya respondió la encuesta de calidez? Gate del VoBo.
  const warmthCountQuery = (await supabase
    .from('meeting_warmth_responses' as never)
    .select('id', { count: 'exact', head: true })
    .eq('one_on_one_id' as never, params.id)
    .eq('collaborator_id' as never, user.id)) as unknown as { count: number | null }
  const hasWarmthResponse = (warmthCountQuery.count ?? 0) > 0

  const { data: rawPrevAgreements } = await supabase
    .from('agreements')
    .select(`id, description, due_date, one_on_ones!inner(leader_id, collaborator_id, scheduled_at)`)
    .eq('responsible_id', user.id)
    .eq('status', 'pendiente')
    .neq('one_on_one_id', params.id)
    .limit(5)
  const pendingPrevAgreements = ((rawPrevAgreements ?? []) as Array<{
    id: string; description: string; due_date: string | null
  }>).map(a => ({ id: a.id, description: a.description, due_date: a.due_date }))

  // Labels configurables de la encuesta de calidez — los lee el server y los
  // baja al cliente vía DetailInteraction → WarmthSurvey.
  const warmthQuestions = await getOrgSetting('warmth_questions')

  const isPastMeeting = new Date(meeting.scheduled_at) < new Date()
  const vobos = (rawVobos ?? []) as Array<{ user_id: string; confirmed: boolean }>
  const myVoboRow = vobos.find(v => v.user_id === user.id)
  const myVobo = myVoboRow ? { confirmed: myVoboRow.confirmed } : null
  const partnerVoboRow = vobos.find(v => v.user_id !== user.id)
  const partnerVobo: boolean | null = partnerVoboRow ? partnerVoboRow.confirmed : null
  const date = new Date(meeting.scheduled_at)
  const dateLabel = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = date.toTimeString().slice(0, 5)

  const participants = leader && collaborator
    ? {
        leader: { id: leader.id, name: leader.full_name, email: leader.email },
        collaborator: { id: collaborator.id, name: collaborator.full_name, email: collaborator.email },
      }
    : null

  const partnerName = leader?.id === user.id ? collaborator?.full_name ?? '' : leader?.full_name ?? ''
  const lInit = leader?.full_name.split(' ').map(p => p[0]).slice(0, 2).join('') ?? '?'
  const cInit = collaborator?.full_name.split(' ').map(p => p[0]).slice(0, 2).join('') ?? '?'

  const authorMap: Record<string, string> = {}
  if (leader) authorMap[leader.id] = leader.full_name
  if (collaborator) authorMap[collaborator.id] = collaborator.full_name

  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <Link href="/colaborador" className="ui-btn ui-btn--ghost ui-btn--sm">
          <ChevronLeft size={13} /> Volver al inicio
        </Link>
      </div>

      <div className="hero-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span className={`ui-badge ui-badge--${STATUS_TONE[meeting.status] ?? 'slate'}`}>
                {STATUS_LABELS[meeting.status]}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                · 1:1 quincenal
              </span>
            </div>
            <h1 className="font-serif" style={{ fontSize: 30, letterSpacing: '-0.024em', fontWeight: 500, margin: '0 0 4px', lineHeight: 1.1 }}>
              1:1 con {partnerName}
            </h1>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 22,
                marginTop: 14,
                fontSize: 13.5,
                color: 'var(--text-muted)',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} /> {dateLabel}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} /> {time} · {meeting.duration_minutes} min
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {meeting.modality === 'virtual' ? <Video size={14} /> : <MapPin size={14} />}
                {meeting.modality === 'virtual' ? 'Google Meet' : (meeting.location ?? 'Presencial')}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginTop: 22,
                padding: '12px 14px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-c)',
                borderRadius: 'var(--r-md)',
                width: 'fit-content',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="avatar avatar--sm av-violet">{lInit}</div>
                <div style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 500, letterSpacing: '-0.005em' }}>{leader?.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                    Líder
                  </div>
                </div>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--text-subtle)', margin: '0 4px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="avatar avatar--sm av-blue">{cInit}</div>
                <div style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 500, letterSpacing: '-0.005em' }}>{collaborator?.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                    Colaborador
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {meeting.meet_link && (
              <a href={meeting.meet_link} target="_blank" rel="noreferrer" className="ui-btn ui-btn--lime">
                <Video size={14} /> <span>Unirse a Meet</span>
              </a>
            )}
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon" aria-label="Más opciones">
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        {meeting.status === 'no_realizada' && meeting.non_realization_reason && (
          <div
            className="ui-card"
            style={{
              padding: 16,
              borderLeft: '3px solid var(--accent-red, #b91c1c)',
              background: 'var(--bg-subtle)',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.005em', marginBottom: 6 }}>
              Sesión no realizada — {labelForReason(meeting.non_realization_reason)}
            </div>
            {meeting.non_realization_note && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                {meeting.non_realization_note}
              </div>
            )}
            {meeting.non_realization_marked_at && (
              <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', marginTop: 8 }}>
                Registrado por {nonRealizationMarker?.full_name ?? 'usuario'} el{' '}
                {new Date(meeting.non_realization_marked_at).toLocaleDateString('es-MX')}
              </div>
            )}
          </div>
        )}

        <div className="ui-card">
          <div className="ui-card__head">
            <div>
              <h3 className="ui-card__title">Agenda</h3>
              <p className="ui-card__desc">Temas que ambos pueden agregar antes de la reunión</p>
            </div>
          </div>
          <div className="ui-card__body">
            <AgendaList
              oneOnOneId={params.id}
              initialItems={(rawAgenda ?? []) as Array<{ id: string; content: string; author_id: string }>}
              currentUserId={user.id}
              authorMap={authorMap}
            />
          </div>
        </div>

        {isPastMeeting && participants && (
          <DetailInteraction
            oneOnOneId={params.id}
            initialMinuteContent={(rawMinute as { raw_content: string } | null)?.raw_content ?? ''}
            initialAgreements={(rawAgreements ?? []) as Array<{ id: string; description: string; responsible_id: string; due_date: string | null; status: string; ai_generated: boolean }>}
            participants={participants}
            hasVobo={myVobo !== null}
            voboValue={myVobo?.confirmed ?? null}
            partnerVobo={partnerVobo}
            pendingPrevAgreements={pendingPrevAgreements}
            currentUserId={user.id}
            meetingStatus={meeting.status}
            partnerName={partnerName}
            hasWarmthResponse={hasWarmthResponse}
            warmthQuestions={warmthQuestions}
          />
        )}

        {!isPastMeeting && (
          <div className="ui-card" style={{ padding: 0 }}>
            <EmptyState
              illustration="meetings"
              title="Aún no es hora"
              description="La minuta y los acuerdos estarán disponibles después de la reunión. Mientras tanto, agreguen los temas que quieran tratar en la agenda."
            />
          </div>
        )}
      </div>
    </div>
  )
}
