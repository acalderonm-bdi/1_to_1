import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Grid } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/shared/empty-state'
import { WarmthHeatmap } from '@/components/arquitectura-humana/warmth-heatmap'

export default async function MapaCalorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawMetrics } = await supabase
    .from('compliance_metrics')
    .select('*')
    .order('compliance_rate', { ascending: false })

  const metrics = (rawMetrics ?? []) as Array<{
    department_id: string | null; department_name: string | null;
    total_meetings: number | null; realized_meetings: number | null;
    disputed_meetings: number | null; total_agreements: number | null;
    fulfilled_agreements: number | null; compliance_rate: number | null
  }>

  // F6: calidez por líder. Las views no exponen FK alias, así que hacemos lookup separado.
  const rawByLeaderQuery = (await supabase
    .from('warmth_metrics_by_leader' as never)
    .select('leader_id, response_count, avg_overall')
    .order('avg_overall' as never, { ascending: true })) as unknown as {
      data: Array<{ leader_id: string; response_count: number; avg_overall: number }> | null
    }
  const rawByLeader = rawByLeaderQuery.data ?? []

  const leaderIds = rawByLeader.map((r) => r.leader_id)
  const nameMap = new Map<string, string>()
  if (leaderIds.length > 0) {
    const { data: leaders } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', leaderIds)
    for (const u of (leaders ?? []) as Array<{ id: string; full_name: string }>) {
      nameMap.set(u.id, u.full_name)
    }
  }

  const byLeader = rawByLeader.map((r) => ({
    label: nameMap.get(r.leader_id) ?? 'Sin nombre',
    avg: Number(r.avg_overall),
    count: r.response_count,
  }))

  // F6: calidez por departamento.
  const byDeptQuery = (await supabase
    .from('warmth_metrics_by_department' as never)
    .select('*')
    .order('avg_overall' as never, { ascending: true })) as unknown as {
      data: Array<{
        department_id: string | null
        department_name: string | null
        response_count: number
        avg_overall: number
      }> | null
    }
  const byDept = (byDeptQuery.data ?? []).map((r) => ({
    label: r.department_name ?? 'Sin departamento',
    avg: Number(r.avg_overall),
    count: r.response_count,
  }))

  function tone(rate: number | null): 'green' | 'amber' | 'orange' | 'red' {
    const r = rate ?? 0
    if (r >= 80) return 'green'
    if (r >= 60) return 'amber'
    if (r >= 40) return 'orange'
    return 'red'
  }

  const legend: Array<{ tone: 'green' | 'amber' | 'orange' | 'red'; label: string; color: string }> = [
    { tone: 'green', label: '≥ 80%', color: 'hsl(var(--success))' },
    { tone: 'amber', label: '60–79%', color: 'hsl(var(--warning))' },
    { tone: 'orange', label: '40–59%', color: 'hsl(var(--warning) / 0.7)' },
    { tone: 'red', label: '< 40%', color: 'hsl(var(--destructive))' },
  ]

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Grid size={12} /> Cumplimiento</span>
          <h1 className="page__title">Mapa de calor</h1>
          <p className="page__subtitle">
            Cumplimiento de 1:1s por área organizacional este mes.
          </p>
        </div>
        <div
          className="ui-card"
          style={{
            padding: '8px 14px',
            display: 'flex',
            gap: 16,
            fontSize: 11.5,
            color: 'var(--text-muted)',
            alignItems: 'center',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          {legend.map(l => (
            <span key={l.tone} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: l.color,
                  boxShadow: `0 0 0 2px color-mix(in oklab, ${l.color} 16%, transparent)`,
                }}
              />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {metrics.length === 0 ? (
        <div className="ui-card">
          <EmptyState
            illustration="search"
            title="Sin datos por ahora"
            description="Cuando los líderes registren sus 1:1s en este periodo, el mapa se poblará con métricas por área."
          />
        </div>
      ) : (
      <div className="heatmap-grid anim-stagger">
        {metrics.map(d => {
          const t = tone(d.compliance_rate)
          const href = d.department_id
            ? `/arquitectura-humana/usuarios?department=${d.department_id}`
            : '/arquitectura-humana/usuarios'
          return (
            <Link
              key={d.department_id}
              href={href}
              className={`heat-card heat-card--${t}`}
              style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              <div className="heat-card__head">
                <div>
                  <h3 className="heat-card__name">{d.department_name}</h3>
                  <p className="heat-card__sub">
                    {d.realized_meetings ?? 0}/{d.total_meetings ?? 0} reuniones realizadas
                  </p>
                </div>
              </div>
              <div className="heat-card__pct u-tabular">{d.compliance_rate ?? 0}%</div>
              <div className="heat-card__bar">
                <div style={{ width: `${d.compliance_rate ?? 0}%` }} />
              </div>
              <div className="heat-card__stats">
                <div>
                  <div className="heat-card__stat-label">Disputas</div>
                  <div className="heat-card__stat-value u-tabular">{d.disputed_meetings ?? 0}</div>
                </div>
                <div>
                  <div className="heat-card__stat-label">Acuerdos</div>
                  <div className="heat-card__stat-value u-tabular">{d.total_agreements ?? 0}</div>
                </div>
                <div>
                  <div className="heat-card__stat-label">Cumplidos</div>
                  <div className="heat-card__stat-value u-tabular">{d.fulfilled_agreements ?? 0}</div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
      )}

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          marginTop: '1.5rem',
        }}
      >
        <WarmthHeatmap
          title="Calidez por líder"
          description="Promedio de las 5 dimensiones, ordenado de menor a mayor"
          rows={byLeader}
        />
        <WarmthHeatmap
          title="Calidez por departamento"
          description="Promedio de calidez por área organizacional"
          rows={byDept}
        />
      </div>
    </div>
  )
}
