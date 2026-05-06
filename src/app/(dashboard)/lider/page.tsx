import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { Users, Calendar, TrendingUp, Plus } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/dates'
import { STATUS_LABELS } from '@/lib/constants'

export default async function LiderPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // Colaboradores del líder
  const { data: relations } = await supabase
    .from('leadership_relations')
    .select('collaborator_id, users!leadership_relations_collaborator_id_fkey(id, full_name, email, avatar_url)')
    .eq('leader_id', user.id)
    .is('ended_at', null)

  const collaboratorIds = relations?.map(r => r.collaborator_id) ?? []

  // 1:1s del mes actual
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: monthMeetings } = await supabase
    .from('one_on_ones')
    .select('id, status, collaborator_id, scheduled_at')
    .eq('leader_id', user.id)
    .gte('scheduled_at', startOfMonth.toISOString())

  const realized = monthMeetings?.filter(m => m.status === 'realizada').length ?? 0
  const total = monthMeetings?.length ?? 0
  const compliance = total > 0 ? Math.round((realized / total) * 100) : 0

  // Próxima 1:1 por colaborador
  const upcomingMap: Record<string, { scheduled_at: string; status: string }> = {}
  if (collaboratorIds.length > 0) {
    const { data: upcoming } = await supabase
      .from('one_on_ones')
      .select('collaborator_id, scheduled_at, status')
      .eq('leader_id', user.id)
      .eq('status', 'agendada')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })

    upcoming?.forEach(m => {
      if (!upcomingMap[m.collaborator_id]) {
        upcomingMap[m.collaborator_id] = { scheduled_at: m.scheduled_at, status: m.status }
      }
    })
  }

  const firstName = profile?.full_name.split(' ')[0] ?? 'Líder'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Panel del Líder</h1>
          <p className="text-slate-500 mt-1">Hola, {firstName}</p>
        </div>
        <Button asChild>
          <Link href="/colaborador/1to1/nueva">
            <Plus className="h-4 w-4 mr-2" />
            Agendar 1:1
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-2xl font-bold">{collaboratorIds.length}</p>
                <p className="text-xs text-slate-500">Colaboradores</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-xs text-slate-500">1:1s este mes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-2xl font-bold">{compliance}%</p>
                <p className="text-xs text-slate-500">Cumplimiento</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de colaboradores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mi equipo</CardTitle>
        </CardHeader>
        <CardContent>
          {!relations?.length ? (
            <EmptyState
              title="Sin colaboradores asignados"
              description="Contacta a Arquitectura Humana para configurar tu equipo"
              className="py-12"
            />
          ) : (
            <div className="space-y-3">
              {relations.map(rel => {
                const collab = Array.isArray(rel.users) ? rel.users[0] : rel.users
                const nextMeeting = upcomingMap[rel.collaborator_id]
                return (
                  <div key={rel.collaborator_id} className="flex items-center justify-between p-4 rounded-lg border hover:border-slate-300 transition-colors">
                    <div>
                      <p className="font-medium text-sm">{collab?.full_name ?? 'Sin nombre'}</p>
                      <p className="text-xs text-slate-500">{collab?.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {nextMeeting ? (
                        <>
                          <p className="text-xs text-slate-500">Próxima 1:1</p>
                          <p className="text-xs font-medium">{formatDateTime(nextMeeting.scheduled_at)}</p>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-xs">Sin agendar</Badge>
                      )}
                      <Button asChild size="sm" variant="outline" className="text-xs mt-1">
                        <Link href="/colaborador/1to1/nueva">Agendar</Link>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
