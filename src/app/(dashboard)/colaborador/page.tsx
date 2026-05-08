import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Calendar, CheckSquare, Plus, ArrowRight, Video, MapPin, Sparkles, CalendarPlus } from 'lucide-react'
import { STATUS_LABELS, AGREEMENT_LABELS } from '@/lib/constants'

export default async function ColaboradorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase.from('users').select('full_name').eq('id', user.id).single()
  const profile = rawProfile as { full_name: string } | null

  const { data: rawUpcoming } = await supabase
    .from('one_on_ones')
    .select('id, scheduled_at, modality, location, meet_link, status, leader_id')
    .or(`leader_id.eq.${user.id},collaborator_id.eq.${user.id}`)
    .eq('status', 'agendada')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5)

  const upcoming = (rawUpcoming ?? []) as Array<{
    id: string; scheduled_at: string; modality: string; location: string | null;
    meet_link: string | null; status: string; leader_id: string
  }>

  const leaderIds = Array.from(new Set(upcoming.map(m => m.leader_id)))
  let leaderMap: Record<string, string> = {}
  if (leaderIds.length > 0) {
    const { data: leaders } = await supabase.from('users').select('id, full_name').in('id', leaderIds)
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
        <div className="page__actions">
          <Link href="/colaborador/1to1/nueva" className="ui-btn ui-btn--primary">
            <Plus size={14} /> Agendar 1:1
          </Link>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
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
              <div className="empty">
                <div className="empty__icon"><CalendarPlus /></div>
                <h3 className="empty__title">Sin reuniones próximas</h3>
                <p className="empty__desc">Agenda tu próxima 1:1 con tu líder para mantener el ritmo de tus conversaciones.</p>
                <div className="empty__action">
                  <Link href="/colaborador/1to1/nueva" className="ui-btn ui-btn--accent ui-btn--sm">
                    <Plus size={13} /> Agendar 1:1
                  </Link>
                </div>
              </div>
            ) : (
              upcoming.map(m => {
                const d = new Date(m.scheduled_at)
                const day = d.getDate().toString().padStart(2, '0')
                const month = MONTHS[d.getMonth()]
                const time = d.toTimeString().slice(0, 5)
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
              <div className="empty">
                <div className="empty__icon" style={{ background: 'var(--green-50)', color: 'var(--green-700)' }}>
                  <CheckSquare />
                </div>
                <h3 className="empty__title">¡Estás al día!</h3>
                <p className="empty__desc">No tienes acuerdos pendientes. Sigue así.</p>
              </div>
            ) : (
              pendingAgreements.map(a => {
                const overdue = isOverdue(a.due_date)
                return (
                  <div
                    key={a.id}
                    style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-c)' }}
                  >
                    <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{a.description}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <span className={`ui-badge ${overdue ? 'ui-badge--red' : 'ui-badge--amber'}`}>
                        {overdue ? 'Vencido' : AGREEMENT_LABELS[a.status]}
                      </span>
                      {a.due_date && (
                        <span style={{ fontSize: 11.5, color: overdue ? 'var(--red-700)' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={11} /> Vence {formatDueDate(a.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
