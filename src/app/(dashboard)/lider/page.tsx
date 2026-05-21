import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Users, Calendar, TrendingUp, Plus, ArrowRight, UserPlus, AlertCircle, Video, MapPin, CheckSquare, Clock } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/constants'
import { EmptyState } from '@/components/shared/empty-state'

const STATUS_TONE: Record<string, string> = {
  agendada: 'blue', realizada: 'green', no_realizada: 'red', en_disputa: 'orange',
}

export default async function LiderPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase.from('users').select('full_name').eq('id', user.id).single()
  const profile = rawProfile as { full_name: string } | null

  const { data: rawRelations } = await supabase
    .from('leadership_relations')
    .select('collaborator_id, users!leadership_relations_collaborator_id_fkey(id, full_name, email)')
    .eq('leader_id', user.id)
    .is('ended_at', null)

  const relations = (rawRelations ?? []) as Array<{
    collaborator_id: string
    users: { id: string; full_name: string; email: string } | Array<{ id: string; full_name: string; email: string }> | null
  }>

  const collaboratorIds = relations.map(r => r.collaborator_id)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: rawMeetings } = await supabase
    .from('one_on_ones')
    .select('id, status, collaborator_id, scheduled_at')
    .eq('leader_id', user.id)
    .gte('scheduled_at', startOfMonth.toISOString())
  const monthMeetings = (rawMeetings ?? []) as Array<{ id: string; status: string; collaborator_id: string; scheduled_at: string }>

  const realized = monthMeetings.filter(m => m.status === 'realizada').length
  const total = monthMeetings.length
  const compliance = total > 0 ? Math.round((realized / total) * 100) : 0

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const upcomingMap: Record<string, { id: string; scheduled_at: string }> = {}
  if (collaboratorIds.length > 0) {
    const { data: rawUpcoming } = await supabase
      .from('one_on_ones')
      .select('id, collaborator_id, scheduled_at')
      .eq('leader_id', user.id)
      .eq('status', 'agendada')
      .gte('scheduled_at', startOfToday.toISOString())
      .order('scheduled_at', { ascending: true })
    const upcoming = (rawUpcoming ?? []) as Array<{ id: string; collaborator_id: string; scheduled_at: string }>
    upcoming.forEach(m => {
      if (!upcomingMap[m.collaborator_id]) upcomingMap[m.collaborator_id] = { id: m.id, scheduled_at: m.scheduled_at }
    })
  }

  // 1:1s pasadas sin VoBo del líder → "esperan tu confirmación"
  const { data: rawPending } = await supabase
    .from('one_on_ones')
    .select('id, scheduled_at, modality, collaborator_id, status, vobos!left(user_id)')
    .eq('leader_id', user.id)
    .eq('status', 'agendada')
    .lt('scheduled_at', startOfToday.toISOString())
    .order('scheduled_at', { ascending: false })
    .limit(10)
  const pendingVobo = ((rawPending ?? []) as Array<{
    id: string; scheduled_at: string; modality: string; collaborator_id: string; status: string
    vobos: Array<{ user_id: string }>
  }>).filter(m => !m.vobos.some(v => v.user_id === user.id))

  const collabNameMap: Record<string, string> = {}
  relations.forEach(r => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users
    if (u) collabNameMap[r.collaborator_id] = u.full_name
  })

  // Últimas 5 1:1s del líder (cualquier status) — para tener un punto de entrada
  // a las recientes incluso después de cerrar VoBo.
  const { data: rawRecent } = await supabase
    .from('one_on_ones')
    .select('id, scheduled_at, modality, status, collaborator_id, minutes(id), agreements(id)')
    .eq('leader_id', user.id)
    .order('scheduled_at', { ascending: false })
    .limit(5)
  const recentMeetings = ((rawRecent ?? []) as Array<{
    id: string; scheduled_at: string; modality: string; status: string; collaborator_id: string
    minutes: Array<{ id: string }>
    agreements: Array<{ id: string }>
  }>).map(m => ({
    id: m.id, scheduled_at: m.scheduled_at, modality: m.modality, status: m.status,
    collaborator_id: m.collaborator_id,
    hasMinute: m.minutes.length > 0,
    agreementCount: m.agreements.length,
  }))

  const firstName = profile?.full_name.split(' ')[0] ?? 'Líder'
  const AV_COLORS = ['av-blue', 'av-violet', 'av-pink', 'av-green', 'av-amber', 'av-orange', 'av-teal', 'av-rose']

  const complianceTone =
    compliance >= 80 ? 'green' :
    compliance >= 60 ? 'amber' :
    compliance >= 40 ? 'orange' : 'red'

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Users size={12} /> Equipo a tu cargo</span>
          <h1 className="page__title">Hola, {firstName}</h1>
          <p className="page__subtitle">
            Resumen de tu equipo y cumplimiento de cadencia este mes.
          </p>
        </div>
        <div className="page__actions">
          <Link href="/lider/1to1/nueva" className="ui-btn ui-btn--accent">
            <Plus size={14} /> <span>Agendar 1:1</span>
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }} className="anim-stagger">
        <div className="kpi">
          <div className="kpi__icon kpi__icon--blue"><Users /></div>
          <div className="kpi__label">Colaboradores</div>
          <div className="kpi__value u-tabular">{collaboratorIds.length}</div>
          <div className="kpi__delta">a tu cargo</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--violet"><Calendar /></div>
          <div className="kpi__label">1:1s este mes</div>
          <div className="kpi__value u-tabular">{total}</div>
          <div className="kpi__delta">{realized} realizadas</div>
        </div>
        <div className="kpi">
          <div className={`kpi__icon kpi__icon--${complianceTone}`}><TrendingUp /></div>
          <div className="kpi__label">Cumplimiento</div>
          <div className="kpi__value u-tabular">{compliance}%</div>
          <div style={{ marginTop: 8 }}>
            <div className="progress-bar">
              <div
                className={`progress-bar__fill progress-bar__fill--${complianceTone === 'orange' ? 'amber' : complianceTone}`}
                style={{ width: `${compliance}%` }}
              />
            </div>
          </div>
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
              const d = new Date(m.scheduled_at)
              const dateLabel = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
              const time = d.toTimeString().slice(0, 5)
              const collabName = collabNameMap[m.collaborator_id] ?? 'colaborador'
              return (
                <div key={m.id} className="list-row">
                  <div className="list-row__content">
                    <div className="list-row__title" style={{ textTransform: 'capitalize' }}>
                      1:1 con {collabName}
                    </div>
                    <div className="list-row__meta">
                      <span style={{ textTransform: 'capitalize' }}>{dateLabel} · {time}</span>
                      {m.modality === 'virtual' ? <Video size={12} /> : <MapPin size={12} />}
                    </div>
                  </div>
                  <Link href={`/lider/1to1/${m.id}`} className="ui-btn ui-btn--accent ui-btn--sm list-row__action">
                    Confirmar <ArrowRight size={12} />
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">
              <Users size={15} /> Mi equipo
            </h3>
            <p className="ui-card__desc">Próximas 1:1s con cada colaborador</p>
          </div>
          <Link href="/lider/equipo" className="ui-btn ui-btn--ghost ui-btn--sm">
            Ver todos <ArrowRight size={11} />
          </Link>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          {relations.length === 0 ? (
            <EmptyState
              illustration="meetings"
              title="Sin colaboradores asignados"
              description="Contacta a Arquitectura Humana para que configure tu relación con tu equipo."
              action={
                <a
                  href="mailto:arquitectura.humana@b-drive.com.mx"
                  className="ui-btn ui-btn--outline"
                >
                  <UserPlus size={14} /> <span>Solicitar asignación</span>
                </a>
              }
            />
          ) : (
            relations.map((rel, idx) => {
              const collab = Array.isArray(rel.users) ? rel.users[0] : rel.users
              if (!collab) return null
              const next = upcomingMap[rel.collaborator_id]
              const initials = collab.full_name.split(' ').map(p => p[0]).slice(0, 2).join('')
              return (
                <div
                  key={rel.collaborator_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 24px',
                    borderBottom: '1px solid var(--border-c)',
                  }}
                >
                  <div className={`avatar avatar--md ${AV_COLORS[idx % AV_COLORS.length]}`}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14, letterSpacing: '-0.005em' }}>
                      {collab.full_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {collab.email}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {next ? (
                      <>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                          Próxima
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-serif)', letterSpacing: '-0.008em' }}>
                          {new Date(next.scheduled_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                        </div>
                      </>
                    ) : (
                      <span className="ui-badge ui-badge--slate">Sin agendar</span>
                    )}
                  </div>
                  <Link
                    href={next ? `/lider/1to1/${next.id}` : '/lider/1to1/nueva'}
                    className="ui-btn ui-btn--outline ui-btn--sm"
                  >
                    {next ? 'Ver' : 'Agendar'} <ArrowRight size={12} />
                  </Link>
                </div>
              )
            })
          )}
        </div>
      </div>

      {recentMeetings.length > 0 && (
        <div className="ui-card" style={{ marginTop: 18 }}>
          <div className="ui-card__head">
            <div>
              <h3 className="ui-card__title">
                <Clock size={15} /> 1:1s recientes
              </h3>
              <p className="ui-card__desc">Tus últimas reuniones con estado, minuta y acuerdos extraídos.</p>
            </div>
          </div>
          <div className="ui-card__body ui-card__body--flush">
            {recentMeetings.map(m => {
              const d = new Date(m.scheduled_at)
              const dateLabel = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
              const time = d.toTimeString().slice(0, 5)
              const collabName = collabNameMap[m.collaborator_id] ?? 'colaborador'
              return (
                <div key={m.id} className="list-row">
                  <div className="list-row__content">
                    <div className="list-row__title">
                      <span className={`ui-badge ui-badge--${STATUS_TONE[m.status] ?? 'slate'}`}>
                        {STATUS_LABELS[m.status] ?? m.status}
                      </span>
                      <span>1:1 con {collabName}</span>
                    </div>
                    <div className="list-row__meta">
                      <span style={{ textTransform: 'capitalize' }}>{dateLabel} · {time}</span>
                      {m.modality === 'virtual' ? <Video size={12} /> : <MapPin size={12} />}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckSquare size={11} />
                        {m.agreementCount} acuerdo{m.agreementCount === 1 ? '' : 's'}
                      </span>
                      {!m.hasMinute && new Date(m.scheduled_at) < new Date() && m.agreementCount === 0 && (
                        <span className="ui-badge ui-badge--amber" style={{ fontSize: 10.5 }}>
                          Sin notas
                        </span>
                      )}
                    </div>
                  </div>
                  <Link href={`/lider/1to1/${m.id}`} className="ui-btn ui-btn--outline ui-btn--sm list-row__action">
                    Abrir <ArrowRight size={12} />
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
