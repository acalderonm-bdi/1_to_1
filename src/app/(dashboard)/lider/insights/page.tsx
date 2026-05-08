import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sparkles } from 'lucide-react'

const CATEGORY_TONE: Record<string, string> = {
  desempeño: 'blue', desarrollo: 'violet', bienestar: 'green',
  seguimiento: 'amber', feedback: 'orange',
}
const CATEGORY_LABELS: Record<string, string> = {
  desempeño: 'Desempeño', desarrollo: 'Desarrollo', bienestar: 'Bienestar',
  seguimiento: 'Seguimiento', feedback: 'Feedback',
}

export default async function InsightsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawInsights } = await supabase
    .from('ai_insights')
    .select('id, type, content, used, created_at, users!ai_insights_collaborator_id_fkey(full_name)')
    .eq('leader_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const insights = (rawInsights ?? []) as Array<{
    id: string; type: string; content: unknown; used: boolean; created_at: string;
    users: { full_name: string } | Array<{ full_name: string }> | null
  }>

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Sparkles size={12} /> Asistente IA</span>
          <h1 className="page__title">Insights del asistente</h1>
          <p className="page__subtitle">
            Sugerencias contextuales para tus 1:1s, basadas en patrones de conversación y acuerdos.
          </p>
        </div>
        <span className="ai-chip" style={{ fontSize: 11.5 }}>Asistente IA</span>
      </div>

      {insights.length === 0 ? (
        <div className="ui-card">
          <div className="empty">
            <div className="empty__icon" style={{ background: 'var(--ai-tint)', color: 'var(--ai-text)' }}>
              <Sparkles />
            </div>
            <h3 className="empty__title">Sin sugerencias por ahora</h3>
            <p className="empty__desc">
              Las sugerencias del asistente aparecerán después de tus próximas 1:1s.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }} className="anim-stagger">
          {insights.map(insight => {
            const collab = Array.isArray(insight.users) ? insight.users[0] : insight.users
            const content = insight.content as Record<string, unknown>
            return (
              <div key={insight.id} className="ui-card ai-card">
                <div className="ui-card__head" style={{ borderBottom: 'none' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span className="ai-chip">Sugerencia</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(insight.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <h3 className="font-serif" style={{ fontSize: 20, letterSpacing: '-0.014em', fontWeight: 500, margin: 0 }}>
                      Para {collab?.full_name?.split(' ')[0] ?? 'tu colaborador'}
                    </h3>
                  </div>
                </div>
                <div className="ui-card__body" style={{ display: 'grid', gap: 10 }}>
                  {insight.type === 'suggested_questions' && Array.isArray(content['questions']) &&
                    (content['questions'] as Array<{ question: string; rationale: string; category: string }>).map((q, i) => (
                      <div key={i} className="insight-q">
                        <div className="insight-q__num">{i + 1}</div>
                        <div style={{ flex: 1 }}>
                          <p className="insight-q__text">{q.question}</p>
                          {q.rationale && <p className="insight-q__just">{q.rationale}</p>}
                          <div className="insight-q__cat-row">
                            <span className={`ui-badge ui-badge--${CATEGORY_TONE[q.category] ?? 'slate'}`}>
                              {CATEGORY_LABELS[q.category] ?? q.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  {insight.type !== 'suggested_questions' && typeof content['description'] === 'string' && (
                    <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>{content['description'] as string}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
