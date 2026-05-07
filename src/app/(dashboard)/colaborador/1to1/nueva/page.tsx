import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MeetingForm } from '@/components/one-on-one/meeting-form'
import { Users } from 'lucide-react'

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
          <h1 className="page__title">Nueva 1:1</h1>
          <p className="page__subtitle">Agenda una reunión uno a uno</p>
        </div>
      </div>

      {counterparts.length === 0 ? (
        <div className="ui-card" style={{ padding: 60, textAlign: 'center', maxWidth: 560 }}>
          <Users size={32} style={{ margin: '0 auto', color: 'var(--text-subtle)' }} />
          <h3 style={{ marginTop: 14, fontSize: 15, fontWeight: 600 }}>Sin relaciones configuradas</h3>
          <p style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 13 }}>
            Pide a Arquitectura Humana que configure tu relación con tu líder o colaboradores.
          </p>
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
