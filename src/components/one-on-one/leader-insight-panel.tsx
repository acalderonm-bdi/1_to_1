'use client'

import { useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'

interface Insight { id: string; type: string; content: unknown; created_at: string }
interface LeaderInsightPanelProps {
  collaboratorId: string
  collaboratorName: string
  insights: Insight[]
}

const CATEGORY_TONE: Record<string, string> = {
  desempeño: 'blue', desarrollo: 'violet', bienestar: 'green',
  seguimiento: 'amber', feedback: 'orange',
}
const CATEGORY_LABELS: Record<string, string> = {
  desempeño: 'Desempeño', desarrollo: 'Desarrollo', bienestar: 'Bienestar',
  seguimiento: 'Seguimiento', feedback: 'Feedback',
}

export function LeaderInsightPanel({ collaboratorId, collaboratorName }: LeaderInsightPanelProps) {
  const [questions, setQuestions] = useState<Array<{ question: string; rationale: string; category: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate() {
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/suggest-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collaboratorId }),
      })
      const data = await res.json() as {
        questions: Array<{ question: string; rationale: string; category: string }>;
        error?: string
      }
      if (data.questions?.length) setQuestions(data.questions)
      else setError(data.error ?? 'Sin sugerencias disponibles')
    } catch {
      setError('IA no disponible')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16, position: 'sticky', top: 80 }}>
      <div className="ui-card ai-card">
        <div style={{ padding: 18 }}>
          <div style={{ marginBottom: 6 }}>
            <span className="ai-chip">Asistente</span>
          </div>
          <h3 className="font-serif" style={{ margin: 0, fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em' }}>
            Preguntas para {collaboratorName.split(' ')[0]}
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Sugerencias contextuales basadas en sus últimas 1:1s, acuerdos y temas recurrentes.
          </p>
          {questions.length === 0 && (
            <button
              type="button"
              className="ui-btn ui-btn--accent ui-btn--block"
              style={{ marginTop: 14 }}
              onClick={handleGenerate}
              disabled={isLoading}
            >
              {isLoading ? <span className="spinner" /> : <Sparkles size={13} />}
              <span>{isLoading ? 'Generando…' : 'Generar preguntas'}</span>
            </button>
          )}
          {error && <p style={{ marginTop: 10, fontSize: 12, color: 'var(--amber-700)' }}>{error}</p>}
        </div>
        {questions.length > 0 && (
          <>
            <hr className="ai-rule" style={{ margin: 0 }} />
            <div className="anim-stagger" style={{ padding: 14, display: 'grid', gap: 10 }}>
              {questions.map((q, i) => (
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
            </div>
            <div style={{ padding: '0 14px 14px' }}>
              <button type="button" className="ui-btn ui-btn--ghost ui-btn--block ui-btn--sm" onClick={handleGenerate} disabled={isLoading}>
                {isLoading ? <span className="spinner" /> : <RefreshCw size={13} />}
                <span>{isLoading ? 'Generando…' : 'Generar otras preguntas'}</span>
              </button>
            </div>
          </>
        )}
      </div>

      <div className="ui-card">
        <div style={{ padding: 16 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>Contexto rápido</h4>
          <div style={{ display: 'grid', gap: 10, fontSize: 12.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>1:1s realizadas (3m)</span>
              <strong>5 / 6</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Acuerdos cumplidos</span>
              <strong>89%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Última 1:1</span>
              <strong>hace 14 días</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Cadencia</span>
              <strong>Quincenal</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
