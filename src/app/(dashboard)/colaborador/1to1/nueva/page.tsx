import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MeetingForm } from '@/components/one-on-one/meeting-form'
import { EmptyState } from '@/components/shared/empty-state'
import { Users } from 'lucide-react'

export default async function NuevaOneonOnePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as { role: string } | null

  // Líderes si es colaborador, colaboradores si es líder
  let counterparts: Array<{ id: string; full_name: string; email: string }> = []

  if (profile?.role === 'leader') {
    const { data } = await supabase
      .from('leadership_relations')
      .select(
        'collaborator_id, users!leadership_relations_collaborator_id_fkey(id, full_name, email)',
      )
      .eq('leader_id', user.id)
      .is('ended_at', null)
    counterparts = (data ?? [])
      .map((r) => {
        const u = Array.isArray(r.users) ? r.users[0] : r.users
        return {
          id: (u as { id: string } | null)?.id ?? '',
          full_name: (u as { full_name: string } | null)?.full_name ?? '',
          email: (u as { email: string } | null)?.email ?? '',
        }
      })
      .filter((u) => u.id)
  } else {
    const { data } = await supabase
      .from('leadership_relations')
      .select(
        'leader_id, users!leadership_relations_leader_id_fkey(id, full_name, email)',
      )
      .eq('collaborator_id', user.id)
      .is('ended_at', null)
    counterparts = (data ?? [])
      .map((r) => {
        const u = Array.isArray(r.users) ? r.users[0] : r.users
        return {
          id: (u as { id: string } | null)?.id ?? '',
          full_name: (u as { full_name: string } | null)?.full_name ?? '',
          email: (u as { email: string } | null)?.email ?? '',
        }
      })
      .filter((u) => u.id)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nueva 1:1</h1>
        <p className="text-slate-500 mt-1">Agenda una reunión uno a uno</p>
      </div>

      {counterparts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin relaciones configuradas"
          description="Pide a Arquitectura Humana que configure tu relación con tu líder o colaboradores"
          className="py-16"
        />
      ) : (
        <MeetingForm
          counterparts={counterparts}
          currentRole={profile?.role === 'leader' ? 'leader' : 'collaborator'}
          currentUserId={user.id}
        />
      )}
    </div>
  )
}
