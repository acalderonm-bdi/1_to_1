import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sparkles, AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { ReportReviewButton } from '@/components/arquitectura-humana/report-review-button'

const SEVERITY_TONE: Record<string, string> = { info: 'blue', warning: 'amber', critical: 'red' }
const SEVERITY_LABELS: Record<string, string> = { info: 'Informativo', warning: 'Atención', critical: 'Crítico' }

// F1: tipo manual del select de baja calidad. Las columnas ai_quality_*
// existen en el esquema (Fase A) pero aún no están en los tipos generados.
interface LowQualityAgreement {
  id: string
  description: string
  ai_quality_score: number | null
  ai_quality_warnings: string[]
  due_date: string | null
  status: 'pendiente' | 'parcial'
  responsible: { full_name: string } | null
}

export default async function ReportesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawReports } = await supabase
    .from('ai_reports').select('*').order('created_at', { ascending: false }).limit(50)
  const reports = (rawReports ?? []) as Array<{
    id: string; title: string; content: string; severity: string;
    reviewed: boolean; created_at: string
  }>

  // F1: acuerdos abiertos con score IA bajo 3.0 — candidatos a reescritura.
  // Las columnas ai_quality_* aún no están en los tipos generados, casteamos
  // los filtros con `as never` y el resultado vía `unknown`.
  const { data: rawLowQuality } = await supabase
    .from('agreements')
    .select(`
      id,
      description,
      ai_quality_score,
      ai_quality_warnings,
      due_date,
      status,
      responsible:users!agreements_responsible_id_fkey(full_name)
    `)
    .lt('ai_quality_score' as never, 3.0)
    .in('status', ['pendiente', 'parcial'])
    .order('ai_quality_score' as never, { ascending: true })
    .limit(20)

  const lowQualityList = ((rawLowQuality ?? []) as unknown as Array<{
    id: string
    description: string
    ai_quality_score: number | null
    ai_quality_warnings: string[] | null
    due_date: string | null
    status: 'pendiente' | 'parcial'
    responsible: { full_name: string } | { full_name: string }[] | null
  }>).map<LowQualityAgreement>(a => ({
    id: a.id,
    description: a.description,
    ai_quality_score: a.ai_quality_score,
    ai_quality_warnings: a.ai_quality_warnings ?? [],
    due_date: a.due_date,
    status: a.status,
    responsible: Array.isArray(a.responsible) ? a.responsible[0] ?? null : a.responsible,
  }))

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Sparkles size={12} /> Asistente IA</span>
          <h1 className="page__title">Reportes del asistente</h1>
          <p className="page__subtitle">
            Patrones detectados automáticamente que merecen tu atención.
          </p>
        </div>
        <span className="ai-chip">Generado por IA</span>
      </div>

      {/* F1: Card de acuerdos con score IA bajo */}
      <section className="ui-card" style={{ padding: '1.5rem', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <AlertTriangle size={16} style={{ color: 'hsl(var(--warning))' }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            Acuerdos de baja calidad
          </h3>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Score IA bajo 3.0 — revisar o reescribir
        </p>
        {lowQualityList.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No hay acuerdos con score bajo.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lowQualityList.map(a => (
              <div
                key={a.id}
                style={{
                  padding: 12,
                  background: 'hsl(var(--muted) / 0.4)',
                  borderRadius: 'var(--r-md)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, margin: 0 }}>
                    {a.description.length > 100
                      ? `${a.description.slice(0, 100)}…`
                      : a.description}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      marginTop: 4,
                      marginBottom: 0,
                    }}
                  >
                    Responsable: {a.responsible?.full_name ?? '—'} · Warnings:{' '}
                    {a.ai_quality_warnings.length > 0
                      ? a.ai_quality_warnings.join(', ')
                      : '—'}
                  </p>
                </div>
                <span
                  className="ui-badge"
                  style={{
                    background: 'hsl(var(--destructive) / 0.15)',
                    color: 'hsl(var(--destructive))',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {a.ai_quality_score !== null
                    ? Number(a.ai_quality_score).toFixed(1)
                    : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {reports.length === 0 ? (
        <div className="ui-card">
          <EmptyState
            illustration="sparkles"
            title="Sin reportes por ahora"
            description="Aparecerán aquí cuando el asistente detecte patrones organizacionales relevantes — frecuencia de cumplimiento, áreas con cadencia caída, acuerdos olvidados."
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }} className="anim-stagger">
          {reports.map(r => (
            <div key={r.id} className="ui-card" style={{ opacity: r.reviewed ? 0.7 : 1 }}>
              <div className="ui-card__head">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span className={`ui-badge ui-badge--${SEVERITY_TONE[r.severity] ?? 'slate'}`}>
                      {SEVERITY_LABELS[r.severity]}
                    </span>
                    {r.reviewed && <span className="ui-badge ui-badge--slate ui-badge--plain">Revisado</span>}
                  </div>
                  <h3 className="font-serif" style={{ fontSize: 18, letterSpacing: '-0.012em', fontWeight: 500, margin: 0 }}>
                    {r.title}
                  </h3>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>
                  {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <div className="ui-card__body">
                <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-c)', margin: 0, marginBottom: 14 }}>{r.content}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <ReportReviewButton reportId={r.id} reviewed={r.reviewed} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
