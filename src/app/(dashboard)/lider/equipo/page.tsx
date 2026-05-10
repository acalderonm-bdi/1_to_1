import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Users, Calendar } from 'lucide-react'
import { AGREEMENT_LABELS } from '@/lib/constants'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { InitialsAvatar } from '@/components/shared/initials-avatar'

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'brand' | 'destructive'> = {
  pendiente: 'warning',
  cumplido: 'success',
  parcial: 'brand',
  no_cumplido: 'destructive',
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

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 anim-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-medium tracking-tight">Mi equipo</h1>
        <p className="text-sm text-muted-foreground mt-1.5">Acuerdos pendientes por persona y estado de cada conversación.</p>
      </div>

      {relations.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Users}
              title="Sin colaboradores asignados"
              description="Contacta a Arquitectura Humana para configurar tu equipo."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3.5 anim-stagger">
          {relations.map(rel => {
            const collab = Array.isArray(rel.users) ? rel.users[0] : rel.users
            if (!collab) return null
            const pending = agreementsMap[rel.collaborator_id] ?? []
            return (
              <Card key={rel.collaborator_id}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <InitialsAvatar name={collab.full_name} size="lg" />
                    <div className="min-w-0">
                      <CardTitle>{collab.full_name}</CardTitle>
                      <CardDescription>{collab.email}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={pending.length > 0 ? 'warning' : 'success'}>
                    {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
                  </Badge>
                </CardHeader>
                {pending.length > 0 && (
                  <CardContent className="grid gap-2.5">
                    {pending.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border bg-secondary/30 text-[13px]"
                      >
                        <span className="flex-1 leading-relaxed">{a.description}</span>
                        <div className="flex items-center gap-2.5 text-[11.5px] text-muted-foreground shrink-0">
                          {a.due_date && (
                            <span className="inline-flex items-center gap-1"><Calendar className="size-3" /> {a.due_date}</span>
                          )}
                          <Badge variant={STATUS_VARIANT[a.status] ?? 'muted'}>{AGREEMENT_LABELS[a.status]}</Badge>
                        </div>
                      </div>
                    ))}
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
