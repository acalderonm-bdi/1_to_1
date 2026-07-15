import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Calendar, CheckSquare, ArrowRight, Video, MapPin, Sparkles, AlertCircle } from 'lucide-react'
import { STATUS_LABELS, AGREEMENT_LABELS } from '@/lib/constants'
import { EmptyState } from '@/components/shared/empty-state'
import { meetingTime, meetingDate } from '@/lib/meetings/format'

export default async function ColaboradorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase.from('users').select('full_name').eq('id', user.id).single()
  const profile = rawProfile as { full_name: string } | null

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const { data: rawUpcoming } = await supabase
    .from('one_on_ones')
    .select('id, scheduled_at, modality, location, meet_link, status, leader_id')
    .or(`leader_id.eq.${user.id},collaborator_id.eq.${user.id}`)
    .eq('status', 'agendada')
    .gte('scheduled_at', startOfToday.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5)

  const upcoming = (rawUpcoming ?? []) as Array<{
    id: string; scheduled_at: string; modality: string; location: string | null;
    meet_link: string | null; status: string; leader_id: string
  }>

  // 1:1s pasadas sin VoBo del usuario → "esperan tu confirmación"
  const { data: rawPast } = await supabase
    .from('one_on_ones')
    .select('id, scheduled_at, modality, status, leader_id, vobos!left(user_id)')
    .or(`leader_id.eq.${user.id},collaborator_id.eq.${user.id}`)
    .eq('status', 'agendada')
    .lt('scheduled_at', startOfToday.toISOString())
    .order('scheduled_at', { ascending: false })
    .limit(5)
  const pendingVobo = ((rawPast ?? []) as Array<{
    id: string; scheduled_at: string; modality: string; status: string; leader_id: string
    vobos: Array<{ user_id: string }>
  }>).filter(m => !m.vobos.some(v => v.user_id === user.id))

  const allLeaderIds = Array.from(new Set([...upcoming.map(m => m.leader_id), ...pendingVobo.map(m => m.leader_id)]))
  let leaderMap: Record<string, string> = {}
  if (allLeaderIds.length > 0) {
    const { data: leaders } = await supabase.from('users').select('id, full_name').in('id', allLeaderIds)
    leaderMap = Object.fromEntries((leaders ?? []).map(l => [l.id, (l as { full_name: string }).full_name]))
  }

  const { data: rawAgreements } = await supabase
    .from('agreements')
    .select('id, description, status, due_date')
    .eq('responsible_id', user.id)
    .eq('status', 'pendiente')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(5)
  const pendingAgreements = (rawAgreements ?? []) as Array<{ id: string; description: string; status: string; due_date: string | null }>

  const { count: realizedCount } = await supabase
    .from('one_on_ones')
    .select('id', { count: 'exact', head: true })
    .or(`leader_id.eq.${user.id},collaborator_id.eq.${user.id}`)
    .eq('status', 'realizada')

  const { count: completedAgreements } = await supabase
    .from('agreements')
    .select('id', { count: 'exact', head: true })
    .eq('responsible_id', user.id)
    .eq('status', 'cumplido')

  const firstName = profile?.full_name.split(' ')[0] ?? 'equipo'
  const MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
  const today = new Date()
  const isOverdue = (dueIso: string | null) => dueIso ? new Date(dueIso) < today : false

  function formatDueDate(due: string) {
    const d = new Date(due)
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Sparkles size={12} /> Tu espacio personal</span>
          <h1 className="page__title">Hola, {firstName}</h1>
          <p className="page__subtitle">
            Aquí está un resumen de tus próximas 1:1s y los compromisos que tienes abiertos.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }} className="anim-stagger">
        <div className="kpi">
          <div className="kpi__icon kpi__icon--blue"><Calendar /></div>
          <div className="kpi__label">Próximas 1:1s</div>
          <div className="kpi__value u-tabular">{upcoming.length}</div>
          <div className="kpi__delta">agendadas</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--green"><CheckSquare /></div>
          <div className="kpi__label">Acuerdos cumplidos</div>
          <div className="kpi__value u-tabular">{completedAgreements ?? 0}</div>
          <div className="kpi__delta">en total</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--violet"><Sparkles /></div>
          <div className="kpi__label">1:1s realizadas</div>
          <div className="kpi__value u-tabular">{realizedCount ?? 0}</div>
          <div className="kpi__delta">tu historial</div>
        </div>
      </div>

      {pendingVobo.length > 0 && (
        <div className="ui-card" style={{ marginBottom: 18, borderColor: 'hsl(var(--warning) / 0.4)' }}>
          <div className="ui-card__head" style={{ borderBottom: '1px solid hsl(var(--warning) / 0.4)' }}>
            <div>
              <h3 className="ui-card__title">
                <AlertCircle size={15} style={{ color: 'hsl(var(--warning))' }} /> Esperan tu confirmación
              </h3>
              <p className="ui-card__desc">
                {pendingVobo.length} 1:1 {pendingVobo.length === 1 ? 'pasada' : 'pasadas'} sin marcar si se realizó.
              </p>
            </div>
          </div>
          <div className="ui-card__body ui-card__body--flush">
            {pendingVobo.map(m => {
              const dateLabel = meetingDate(m.scheduled_at, { weekday: 'long', day: 'numeric', month: 'long' })
              const time = meetingTime(m.scheduled_at)
              return (
                <div key={m.id} className="list-row">
                  <div className="list-row__content">
                    <div className="list-row__title" style={{ textTransform: 'capitalize' }}>
                      1:1 con {leaderMap[m.leader_id] ?? 'líder'}
                    </div>
                    <div className="list-row__meta">
                      <span style={{ textTransform: 'capitalize' }}>{dateLabel} · {time}</span>
                      {m.modality === 'virtual' ? <Video size={12} /> : <MapPin size={12} />}
                    </div>
                  </div>
                  <Link href={`/colaborador/1to1/${m.id}`} className="ui-btn ui-btn--accent ui-btn--sm list-row__action">
                    Confirmar <ArrowRight size={12} />
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="layout-2col" style={{ gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div className="ui-card">
          <div className="ui-card__head">
            <div>
              <h3 className="ui-card__title">
                <Calendar size={15} /> Próximas reuniones
              </h3>
              <p className="ui-card__desc">
                {upcoming.length === 0 ? 'Sin reuniones próximas' : `${upcoming.length} agendada${upcoming.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
          <div className="ui-card__body ui-card__body--flush">
            {upcoming.length === 0 ? (
              <EmptyState
                illustration="meetings"
                title="Sin reuniones próximas"
                description="Tu líder es quien agenda las 1:1s. Cuando programe la siguiente, aparecerá aquí."
              />
            ) : (
              upcoming.map(m => {
                const day = meetingDate(m.scheduled_at, { day: '2-digit' })
                const month = MONTHS[Number(meetingDate(m.scheduled_at, { month: 'numeric' })) - 1]
                const time = meetingTime(m.scheduled_at)
                return (
                  <div key={m.id} className="up-row">
                    <div className="up-row__date">
                      <div className="up-row__date-day">{day}</div>
                      <div className="up-row__date-month">{month}</div>
                      <div className="up-row__date-time">{time}</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14, letterSpacing: '-0.005em' }}>
                        1:1 con {leaderMap[m.leader_id] ?? 'líder'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                        {m.modality === 'virtual' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <Video size={12} /> Virtual
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <MapPin size={12} /> {m.location ?? 'Presencial'}
                          </span>
                        )}
                        <span className="ui-badge ui-badge--blue">{STATUS_LABELS[m.status]}</span>
                      </div>
                    </div>
                    <Link href={`/colaborador/1to1/${m.id}`} className="ui-btn ui-btn--outline ui-btn--sm">
                      Ver <ArrowRight size={12} />
                    </Link>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__head">
            <div>
              <h3 className="ui-card__title">
                <CheckSquare size={15} /> Acuerdos pendientes
              </h3>
              <p className="ui-card__desc">Compromisos que tienes abiertos</p>
            </div>
            <Link href="/colaborador/acuerdos" className="ui-btn ui-btn--ghost ui-btn--sm">
              Ver todos <ArrowRight size={11} />
            </Link>
          </div>
          <div className="ui-card__body ui-card__body--flush">
            {pendingAgreements.length === 0 ? (
              <EmptyState
                illustration="success"
                title="¡Estás al día!"
                description="No tienes acuerdos pendientes. Sigue así."
              />
            ) : (
              <div className="anim-stagger" style={{ padding: '8px 16px 16px' }}>
                {pendingAgreements.map(a => {
                  const overdue = isOverdue(a.due_date)
                  return (
                    <div
                      key={a.id}
                      className="agreement"
                      style={{ marginTop: 8 }}
                    >
                      <div className="agreement__desc">{a.description}</div>
                      <div className="agreement__meta">
                        <span className={`ui-badge ${overdue ? 'ui-badge--red' : 'ui-badge--amber'}`}>
                          {overdue ? 'Vencido' : AGREEMENT_LABELS[a.status]}
                        </span>
                        {a.due_date && (
                          <span
                            className="agreement__meta-item"
                            style={{ color: overdue ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))' }}
                          >
                            <Calendar size={11} /> Vence {formatDueDate(a.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
