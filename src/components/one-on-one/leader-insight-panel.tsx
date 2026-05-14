'use client'

import { useState } from 'react'
import { Sparkles, ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react'
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

const CATEGORY_TONE: Record<SuggestedQuestion['category'], string> = {
  desempeño: 'hsl(var(--primary))',
  desarrollo: 'hsl(217 91% 60%)', // azul
  bienestar: 'hsl(var(--success))',
  seguimiento: 'hsl(var(--warning))',
  feedback: 'hsl(280 75% 60%)', // morado
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

  const hasQuestions = questions.length > 0
  const firstName = collaboratorName.split(' ')[0]

  return (
    <section
      className="ui-card"
      style={{
        background: 'hsl(var(--accent) / 0.5)',
        borderColor: 'hsl(var(--primary) / 0.25)',
        padding: '12px 14px',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          justifyContent: 'space-between',
          cursor: hasQuestions ? 'pointer' : 'default',
        }}
        onClick={() => hasQuestions && setExpanded((e) => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <Sparkles size={14} style={{ color: 'hsl(var(--primary))', flexShrink: 0 }} />
          <h3
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Preguntas para {firstName}
          </h3>
          {hasQuestions && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 999,
                background: 'hsl(var(--primary) / 0.18)',
                color: 'hsl(var(--primary))',
                letterSpacing: '0.04em',
              }}
            >
              {questions.length}
            </span>
          )}
        </div>
        {hasQuestions ? (
          <button
            type="button"
            aria-label={expanded ? 'Contraer' : 'Expandir'}
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((x) => !x)
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'hsl(var(--muted-foreground))',
              padding: 2,
              display: 'inline-flex',
            }}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        ) : null}
      </header>

      {!hasQuestions && !error && (
        <p
          style={{
            margin: '8px 0 10px',
            fontSize: 11.5,
            color: 'hsl(var(--muted-foreground))',
            lineHeight: 1.45,
          }}
        >
          Generá 5 preguntas contextualizadas en base al historial reciente y los acuerdos abiertos.
        </p>
      )}

      {error && (
        <p
          style={{
            margin: '8px 0 10px',
            fontSize: 11.5,
            color: 'hsl(var(--warning))',
            lineHeight: 1.45,
          }}
        >
          {error}
        </p>
      )}

      <button
        type="button"
        className="ui-btn ui-btn--accent ui-btn--sm"
        onClick={handleGenerate}
        disabled={isLoading}
        style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
      >
        {isLoading ? (
          <Loader2 size={12} className="spinner" />
        ) : hasQuestions ? (
          <RefreshCw size={12} />
        ) : (
          <Sparkles size={12} />
        )}
        <span>{isLoading ? 'Generando…' : hasQuestions ? 'Regenerar' : 'Generar preguntas con IA'}</span>
      </button>

      {expanded && hasQuestions && (
        <ul
          style={{
            listStyle: 'none',
            margin: '12px 0 0',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {questions.map((q, i) => {
            const tone = CATEGORY_TONE[q.category] ?? 'hsl(var(--primary))'
            return (
              <li
                key={i}
                style={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  padding: '10px 12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: tone,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      color: tone,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                    }}
                  >
                    {CATEGORY_LABELS[q.category] ?? q.category}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: 'hsl(var(--foreground))',
                    lineHeight: 1.4,
                  }}
                >
                  {q.question}
                </p>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: 11,
                    color: 'hsl(var(--muted-foreground))',
                    lineHeight: 1.4,
                  }}
                >
                  {q.rationale}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
