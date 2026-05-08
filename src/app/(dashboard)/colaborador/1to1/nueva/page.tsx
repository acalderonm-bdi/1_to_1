import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MeetingForm } from '@/components/one-on-one/meeting-form'
import { Users, CalendarPlus } from 'lucide-react'

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
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><CalendarPlus size={12} /> Nueva 1:1</span>
          <h1 className="page__title">Agenda una reunión uno a uno</h1>
          <p className="page__subtitle">
            Crea la próxima reunión con la persona indicada y define los detalles importantes.
          </p>
        </div>
      </div>

      {counterparts.length === 0 ? (
        <div className="ui-card" style={{ maxWidth: 560 }}>
          <div className="empty">
            <div className="empty__icon"><Users /></div>
            <h3 className="empty__title">Sin relaciones configuradas</h3>
            <p className="empty__desc">
              Pide a Arquitectura Humana que configure tu relación con tu líder o
              colaboradores antes de poder agendar una 1:1.
            </p>
          </div>
        </div>
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
