import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Network } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

interface User { id: string; full_name: string; email: string; department_id?: string | null }
interface Relation {
  leader_id: string; collaborator_id: string
  leader: User | User[] | null
  collaborator: User | User[] | null
}

export default async function EstructuraPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawDepts } = await supabase.from('departments').select('id, name').order('name')
  const departments = (rawDepts ?? []) as Array<{ id: string; name: string }>

  const { data: rawRels } = await supabase
    .from('leadership_relations')
    .select(`
      leader_id, collaborator_id,
      leader:users!leadership_relations_leader_id_fkey(id, full_name, email, department_id),
      collaborator:users!leadership_relations_collaborator_id_fkey(id, full_name, email)
    `)
    .is('ended_at', null)
  const relations = (rawRels ?? []) as Relation[]

  const byDept: Record<string, Relation[]> = {}
  relations.forEach(r => {
    const leader = Array.isArray(r.leader) ? r.leader[0] : r.leader
    const dept = leader?.department_id ?? 'sin'
    if (!byDept[dept]) byDept[dept] = []
    byDept[dept]!.push(r)
  })
  const getDept = (id: string) => departments.find(d => d.id === id)?.name ?? 'Sin área'
  const AV_COLORS = ['av-blue', 'av-violet', 'av-pink', 'av-green', 'av-amber', 'av-orange', 'av-teal', 'av-rose']

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Network size={12} /> Relaciones</span>
          <h1 className="page__title">Estructura organizacional</h1>
          <p className="page__subtitle">Relaciones líder ↔ colaborador activas, agrupadas por área.</p>
        </div>
      </div>

      {relations.length === 0 ? (
        <div className="ui-card">
          <EmptyState
            illustration="list"
            title="Sin relaciones configuradas"
            description="Aún no hay relaciones líder ↔ colaborador en el sistema. Configúralas desde Usuarios."
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {Object.entries(byDept).map(([deptId, rels]) => (
            <div key={deptId} className="ui-card">
              <div className="ui-card__head">
                <div>
                  <h3 className="ui-card__title">{getDept(deptId)}</h3>
                  <p className="ui-card__desc">{rels.length} relación{rels.length !== 1 ? 'es' : ''} activa{rels.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="ui-card__body">
                {rels.map((rel, idx) => {
                  const leader = Array.isArray(rel.leader) ? rel.leader[0] : rel.leader
                  const collab = Array.isArray(rel.collaborator) ? rel.collaborator[0] : rel.collaborator
                  const lInit = leader?.full_name.split(' ').map(p => p[0]).slice(0, 2).join('') ?? '?'
                  const cInit = collab?.full_name.split(' ').map(p => p[0]).slice(0, 2).join('') ?? '?'
                  return (
                    <div key={`${rel.leader_id}-${rel.collaborator_id}`} style={{ marginBottom: idx < rels.length - 1 ? 16 : 0 }}>
                      <div className="tree-row">
                        <div className={`avatar avatar--sm ${AV_COLORS[(idx * 2) % AV_COLORS.length]}`}>{lInit}</div>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 500 }}>{leader?.full_name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Líder</div>
                        </div>
                      </div>
                      <div className="tree-node">
                        <div className="tree-row">
                          <div className={`avatar avatar--sm ${AV_COLORS[(idx * 2 + 1) % AV_COLORS.length]}`}>{cInit}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{collab?.full_name}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{collab?.email}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
