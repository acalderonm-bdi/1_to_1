import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TrendingUp, AlertTriangle, FileText, CheckSquare, ArrowRight } from 'lucide-react'

export default async function ArquitecturaHumanaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [
    { data: rawMetrics },
    { count: unreviewedReports },
    { data: rawMeetings },
    { data: rawAgreements },
  ] = await Promise.all([
    supabase.from('compliance_metrics').select('*').order('compliance_rate', { ascending: true }),
    supabase.from('ai_reports').select('id', { count: 'exact', head: true }).eq('reviewed', false),
    supabase.from('one_on_ones').select('status').gte('scheduled_at', startOfMonth.toISOString()),
    supabase.from('agreements').select('status'),
  ])

  const metrics = (rawMetrics ?? []) as Array<{
    department_id: string | null; department_name: string | null;
    compliance_rate: number | null; realized_meetings: number | null; total_meetings: number | null
  }>
  const monthMeetings = (rawMeetings ?? []) as Array<{ status: string }>
  const agreements = (rawAgreements ?? []) as Array<{ status: string }>

  const totalMeetings = monthMeetings.length
  const realized = monthMeetings.filter(m => m.status === 'realizada').length
  const disputed = monthMeetings.filter(m => m.status === 'en_disputa').length
  const missed = monthMeetings.filter(m => m.status === 'no_realizada').length
  const fulfilled = agreements.filter(a => a.status === 'cumplido').length
  const pending = agreements.filter(a => a.status === 'pendiente').length
  const globalCompliance = totalMeetings > 0 ? Math.round((realized / totalMeetings) * 100) : 0

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Panel de Arquitectura Humana</h1>
          <p className="page__subtitle">Visibilidad global del cumplimiento organizacional</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="kpi">
          <div className="kpi__label"><TrendingUp size={13} /> Cumplimiento</div>
          <div className="kpi__value">{globalCompliance}%</div>
          <div className="kpi__delta kpi__delta--up">{realized}/{totalMeetings} realizadas</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">No realizadas</div>
          <div className="kpi__value">{missed}</div>
          <div className="kpi__delta">este mes</div>
        </div>
        <div className="kpi">
          <div className="kpi__label"><AlertTriangle size={13} /> En disputa</div>
          <div className="kpi__value">{disputed}</div>
          <div className="kpi__delta">requieren revisión</div>
        </div>
        <div className="kpi">
          <div className="kpi__label"><FileText size={13} /> Reportes IA</div>
          <div className="kpi__value">{unreviewedReports ?? 0}</div>
          <div className="kpi__delta">sin revisar</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="kpi">
          <div className="kpi__label"><CheckSquare size={13} /> Acuerdos pendientes</div>
          <div className="kpi__value">{pending}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Acuerdos cumplidos</div>
          <div className="kpi__value">{fulfilled}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Total de acuerdos</div>
          <div className="kpi__value">{agreements.length}</div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">Cumplimiento por área</h3>
            <p className="ui-card__desc">Ordenado de menor a mayor</p>
          </div>
          <Link href="/arquitectura-humana/mapa-calor" className="ui-btn ui-btn--ghost ui-btn--sm">
            Ver mapa de calor <ArrowRight size={12} />
          </Link>
        </div>
        <div className="ui-card__body" style={{ display: 'grid', gap: 14 }}>
          {metrics.map(d => (
            <div key={d.department_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <span style={{ fontSize: 13.5, fontWeight: 500, minWidth: 160 }}>{d.department_name}</span>
              <div className="progress-bar" style={{ flex: 1 }}>
                <div className="progress-bar__fill" style={{ width: `${d.compliance_rate ?? 0}%` }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, minWidth: 50, textAlign: 'right', fontFamily: 'var(--font-serif)' }}>
                {d.compliance_rate ?? 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
