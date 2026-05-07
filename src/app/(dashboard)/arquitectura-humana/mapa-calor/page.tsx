import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

  function tone(rate: number | null): 'green' | 'amber' | 'orange' | 'red' {
    const r = rate ?? 0
    if (r >= 80) return 'green'
    if (r >= 60) return 'amber'
    if (r >= 40) return 'orange'
    return 'red'
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Mapa de calor</h1>
          <p className="page__subtitle">Cumplimiento de 1:1s por área organizacional</p>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--green-500)' }} /> ≥80%</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--amber-500)' }} /> 60–79</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--orange-500)' }} /> 40–59</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--red-500)' }} /> &lt;40</span>
        </div>
      </div>

      <div className="heatmap-grid">
        {metrics.map(d => {
          const t = tone(d.compliance_rate)
          return (
            <div key={d.department_id} className={`heat-card heat-card--${t}`}>
              <div className="heat-card__head">
                <div>
                  <h3 className="heat-card__name">{d.department_name}</h3>
                  <p className="heat-card__sub">{d.realized_meetings ?? 0}/{d.total_meetings ?? 0} reuniones realizadas</p>
                </div>
              </div>
              <div className="heat-card__pct">{d.compliance_rate ?? 0}%</div>
              <div className="heat-card__bar">
                <div style={{ width: `${d.compliance_rate ?? 0}%` }} />
              </div>
              <div className="heat-card__stats">
                <div>
                  <div className="heat-card__stat-label">Disputas</div>
                  <div className="heat-card__stat-value">{d.disputed_meetings ?? 0}</div>
                </div>
                <div>
                  <div className="heat-card__stat-label">Acuerdos</div>
                  <div className="heat-card__stat-value">{d.total_agreements ?? 0}</div>
                </div>
                <div>
                  <div className="heat-card__stat-label">Cumplidos</div>
                  <div className="heat-card__stat-value">{d.fulfilled_agreements ?? 0}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
