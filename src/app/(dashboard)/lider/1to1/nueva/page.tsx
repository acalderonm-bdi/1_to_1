import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MeetingForm } from '@/components/one-on-one/meeting-form'
import { CalendarPlus } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

export default async function NuevaOneOnOnePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('leadership_relations')
    .select('collaborator_id, users!leadership_relations_collaborator_id_fkey(id, full_name, email)')
    .eq('leader_id', user.id).is('ended_at', null)

  const counterparts = ((data ?? []) as Array<{
    collaborator_id: string
    users: { id: string; full_name: string; email: string } | Array<{ id: string; full_name: string; email: string }> | null
  }>).map(r => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users
    return { id: u?.id ?? '', full_name: u?.full_name ?? '', email: u?.email ?? '' }
  }).filter(u => u.id)

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
          <EmptyState
            illustration="meetings"
            title="Sin colaboradores asignados"
            description="Pide a Arquitectura Humana que configure tu equipo antes de poder agendar una 1:1."
            action={
              <a href="mailto:arquitectura.humana@b-drive.com.mx" className="ui-btn ui-btn--outline">
                <span>Solicitar configuración</span>
              </a>
            }
          />
        </div>
      ) : (
        <MeetingForm
          counterparts={counterparts}
          currentRole="leader"
          currentUserId={user.id}
        />
      )}
    </div>
  )
}
