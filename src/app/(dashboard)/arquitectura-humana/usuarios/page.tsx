import { redirect } from 'next/navigation'
import Link from 'next/link'
import { UsersRound, ArrowRight, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS } from '@/lib/constants'

const ROLE_TONE: Record<string, string> = { hr: 'blue', leader: 'violet', collaborator: 'slate' }

export default async function UsuariosPage({
  searchParams,
}: { searchParams: { department?: string; role?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rawUsers }, { data: rawDepts }] = await Promise.all([
    supabase.from('users').select('id, full_name, email, role, department_id, departments(name)').order('full_name'),
    supabase.from('departments').select('id, name').order('name'),
  ])

  type Row = {
    id: string; full_name: string; email: string; role: string; department_id: string | null
    departments: { name: string } | Array<{ name: string }> | null
  }
  const allUsers = (rawUsers ?? []) as Row[]
  const departments = (rawDepts ?? []) as Array<{ id: string; name: string }>

  const filteredByDept = searchParams.department
    ? allUsers.filter(u => u.department_id === searchParams.department)
    : allUsers
  const users = searchParams.role
    ? filteredByDept.filter(u => u.role === searchParams.role)
    : filteredByDept

  const AV = ['av-blue', 'av-violet', 'av-pink', 'av-green', 'av-amber', 'av-orange', 'av-teal', 'av-rose']

  const counts = {
    total: allUsers.length,
    hr: allUsers.filter(u => u.role === 'hr').length,
    leader: allUsers.filter(u => u.role === 'leader').length,
    collaborator: allUsers.filter(u => u.role === 'collaborator').length,
  }

  const activeDept = departments.find(d => d.id === searchParams.department)?.name
  const filterChip = (label: string, queryKey: 'department' | 'role', value: string | undefined, current: string | undefined) => {
    const isActive = value === current
    const next = new URLSearchParams()
    if (queryKey === 'department') {
      if (value) next.set('department', value)
      if (searchParams.role) next.set('role', searchParams.role)
    } else {
      if (value) next.set('role', value)
      if (searchParams.department) next.set('department', searchParams.department)
    }
    const href = next.toString() ? `/arquitectura-humana/usuarios?${next.toString()}` : '/arquitectura-humana/usuarios'
    return (
      <Link
        key={`${queryKey}-${value ?? 'all'}`}
        href={href}
        className={`ui-badge ui-badge--${isActive ? 'blue' : 'slate'}`}
        style={{ textDecoration: 'none', cursor: 'pointer' }}
      >
        {label}
      </Link>
    )
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><UsersRound size={12} /> Directorio</span>
          <h1 className="page__title">Usuarios</h1>
          <p className="page__subtitle">
            {users.length === allUsers.length
              ? `${counts.total} usuarios en el sistema.`
              : `${users.length} de ${counts.total} usuarios${activeDept ? ` · ${activeDept}` : ''}.`}
          </p>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Rol</span>
        {filterChip('Todos', 'role', undefined, searchParams.role)}
        {filterChip('Arq. Humana', 'role', 'hr', searchParams.role)}
        {filterChip('Líderes', 'role', 'leader', searchParams.role)}
        {filterChip('Colaboradores', 'role', 'collaborator', searchParams.role)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Área</span>
        {filterChip('Todas', 'department', undefined, searchParams.department)}
        {departments.map(d => filterChip(d.name, 'department', d.id, searchParams.department))}
      </div>

      <div className="ui-card">
        <div className="ui-card__body ui-card__body--flush">
          {users.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No hay usuarios en este filtro.
            </div>
          ) : users.map((u, idx) => {
            const dept = Array.isArray(u.departments) ? u.departments[0] : u.departments
            const initials = u.full_name.split(' ').map(p => p[0]).slice(0, 2).join('')
            return (
              <Link
                key={u.id}
                href={`/arquitectura-humana/usuarios/${u.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 24px',
                  borderBottom: idx < users.length - 1 ? '1px solid var(--border-c)' : 'none',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.15s var(--ease-out)',
                }}
                className="user-row"
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
                <ArrowRight size={14} style={{ color: 'var(--text-subtle)' }} />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
