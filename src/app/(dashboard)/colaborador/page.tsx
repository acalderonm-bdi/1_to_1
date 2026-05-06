import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Calendar, CheckSquare, Plus } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/dates'
import { STATUS_LABELS, AGREEMENT_LABELS } from '@/lib/constants'
import type { OneOnOne, Agreement } from '@/types/domain'

export default async function ColaboradorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const { data: upcoming } = await supabase
    .from('one_on_ones')
    .select('*')
    .or(`leader_id.eq.${user.id},collaborator_id.eq.${user.id}`)
    .eq('status', 'agendada')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(3)

  const { data: pendingAgreements } = await supabase
    .from('agreements')
    .select('*')
    .eq('responsible_id', user.id)
    .eq('status', 'pendiente')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(5)

  const firstName = profile?.full_name.split(' ')[0] ?? 'equipo'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hola, {firstName}</h1>
          <p className="text-slate-500 mt-1">Aquí tienes un resumen de tus 1:1s</p>
        </div>
        <Button asChild>
          <Link href="/colaborador/1to1/nueva">
            <Plus className="h-4 w-4 mr-2" />
            Agendar 1:1
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Próximas 1:1s
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!upcoming?.length ? (
              <EmptyState
                title="Sin reuniones próximas"
                description="Agenda tu próxima 1:1 con tu líder"
                className="py-8"
              />
            ) : (
              <div className="space-y-3">
                {(upcoming as OneOnOne[]).map(meeting => (
                  <div key={meeting.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{formatDateTime(meeting.scheduled_at)}</p>
                      <p className="text-xs text-slate-500 capitalize">{meeting.modality}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline">{STATUS_LABELS[meeting.status]}</Badge>
                      <Button asChild size="sm" variant="outline" className="text-xs mt-1">
                        <Link href={`/colaborador/1to1/${meeting.id}`}>Ver detalle</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="h-4 w-4" />
              Acuerdos pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!pendingAgreements?.length ? (
              <EmptyState
                title="Sin acuerdos pendientes"
                description="¡Al día con todos tus compromisos!"
                className="py-8"
              />
            ) : (
              <div className="space-y-3">
                {(pendingAgreements as Agreement[]).map(agr => (
                  <div key={agr.id} className="p-3 rounded-lg border space-y-1">
                    <p className="text-sm">{agr.description}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {AGREEMENT_LABELS[agr.status]}
                      </Badge>
                      {agr.due_date && (
                        <span className="text-xs text-slate-500">Vence: {agr.due_date}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
