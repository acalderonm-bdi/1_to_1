'use client'

import { useState } from 'react'
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import type { SuggestedQuestion } from '@/types/domain'

interface LeaderInsightPanelProps {
  collaboratorId: string
  collaboratorName: string
}

const CATEGORY_LABELS: Record<SuggestedQuestion['category'], string> = {
  desempeño: 'Desempeño',
  desarrollo: 'Desarrollo',
  bienestar: 'Bienestar',
  seguimiento: 'Seguimiento',
  feedback: 'Feedback',
}

export function LeaderInsightPanel({ collaboratorId, collaboratorName }: LeaderInsightPanelProps) {
  const [questions, setQuestions] = useState<SuggestedQuestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
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
      const data = (await res.json()) as { questions: SuggestedQuestion[]; error?: string }
      if (data.questions?.length) {
        setQuestions(data.questions)
        setExpanded(true)
      } else {
        setError(data.error ?? 'Sin sugerencias disponibles')
      }
    } catch {
      setError('IA no disponible')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section
      className="ui-card"
      style={{
        background: 'hsl(var(--accent) / 0.45)',
        borderColor: 'hsl(var(--primary) / 0.25)',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} style={{ color: 'hsl(var(--primary))' }} />
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            Preguntas sugeridas por IA · {collaboratorName}
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {questions.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? 'Contraer' : 'Expandir'}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'hsl(var(--primary))',
                padding: 4,
                display: 'inline-flex',
              }}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
          <button
            type="button"
            className="ui-btn ui-btn--accent ui-btn--sm"
            onClick={handleGenerate}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 size={13} className="spinner" /> : <Sparkles size={13} />}
            <span>{isLoading ? 'Generando…' : questions.length > 0 ? 'Regenerar' : 'Generar preguntas'}</span>
          </button>
        </div>
      </div>

      {!expanded && questions.length === 0 && !error && (
        <p style={{ marginTop: 8, marginBottom: 0, fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
          Generá 5 preguntas contextualizadas en base al historial reciente de 1:1s y los acuerdos abiertos.
        </p>
      )}

      {error && (
        <p style={{ marginTop: 8, marginBottom: 0, fontSize: '0.8rem', color: 'hsl(var(--warning))' }}>
          {error}
        </p>
      )}

      {expanded && questions.length > 0 && (
        <ol style={{ marginTop: 12, marginBottom: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {questions.map((q, i) => (
            <li key={i}>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                {q.question}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                {q.rationale}
              </p>
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 4,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'hsl(var(--primary))',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {CATEGORY_LABELS[q.category] ?? q.category}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
