'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { submitWarmthResponse } from '@/lib/actions/warmth'

// Las 5 dimensiones están fijas a columnas de `meeting_warmth_responses` en la
// DB. Lo que sí es configurable vía `org_settings.warmth_questions` son los
// labels (texto que ve el colaborador). El mapeo `setting_key → DB column` es
// estable: cualquier valor que pase la página padre como `questions` se aplica
// solo a los labels, conservando el orden y las claves canónicas siguientes.
const QUESTION_KEYS = [
  'feltHeard',
  'comfortableSharing',
  'leaderEngaged',
  'conversationQuality',
  'clarityAfterSession',
] as const

type QuestionKey = (typeof QUESTION_KEYS)[number]

const DEFAULT_LABELS: Record<QuestionKey, string> = {
  feltHeard: 'Me sentí escuchada/o en esta sesión',
  comfortableSharing: 'Me sentí cómoda/o compartiendo lo que pensaba',
  leaderEngaged: 'Sentí que mi líder estuvo presente y enfocada/o',
  conversationQuality: 'La conversación fue significativa para mí',
  clarityAfterSession: 'Salí con claridad de los próximos pasos',
}

// Las claves serializadas en `warmth_questions` siguen snake_case (espejo del
// schema de DB y del default en `org-settings.ts`). Mapeamos a las llaves
// camelCase que el componente y la action ya manejan.
const SETTING_KEY_TO_QUESTION_KEY: Record<string, QuestionKey> = {
  felt_heard: 'feltHeard',
  comfortable_sharing: 'comfortableSharing',
  leader_engaged: 'leaderEngaged',
  conversation_quality: 'conversationQuality',
  clarity_after_session: 'clarityAfterSession',
}

interface WarmthSurveyProps {
  oneOnOneId: string
  onSubmitted: () => void
  /**
   * Labels configurables desde `org_settings.warmth_questions`. Cada item lleva
   * la `key` snake_case del setting y el `label` que el RH definió. Si no se
   * pasa o llega vacío, se usan los labels canónicos.
   */
  questions?: Array<{ key: string; label: string }>
}

export function WarmthSurvey({ oneOnOneId, onSubmitted, questions }: WarmthSurveyProps) {
  const resolvedLabels: Record<QuestionKey, string> = { ...DEFAULT_LABELS }
  for (const q of questions ?? []) {
    const mapped = SETTING_KEY_TO_QUESTION_KEY[q.key]
    if (mapped && q.label.trim()) resolvedLabels[mapped] = q.label
  }
  const QUESTIONS = QUESTION_KEYS.map((k) => ({ key: k, label: resolvedLabels[k] }))
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
