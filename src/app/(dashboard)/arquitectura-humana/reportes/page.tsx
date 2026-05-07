import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FileText } from 'lucide-react'

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
          <h1 className="page__title">Reportes del asistente</h1>
          <p className="page__subtitle">Patrones detectados automáticamente que merecen tu atención</p>
        </div>
        <span className="ai-chip">Generado por IA</span>
      </div>

      {reports.length === 0 ? (
        <div className="ui-card" style={{ padding: 60, textAlign: 'center' }}>
          <FileText size={32} style={{ margin: '0 auto', color: 'var(--text-subtle)' }} />
          <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 14 }}>Sin reportes por ahora</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {reports.map(r => (
            <div key={r.id} className="ui-card" style={{ opacity: r.reviewed ? 0.65 : 1 }}>
              <div className="ui-card__head">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className={`ui-badge ui-badge--${SEVERITY_TONE[r.severity] ?? 'slate'}`}>
                      {SEVERITY_LABELS[r.severity]}
                    </span>
                    {r.reviewed && <span className="ui-badge ui-badge--slate ui-badge--plain">Revisado</span>}
                  </div>
                  <h3 className="ui-card__title font-serif" style={{ fontSize: 17 }}>{r.title}</h3>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>
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
