import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Users, Calendar } from 'lucide-react'
import { AGREEMENT_LABELS } from '@/lib/constants'

const STATUS_TONE: Record<string, string> = {
  pendiente: 'amber', cumplido: 'green', parcial: 'blue', no_cumplido: 'red',
}

export default async function EquipoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawRelations } = await supabase
    .from('leadership_relations')
    .select('collaborator_id, users!leadership_relations_collaborator_id_fkey(id, full_name, email)')
    .eq('leader_id', user.id)
    .is('ended_at', null)

  const relations = (rawRelations ?? []) as Array<{
    collaborator_id: string
    users: { id: string; full_name: string; email: string } | Array<{ id: string; full_name: string; email: string }> | null
  }>
  const collabIds = relations.map(r => r.collaborator_id)

  const agreementsMap: Record<string, Array<{ description: string; status: string; due_date: string | null }>> = {}
  if (collabIds.length > 0) {
    const { data } = await supabase
      .from('agreements')
      .select('responsible_id, description, status, due_date')
      .in('responsible_id', collabIds)
      .eq('status', 'pendiente')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(50)
    ;(data ?? []).forEach(a => {
      const row = a as { responsible_id: string; description: string; status: string; due_date: string | null }
      if (!agreementsMap[row.responsible_id]) agreementsMap[row.responsible_id] = []
      agreementsMap[row.responsible_id]!.push({ description: row.description, status: row.status, due_date: row.due_date })
    })
  }

  const AV_COLORS = ['av-blue', 'av-violet', 'av-pink', 'av-green', 'av-amber', 'av-orange', 'av-teal', 'av-rose']

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Users size={12} /> Tu equipo</span>
          <h1 className="page__title">Mi equipo</h1>
          <p className="page__subtitle">Acuerdos pendientes por persona y estado de cada conversación.</p>
        </div>
      </div>

      {relations.length === 0 ? (
        <div className="ui-card">
          <div className="empty">
            <div className="empty__icon"><Users /></div>
            <h3 className="empty__title">Sin colaboradores asignados</h3>
            <p className="empty__desc">Contacta a Arquitectura Humana para configurar tu equipo.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }} className="anim-stagger">
          {relations.map((rel, idx) => {
            const collab = Array.isArray(rel.users) ? rel.users[0] : rel.users
            if (!collab) return null
            const pending = agreementsMap[rel.collaborator_id] ?? []
            const initials = collab.full_name.split(' ').map(p => p[0]).slice(0, 2).join('')
            return (
              <div key={rel.collaborator_id} className="ui-card">
                <div className="ui-card__head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className={`avatar avatar--lg ${AV_COLORS[idx % AV_COLORS.length]}`}>{initials}</div>
                    <div>
                      <h3 className="ui-card__title">{collab.full_name}</h3>
                      <p className="ui-card__desc">{collab.email}</p>
                    </div>
                  </div>
                  <span className={`ui-badge ui-badge--${pending.length > 0 ? 'amber' : 'green'}`}>
                    {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {pending.length > 0 && (
                  <div className="ui-card__body" style={{ display: 'grid', gap: 10 }}>
                    {pending.map((a, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 13,
                          padding: '10px 12px',
                          borderRadius: 'var(--r-md)',
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--border-c)',
                        }}
                      >
                        <span style={{ color: 'var(--text-c)', flex: 1, lineHeight: 1.5 }}>{a.description}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {a.due_date && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Calendar size={11} /> {a.due_date}
                            </span>
                          )}
                          <span className={`ui-badge ui-badge--${STATUS_TONE[a.status] ?? 'slate'}`}>
                            {AGREEMENT_LABELS[a.status]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
