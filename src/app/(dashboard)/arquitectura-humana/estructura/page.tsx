import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Network } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { InitialsAvatar } from '@/components/shared/initials-avatar'

interface User { id: string; full_name: string; email: string; department_id?: string | null }
interface Relation {
  leader_id: string; collaborator_id: string
  leader: User | User[] | null
  collaborator: User | User[] | null
}

function pickLeader(r: Relation): User | null {
  return Array.isArray(r.leader) ? (r.leader[0] ?? null) : r.leader
}
function pickCollab(r: Relation): User | null {
  return Array.isArray(r.collaborator) ? (r.collaborator[0] ?? null) : r.collaborator
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

  // Build: department -> leader -> [collaborators] (líder UNA vez por área)
  type LeaderGroup = { leader: User; collaborators: User[] }
  const byDept: Record<string, Record<string, LeaderGroup>> = {}

  relations.forEach(r => {
    const leader = pickLeader(r)
    const collab = pickCollab(r)
    if (!leader || !collab) return
    const deptId = leader.department_id ?? 'sin'
    if (!byDept[deptId]) byDept[deptId] = {}
    if (!byDept[deptId]![leader.id]) byDept[deptId]![leader.id] = { leader, collaborators: [] }
    byDept[deptId]![leader.id]!.collaborators.push(collab)
  })

  const getDept = (id: string) => departments.find(d => d.id === id)?.name ?? 'Sin área'
  const orderedDepts = Object.keys(byDept).sort((a, b) => getDept(a).localeCompare(getDept(b)))
  const totalLeaders = Object.values(byDept).reduce((acc, lg) => acc + Object.keys(lg).length, 0)
  const totalRelations = relations.length

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 anim-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-medium tracking-tight">Estructura organizacional</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          {totalRelations === 0
            ? 'Aún no hay relaciones líder ↔ colaborador activas en el sistema.'
            : `${totalLeaders} ${totalLeaders === 1 ? 'líder' : 'líderes'} · ${totalRelations} ${totalRelations === 1 ? 'relación' : 'relaciones'} activas en ${orderedDepts.length} ${orderedDepts.length === 1 ? 'área' : 'áreas'}.`}
        </p>
      </div>

      {totalRelations === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Network}
              title="Sin relaciones configuradas"
              description="Aún no hay relaciones líder ↔ colaborador en el sistema."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orderedDepts.map(deptId => {
            const leaderGroups = Object.values(byDept[deptId]!)
              .sort((a, b) => a.leader.full_name.localeCompare(b.leader.full_name))
            const deptRelations = leaderGroups.reduce((acc, g) => acc + g.collaborators.length, 0)
            return (
              <Card key={deptId}>
                <CardHeader>
                  <CardTitle>{getDept(deptId)}</CardTitle>
                  <CardDescription>
                    {leaderGroups.length} {leaderGroups.length === 1 ? 'líder' : 'líderes'} · {deptRelations} {deptRelations === 1 ? 'relación' : 'relaciones'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {leaderGroups.map(group => (
                    <div key={group.leader.id}>
                      <div className="flex items-center gap-3 px-2 py-1.5">
                        <InitialsAvatar name={group.leader.full_name} size="md" className="bg-foreground text-background border-foreground" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium tracking-tight truncate">{group.leader.full_name}</div>
                          <div className="text-[11.5px] text-muted-foreground">
                            Líder · {group.collaborators.length} reporte{group.collaborators.length === 1 ? '' : 's'} directo{group.collaborators.length === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 border-l border-border/80">
                        {group.collaborators
                          .slice()
                          .sort((a, b) => a.full_name.localeCompare(b.full_name))
                          .map(c => (
                            <div key={c.id} className="relative flex items-center gap-3 px-4 py-1.5 ml-3">
                              <span className="absolute left-[-1px] top-1/2 w-3 h-px bg-border/80" aria-hidden="true" />
                              <InitialsAvatar name={c.full_name} size="sm" />
                              <div className="min-w-0">
                                <div className="text-[13px] font-medium truncate">{c.full_name}</div>
                                <div className="text-[11px] text-muted-foreground truncate">{c.email}</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
