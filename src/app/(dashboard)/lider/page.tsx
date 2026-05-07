import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Users, Calendar, TrendingUp, Plus, ArrowRight } from 'lucide-react'

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

  const upcomingMap: Record<string, { id: string; scheduled_at: string }> = {}
  if (collaboratorIds.length > 0) {
    const { data: rawUpcoming } = await supabase
      .from('one_on_ones')
      .select('id, collaborator_id, scheduled_at')
      .eq('leader_id', user.id)
      .eq('status', 'agendada')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
    const upcoming = (rawUpcoming ?? []) as Array<{ id: string; collaborator_id: string; scheduled_at: string }>
    upcoming.forEach(m => {
      if (!upcomingMap[m.collaborator_id]) upcomingMap[m.collaborator_id] = { id: m.id, scheduled_at: m.scheduled_at }
    })
  }

  const firstName = profile?.full_name.split(' ')[0] ?? 'Líder'
  const AV_COLORS = ['av-blue', 'av-violet', 'av-pink', 'av-green', 'av-amber', 'av-orange', 'av-teal', 'av-rose']

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Hola, {firstName}</h1>
          <p className="page__subtitle">Resumen de tu equipo y cumplimiento de cadencia.</p>
        </div>
        <div className="page__actions">
          <Link href="/colaborador/1to1/nueva" className="ui-btn ui-btn--primary">
            <Plus size={14} /> Agendar 1:1
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="kpi">
          <div className="kpi__label"><Users size={13} /> Colaboradores</div>
          <div className="kpi__value">{collaboratorIds.length}</div>
          <div className="kpi__delta">a tu cargo</div>
        </div>
        <div className="kpi">
          <div className="kpi__label"><Calendar size={13} /> 1:1s este mes</div>
          <div className="kpi__value">{total}</div>
          <div className="kpi__delta">{realized} realizadas</div>
        </div>
        <div className="kpi">
          <div className="kpi__label"><TrendingUp size={13} /> Cumplimiento</div>
          <div className="kpi__value">{compliance}%</div>
          <div className="kpi__delta kpi__delta--up">de tu cadencia</div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Mi equipo</h3>
            <p className="ui-card__desc">Próximas 1:1s con cada colaborador</p>
          </div>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          {relations.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Sin colaboradores asignados. Contacta a Arquitectura Humana.
            </div>
          ) : (
            relations.map((rel, idx) => {
              const collab = Array.isArray(rel.users) ? rel.users[0] : rel.users
              if (!collab) return null
              const next = upcomingMap[rel.collaborator_id]
              const initials = collab.full_name.split(' ').map(p => p[0]).slice(0, 2).join('')
              return (
                <div key={rel.collaborator_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderBottom: '1px solid var(--border-c)' }}>
                  <div className={`avatar avatar--md ${AV_COLORS[idx % AV_COLORS.length]}`}>{initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{collab.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{collab.email}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {next ? (
                      <>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Próxima 1:1</div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {new Date(next.scheduled_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                        </div>
                      </>
                    ) : (
                      <span className="ui-badge ui-badge--slate">Sin agendar</span>
                    )}
                  </div>
                  <Link
                    href={next ? `/lider/1to1/${next.id}` : '/colaborador/1to1/nueva'}
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
    </div>
  )
}
