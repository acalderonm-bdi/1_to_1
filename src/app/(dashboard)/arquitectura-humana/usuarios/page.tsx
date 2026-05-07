import { redirect } from 'next/navigation'
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

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Usuarios</h1>
          <p className="page__subtitle">{users.length} usuarios en el sistema</p>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-card__body--flush">
          {users.map((u, idx) => {
            const dept = Array.isArray(u.departments) ? u.departments[0] : u.departments
            const initials = u.full_name.split(' ').map(p => p[0]).slice(0, 2).join('')
            return (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderBottom: '1px solid var(--border-c)' }}>
                <div className={`avatar avatar--md ${AV[idx % AV.length]}`}>{initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{u.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email} · {dept?.name ?? 'Sin área'}</div>
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
