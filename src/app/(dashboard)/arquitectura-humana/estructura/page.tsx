import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { Building2 } from 'lucide-react'

interface RelUser {
  id: string
  full_name: string
  email: string
  department_id?: string | null
}

interface RelationRow {
  leader_id: string
  collaborator_id: string
  leader: RelUser | RelUser[] | null
  collaborator: RelUser | RelUser[] | null
}

export default async function EstructuraPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawDepts } = await supabase
    .from('departments')
    .select('id, name')
    .order('name')
  const departments = rawDepts as Array<{ id: string; name: string }> | null

  const { data: rawRelations } = await supabase
    .from('leadership_relations')
    .select(`
      leader_id, collaborator_id,
      leader:users!leadership_relations_leader_id_fkey(id, full_name, email, department_id),
      collaborator:users!leadership_relations_collaborator_id_fkey(id, full_name, email)
    `)
    .is('ended_at', null)

  const relations = rawRelations as RelationRow[] | null

  const byDept: Record<string, RelationRow[]> = {}
  relations?.forEach(rel => {
    const leader = Array.isArray(rel.leader) ? rel.leader[0] : rel.leader
    const deptId = leader?.department_id ?? 'sin-dept'
    if (!byDept[deptId]) byDept[deptId] = []
    byDept[deptId]!.push(rel)
  })

  const getDeptName = (deptId: string) =>
    departments?.find(d => d.id === deptId)?.name ?? 'Sin área'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Estructura organizacional</h1>
        <p className="text-slate-500 mt-1">Relaciones líder-colaborador activas</p>
      </div>

      {!relations?.length ? (
        <EmptyState icon={Building2} title="Sin relaciones configuradas" className="py-16" />
      ) : (
        <div className="space-y-4">
          {Object.entries(byDept).map(([deptId, rels]) => (
            <Card key={deptId}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{getDeptName(deptId)}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {rels.map(rel => {
                    const leader = Array.isArray(rel.leader) ? rel.leader[0] : rel.leader
                    const collaborator = Array.isArray(rel.collaborator) ? rel.collaborator[0] : rel.collaborator
                    return (
                      <div key={`${rel.leader_id}-${rel.collaborator_id}`} className="flex items-start gap-4 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-700">
                            {leader?.full_name}{' '}
                            <span className="text-slate-400 font-normal">(Líder)</span>
                          </p>
                          <p className="text-slate-500 pl-4 mt-1">└ {collaborator?.full_name}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
