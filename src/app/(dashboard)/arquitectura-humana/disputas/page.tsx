import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { AlertTriangle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/dates'

interface Participant {
  full_name: string
  email: string
}

interface DisputeRow {
  id: string
  scheduled_at: string
  modality: string
  leader: Participant | Participant[] | null
  collaborator: Participant | Participant[] | null
  vobos: Array<{ user_id: string; confirmed: boolean }> | null
}

export default async function DisputasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawDisputes } = await supabase
    .from('one_on_ones')
    .select(`
      id, scheduled_at, modality,
      leader:users!one_on_ones_leader_id_fkey(full_name, email),
      collaborator:users!one_on_ones_collaborator_id_fkey(full_name, email),
      vobos(user_id, confirmed)
    `)
    .eq('status', 'en_disputa')
    .order('scheduled_at', { ascending: false })

  const disputes = rawDisputes as DisputeRow[] | null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Disputas</h1>
        <p className="text-slate-500 mt-1">1:1s con VoBos contradictorios — requieren revisión</p>
      </div>

      {!disputes?.length ? (
        <EmptyState
          icon={AlertTriangle}
          title="Sin disputas activas"
          description="Todas las 1:1s tienen VoBos consistentes"
          className="py-16"
        />
      ) : (
        <div className="space-y-4">
          {disputes.map(dispute => {
            const leader = Array.isArray(dispute.leader) ? dispute.leader[0] : dispute.leader
            const collaborator = Array.isArray(dispute.collaborator) ? dispute.collaborator[0] : dispute.collaborator
            const vobos = dispute.vobos ?? []
            return (
              <Card key={dispute.id} className="border-orange-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{formatDateTime(dispute.scheduled_at)}</CardTitle>
                    <Badge className="bg-orange-100 text-orange-800">En disputa</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Líder</p>
                      <p className="font-medium">{leader?.full_name}</p>
                      <p className="text-xs text-slate-500">{leader?.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Colaborador</p>
                      <p className="font-medium">{collaborator?.full_name}</p>
                      <p className="text-xs text-slate-500">{collaborator?.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs">
                    {vobos.map(v => (
                      <span
                        key={v.user_id}
                        className={`px-2 py-1 rounded-full ${v.confirmed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                      >
                        {v.confirmed ? '✓ Confirmó' : '✗ No confirmó'}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
