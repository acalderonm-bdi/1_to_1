import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarClock, Filter, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

// North star de RH: pares líder↔colaborador atrasados según su cadencia EFECTIVA.
// Lee la vista overdue_relations (security_invoker → RH ve todo).
export default async function IncumplimientosPage({
  searchParams,
}: { searchParams: { area?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: raw } = await supabase
    .from('overdue_relations')
    .select('relation_id, leader_name, collaborator_name, collaborator_id, department_name, days_since, cadence_days')
    .eq('is_overdue', true)

  type Row = {
    relation_id: string | null
    leader_name: string | null
    collaborator_name: string | null
    collaborator_id: string | null
    department_name: string | null
    days_since: number | null
    cadence_days: number | null
  }
  const all = (raw ?? []) as Row[]

  // Orden: nunca-reunidos primero, luego por más días de atraso.
  all.sort((a, b) => {
    if (a.days_since == null && b.days_since == null) return 0
    if (a.days_since == null) return -1
    if (b.days_since == null) return 1
    return b.days_since - a.days_since
  })

  const areas = Array.from(new Set(all.map(r => r.department_name).filter(Boolean))) as string[]
  const rows = searchParams.area ? all.filter(r => r.department_name === searchParams.area) : all

  const neverMet = all.filter(r => r.days_since == null).length
  const worst = all.reduce((m, r) => Math.max(m, r.days_since ?? 0), 0)

  const filterChip = (label: string, value: string | undefined) => {
    const isActive = value === searchParams.area
    const href = value
      ? `/arquitectura-humana/incumplimientos?area=${encodeURIComponent(value)}`
      : '/arquitectura-humana/incumplimientos'
    return (
      <Link
        key={value ?? 'all'}
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
          <span className="page__eyebrow"><CalendarClock size={12} /> Cadencia</span>
          <h1 className="page__title">Incumplimientos</h1>
          <p className="page__subtitle">
            Pares líder–colaborador que superaron su cadencia. Interviene antes de que se vuelva crónico.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }} className="anim-stagger">
        <div className="kpi">
          <div className="kpi__icon kpi__icon--red"><AlertCircle /></div>
          <div className="kpi__label">Pares atrasados</div>
          <div className="kpi__value u-tabular">{all.length}</div>
          <div className="kpi__delta">sobre su cadencia</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--amber"><CalendarClock /></div>
          <div className="kpi__label">Sin 1:1 nunca</div>
          <div className="kpi__value u-tabular">{neverMet}</div>
          <div className="kpi__delta">relaciones sin historial</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--red"><AlertCircle /></div>
          <div className="kpi__label">Mayor atraso</div>
          <div className="kpi__value u-tabular">{worst}</div>
          <div className="kpi__delta">días</div>
        </div>
      </div>

      {areas.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <Filter size={13} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Área</span>
          {filterChip('Todas', undefined)}
          {areas.map(a => filterChip(a, a))}
        </div>
      )}

      <div className="ui-card">
        <div className="ui-card__body ui-card__body--flush">
          {rows.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {all.length === 0 ? '🎉 Nadie está atrasado. Toda la organización está al día con sus 1:1s.' : 'No hay incumplimientos en esta área.'}
            </div>
          ) : rows.map((r, idx) => (
            <div
              key={r.relation_id ?? idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 24px',
                borderBottom: idx < rows.length - 1 ? '1px solid var(--border-c)' : 'none',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: '-0.005em' }}>
                  {r.collaborator_name ?? '—'} <span style={{ color: 'var(--text-subtle)' }}>·</span> <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>líder: {r.leader_name ?? '—'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {r.department_name ?? 'Sin área'} · cadencia {r.cadence_days ?? '—'} días
                </div>
              </div>
              <span className={`ui-badge ui-badge--${r.days_since == null ? 'red' : 'amber'}`}>
                {r.days_since == null ? 'Sin 1:1 nunca' : `${r.days_since} días`}
              </span>
              {r.collaborator_id && (
                <Link href={`/lider/colaborador/${r.collaborator_id}`} className="ui-btn ui-btn--outline ui-btn--sm">
                  Ver
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
