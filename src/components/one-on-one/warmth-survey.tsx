'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { submitWarmthResponse } from '@/lib/actions/warmth'

const QUESTIONS = [
  { key: 'feltHeard', label: 'Me sentí escuchada/o en esta sesión' },
  { key: 'comfortableSharing', label: 'Me sentí cómoda/o compartiendo lo que pensaba' },
  { key: 'leaderEngaged', label: 'Sentí que mi líder estuvo presente y enfocada/o' },
  { key: 'conversationQuality', label: 'La conversación fue significativa para mí' },
  { key: 'clarityAfterSession', label: 'Salí con claridad de los próximos pasos' },
] as const

type QuestionKey = typeof QUESTIONS[number]['key']

interface WarmthSurveyProps {
  oneOnOneId: string
  onSubmitted: () => void
}

export function WarmthSurvey({ oneOnOneId, onSubmitted }: WarmthSurveyProps) {
  const [responses, setResponses] = useState<Record<QuestionKey, number>>({
    feltHeard: 3,
    comfortableSharing: 3,
    leaderEngaged: 3,
    conversationQuality: 3,
    clarityAfterSession: 3,
  })
  const [comment, setComment] = useState('')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  function handleSubmit() {
    startTransition(async () => {
      const result = await submitWarmthResponse({
        oneOnOneId,
        feltHeard: responses.feltHeard,
        comfortableSharing: responses.comfortableSharing,
        leaderEngaged: responses.leaderEngaged,
        conversationQuality: responses.conversationQuality,
        clarityAfterSession: responses.clarityAfterSession,
        freeComment: comment.trim() || undefined,
      })

      if (!result.success) {
        toast({ title: 'No se pudo guardar', description: result.error, variant: 'destructive' })
        return
      }

      toast({ title: 'Gracias por tu feedback', description: 'Ya podés dar tu VoBo.' })
      onSubmitted()
      router.refresh()
    })
  }

  return (
    <section className="ui-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Calidez de la sesión</h3>
      <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem' }}>
        Tu líder verá solo agregados, nunca respuestas individuales. Es seguro ser honesta/o.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {QUESTIONS.map((q) => (
          <div key={q.key}>
            <label
              htmlFor={`warmth-${q.key}`}
              style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}
            >
              {q.label}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>1</span>
              <input
                id={`warmth-${q.key}`}
                type="range"
                min={1}
                max={5}
                step={1}
                value={responses[q.key]}
                onChange={(e) => setResponses((r) => ({ ...r, [q.key]: Number(e.target.value) }))}
                style={{ flex: 1, accentColor: 'hsl(var(--primary))' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>5</span>
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'hsl(var(--primary))',
                  width: '1.5rem',
                  textAlign: 'right',
                }}
              >
                {responses[q.key]}
              </span>
            </div>
          </div>
        ))}

        <div>
          <label
            htmlFor="warmth-comment"
            style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}
          >
            Comentario libre (opcional)
          </label>
          <textarea
            id="warmth-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Cualquier cosa que quieras agregar…"
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--background))',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              resize: 'vertical',
            }}
          />
          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', textAlign: 'right', marginTop: '0.25rem' }}>
            {comment.length}/1000
          </p>
        </div>

        <button
          type="button"
          className="ui-btn"
          onClick={handleSubmit}
          disabled={isPending}
          style={{
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            padding: '0.625rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            fontWeight: 600,
            cursor: isPending ? 'wait' : 'pointer',
          }}
        >
          {isPending ? 'Guardando…' : 'Guardar y habilitar VoBo'}
        </button>
      </div>
    </section>
  )
}
