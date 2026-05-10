import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MeetingForm } from '@/components/one-on-one/meeting-form'
import { Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'

export default async function NuevaOneOnOnePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const profile = rawProfile as { role: string } | null

  let counterparts: Array<{ id: string; full_name: string; email: string }> = []

  if (profile?.role === 'leader') {
    const { data } = await supabase
      .from('leadership_relations')
      .select('collaborator_id, users!leadership_relations_collaborator_id_fkey(id, full_name, email)')
      .eq('leader_id', user.id).is('ended_at', null)
    counterparts = ((data ?? []) as Array<{
      collaborator_id: string
      users: { id: string; full_name: string; email: string } | Array<{ id: string; full_name: string; email: string }> | null
    }>).map(r => {
      const u = Array.isArray(r.users) ? r.users[0] : r.users
      return { id: u?.id ?? '', full_name: u?.full_name ?? '', email: u?.email ?? '' }
    }).filter(u => u.id)
  } else {
    const { data } = await supabase
      .from('leadership_relations')
      .select('leader_id, users!leadership_relations_leader_id_fkey(id, full_name, email)')
      .eq('collaborator_id', user.id).is('ended_at', null)
    counterparts = ((data ?? []) as Array<{
      leader_id: string
      users: { id: string; full_name: string; email: string } | Array<{ id: string; full_name: string; email: string }> | null
    }>).map(r => {
      const u = Array.isArray(r.users) ? r.users[0] : r.users
      return { id: u?.id ?? '', full_name: u?.full_name ?? '', email: u?.email ?? '' }
    }).filter(u => u.id)
  }

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 anim-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-medium tracking-tight">Agenda una reunión uno a uno</h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
          Crea la próxima reunión con la persona indicada y define los detalles importantes.
        </p>
      </div>

      {counterparts.length === 0 ? (
        <Card className="max-w-[560px]">
          <CardContent className="p-0">
            <EmptyState
              icon={Users}
              title="Sin relaciones configuradas"
              description="Pide a Arquitectura Humana que configure tu relación con tu líder o colaboradores antes de poder agendar una 1:1."
            />
          </CardContent>
        </Card>
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
