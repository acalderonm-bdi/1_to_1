import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Users } from 'lucide-react'
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
          <h1 className="page__title">Mi equipo</h1>
          <p className="page__subtitle">Acuerdos pendientes por persona</p>
        </div>
      </div>

      {relations.length === 0 ? (
        <div className="ui-card" style={{ padding: 60, textAlign: 'center' }}>
          <Users size={32} style={{ margin: '0 auto', color: 'var(--text-subtle)' }} />
          <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 14 }}>Sin colaboradores asignados</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {relations.map((rel, idx) => {
            const collab = Array.isArray(rel.users) ? rel.users[0] : rel.users
            if (!collab) return null
            const pending = agreementsMap[rel.collaborator_id] ?? []
            const initials = collab.full_name.split(' ').map(p => p[0]).slice(0, 2).join('')
            return (
              <div key={rel.collaborator_id} className="ui-card">
                <div className="ui-card__head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className={`avatar avatar--md ${AV_COLORS[idx % AV_COLORS.length]}`}>{initials}</div>
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
                  <div className="ui-card__body" style={{ display: 'grid', gap: 8 }}>
                    {pending.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-c)' }}>{a.description}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {a.due_date && <span>{a.due_date}</span>}
                          <span className={`ui-badge ui-badge--${STATUS_TONE[a.status] ?? 'slate'}`}>{AGREEMENT_LABELS[a.status]}</span>
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
