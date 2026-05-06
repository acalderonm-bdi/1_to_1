import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Users } from 'lucide-react'
import { AGREEMENT_LABELS } from '@/lib/constants'

export default async function EquipoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: relations } = await supabase
    .from('leadership_relations')
    .select('collaborator_id, users!leadership_relations_collaborator_id_fkey(id, full_name, email)')
    .eq('leader_id', user.id)
    .is('ended_at', null)

  const collaboratorIds = relations?.map(r => r.collaborator_id) ?? []

  const agreementsMap: Record<string, Array<{ description: string; status: string; due_date: string | null }>> = {}

  if (collaboratorIds.length > 0) {
    const { data: agreements } = await supabase
      .from('agreements')
      .select('responsible_id, description, status, due_date')
      .in('responsible_id', collaboratorIds)
      .eq('status', 'pendiente')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(50)

    agreements?.forEach(a => {
      if (!agreementsMap[a.responsible_id]) agreementsMap[a.responsible_id] = []
      agreementsMap[a.responsible_id]!.push(a)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mi equipo</h1>
        <p className="text-slate-500 mt-1">Acuerdos pendientes por colaborador</p>
      </div>

      {!relations?.length ? (
        <EmptyState icon={Users} title="Sin colaboradores asignados" className="py-16" />
      ) : (
        <div className="grid gap-4">
          {relations.map(rel => {
            const collab = Array.isArray(rel.users) ? rel.users[0] : rel.users
            const pending = agreementsMap[rel.collaborator_id] ?? []
            return (
              <Card key={rel.collaborator_id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{collab?.full_name}</span>
                    <Badge variant={pending.length > 0 ? 'secondary' : 'outline'}>
                      {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                {pending.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {pending.map((agr, idx) => (
                        <div key={idx} className="flex items-start justify-between text-sm">
                          <span className="text-slate-700">{agr.description}</span>
                          {agr.due_date && (
                            <span className="text-xs text-slate-500 ml-4 shrink-0">{agr.due_date}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
