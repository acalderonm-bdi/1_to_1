import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sparkles } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

const SEVERITY_TONE: Record<string, string> = { info: 'blue', warning: 'amber', critical: 'red' }
const SEVERITY_LABELS: Record<string, string> = { info: 'Informativo', warning: 'Atención', critical: 'Crítico' }

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
                <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-c)', margin: 0 }}>{r.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
