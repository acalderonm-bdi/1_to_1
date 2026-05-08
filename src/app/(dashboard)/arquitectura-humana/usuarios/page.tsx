import { redirect } from 'next/navigation'
import { UsersRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS } from '@/lib/constants'

const ROLE_TONE: Record<string, string> = { hr: 'blue', leader: 'violet', collaborator: 'slate' }

export default async function UsuariosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawUsers } = await supabase
    .from('users').select('id, full_name, email, role, departments(name)').order('full_name')

  type Row = {
    id: string; full_name: string; email: string; role: string;
    departments: { name: string } | Array<{ name: string }> | null
  }
  const users = (rawUsers ?? []) as Row[]
  const AV = ['av-blue', 'av-violet', 'av-pink', 'av-green', 'av-amber', 'av-orange', 'av-teal', 'av-rose']

  const counts = {
    total: users.length,
    hr: users.filter(u => u.role === 'hr').length,
    leader: users.filter(u => u.role === 'leader').length,
    collaborator: users.filter(u => u.role === 'collaborator').length,
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><UsersRound size={12} /> Directorio</span>
          <h1 className="page__title">Usuarios</h1>
          <p className="page__subtitle">{counts.total} usuarios en el sistema.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }} className="anim-stagger">
        <div className="kpi">
          <div className="kpi__icon kpi__icon--blue"><UsersRound /></div>
          <div className="kpi__label">Total</div>
          <div className="kpi__value u-tabular">{counts.total}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--blue"><UsersRound /></div>
          <div className="kpi__label">Arq. Humana</div>
          <div className="kpi__value u-tabular">{counts.hr}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--violet"><UsersRound /></div>
          <div className="kpi__label">Líderes</div>
          <div className="kpi__value u-tabular">{counts.leader}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--green"><UsersRound /></div>
          <div className="kpi__label">Colaboradores</div>
          <div className="kpi__value u-tabular">{counts.collaborator}</div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-card__body--flush">
          {users.map((u, idx) => {
            const dept = Array.isArray(u.departments) ? u.departments[0] : u.departments
            const initials = u.full_name.split(' ').map(p => p[0]).slice(0, 2).join('')
            return (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 24px',
                  borderBottom: idx < users.length - 1 ? '1px solid var(--border-c)' : 'none',
                }}
              >
                <div className={`avatar avatar--md ${AV[idx % AV.length]}`}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: '-0.005em' }}>{u.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.email} · {dept?.name ?? 'Sin área'}
                  </div>
                </div>
                <span className={`ui-badge ui-badge--${ROLE_TONE[u.role] ?? 'slate'}`}>
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
