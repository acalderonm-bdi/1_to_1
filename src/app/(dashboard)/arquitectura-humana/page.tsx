import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TrendingUp, AlertTriangle, FileText, CheckSquare, ArrowRight, Calendar, Building2 } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

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

  function complianceTone(rate: number) {
    if (rate >= 80) return 'green'
    if (rate >= 60) return 'amber'
    if (rate >= 40) return 'orange'
    return 'red'
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Building2 size={12} /> Visión global</span>
          <h1 className="page__title">Panel de Arquitectura Humana</h1>
          <p className="page__subtitle">
            Visibilidad organizacional del cumplimiento, acuerdos y salud de las conversaciones 1:1.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }} className="anim-stagger">
        <div className="kpi">
          <div className="kpi__icon kpi__icon--green"><TrendingUp /></div>
          <div className="kpi__label">Cumplimiento</div>
          <div className="kpi__value u-tabular">{globalCompliance}%</div>
          <div className="kpi__delta kpi__delta--up">{realized}/{totalMeetings} realizadas</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--red"><Calendar /></div>
          <div className="kpi__label">No realizadas</div>
          <div className="kpi__value u-tabular">{missed}</div>
          <div className="kpi__delta">este mes</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--orange"><AlertTriangle /></div>
          <div className="kpi__label">En disputa</div>
          <div className="kpi__value u-tabular">{disputed}</div>
          <div className="kpi__delta">requieren revisión</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--violet"><FileText /></div>
          <div className="kpi__label">Reportes IA</div>
          <div className="kpi__value u-tabular">{unreviewedReports ?? 0}</div>
          <div className="kpi__delta">sin revisar</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }} className="anim-stagger">
        <div className="kpi">
          <div className="kpi__icon kpi__icon--amber"><CheckSquare /></div>
          <div className="kpi__label">Acuerdos pendientes</div>
          <div className="kpi__value u-tabular">{pending}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--green"><CheckSquare /></div>
          <div className="kpi__label">Acuerdos cumplidos</div>
          <div className="kpi__value u-tabular">{fulfilled}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--blue"><CheckSquare /></div>
          <div className="kpi__label">Total de acuerdos</div>
          <div className="kpi__value u-tabular">{agreements.length}</div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">
              <TrendingUp size={15} /> Cumplimiento por área
            </h3>
            <p className="ui-card__desc">Ordenado de menor a mayor cumplimiento</p>
          </div>
          <Link href="/arquitectura-humana/mapa-calor" className="ui-btn ui-btn--ghost ui-btn--sm">
            Ver mapa de calor <ArrowRight size={11} />
          </Link>
        </div>
        <div className="ui-card__body" style={{ display: 'grid', gap: 14 }}>
          {metrics.length === 0 ? (
            <EmptyState
              illustration="list"
              title="Sin métricas registradas"
              description="Cuando los líderes empiecen a registrar sus 1:1s, las métricas de cumplimiento por área aparecerán aquí."
            />
          ) : (
            <div className="anim-stagger" style={{ display: 'grid', gap: 14 }}>
              {metrics.map(d => {
                const rate = d.compliance_rate ?? 0
                const tone = complianceTone(rate)
                const fillTone = tone === 'orange' ? 'amber' : tone
                const toneColor =
                  tone === 'green'
                    ? 'hsl(var(--success))'
                    : tone === 'red'
                      ? 'hsl(var(--destructive))'
                      : 'hsl(var(--warning))'
                return (
                  <div
                    key={d.department_id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(140px, 200px) 1fr auto',
                      alignItems: 'center',
                      gap: 16,
                      padding: '4px 0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 8, height: 8, borderRadius: 999,
                          background: toneColor,
                          boxShadow: `0 0 0 3px color-mix(in oklab, ${toneColor} 18%, transparent)`,
                          flexShrink: 0,
                        }}
                      />
                      <span className="u-truncate" style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: '-0.005em' }}>
                        {d.department_name}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className={`progress-bar__fill progress-bar__fill--${fillTone}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span
                      className="u-tabular"
                      style={{
                        fontSize: 16,
                        fontWeight: 500,
                        textAlign: 'right',
                        fontFamily: 'var(--font-serif)',
                        letterSpacing: '-0.012em',
                        minWidth: 56,
                        color: toneColor,
                      }}
                    >
                      {rate}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
