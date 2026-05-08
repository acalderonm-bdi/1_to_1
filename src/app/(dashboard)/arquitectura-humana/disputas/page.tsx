import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AlertTriangle, Calendar, Check, X } from 'lucide-react'

interface Participant { full_name: string; email: string }
interface DisputeRow {
  id: string; scheduled_at: string; modality: string
  leader: Participant | Participant[] | null
  collaborator: Participant | Participant[] | null
  vobos: Array<{ user_id: string; confirmed: boolean }> | null
}

export default async function DisputasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: raw } = await supabase
    .from('one_on_ones')
    .select(`
      id, scheduled_at, modality,
      leader:users!one_on_ones_leader_id_fkey(full_name, email),
      collaborator:users!one_on_ones_collaborator_id_fkey(full_name, email),
      vobos(user_id, confirmed)
    `)
    .eq('status', 'en_disputa')
    .order('scheduled_at', { ascending: false })

  const disputes = (raw ?? []) as DisputeRow[]

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><AlertTriangle size={12} /> Requieren revisión</span>
          <h1 className="page__title">Disputas</h1>
          <p className="page__subtitle">
            1:1s con VoBos contradictorios donde líder y colaborador no concuerdan sobre si la reunión se realizó.
          </p>
        </div>
      </div>

      {disputes.length === 0 ? (
        <div className="ui-card">
          <div className="empty">
            <div className="empty__icon" style={{ background: 'var(--green-50)', color: 'var(--green-700)' }}>
              <Check />
            </div>
            <h3 className="empty__title">Sin disputas activas</h3>
            <p className="empty__desc">Todas las 1:1s tienen VoBos consistentes entre líder y colaborador.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }} className="anim-stagger">
          {disputes.map(d => {
            const leader = Array.isArray(d.leader) ? d.leader[0] : d.leader
            const collab = Array.isArray(d.collaborator) ? d.collaborator[0] : d.collaborator
            const vobos = d.vobos ?? []
            return (
              <div
                key={d.id}
                className="ui-card"
                style={{
                  borderColor: 'var(--orange-200)',
                  background: 'linear-gradient(180deg, var(--orange-50), var(--bg-card))',
                }}
              >
                <div className="ui-card__head" style={{ borderBottom: '1px solid var(--orange-200)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span className="ui-badge ui-badge--orange">En disputa</span>
                    </div>
                    <h3 className="font-serif" style={{ fontSize: 19, letterSpacing: '-0.014em', fontWeight: 500, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                      {new Date(d.scheduled_at).toLocaleDateString('es-MX', {
                        weekday: 'long', day: 'numeric', month: 'long',
                      })}
                    </h3>
                  </div>
                </div>
                <div className="ui-card__body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 18 }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.10em', fontWeight: 600, marginBottom: 4 }}>
                        Líder
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{leader?.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{leader?.email}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.10em', fontWeight: 600, marginBottom: 4 }}>
                        Colaborador
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{collab?.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{collab?.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {vobos.map(v => (
                      <span
                        key={v.user_id}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                          background: v.confirmed ? 'var(--green-50)' : 'var(--red-50)',
                          color: v.confirmed ? 'var(--green-700)' : 'var(--red-700)',
                          border: `1px solid ${v.confirmed ? 'var(--green-200)' : 'var(--red-200)'}`,
                        }}
                      >
                        {v.confirmed ? <Check size={13}/> : <X size={13}/>}
                        {v.confirmed ? 'Confirmó realizada' : 'Indicó no realizada'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
