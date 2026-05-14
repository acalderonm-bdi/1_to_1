'use client'

import { useState, useTransition } from 'react'
import { useToast } from '@/hooks/use-toast'
import { saveOrgSetting } from '@/lib/actions/org-settings'
import { ParamsSection } from './params-section'

type WarmthQuestion = { key: string; label: string }

interface WarmthQuestionsEditorProps {
  initialRequired: boolean
  initialQuestions: WarmthQuestion[]
}

export function WarmthQuestionsEditor({
  initialRequired,
  initialQuestions,
}: WarmthQuestionsEditorProps) {
  const [required, setRequired] = useState(initialRequired)
  const [questions, setQuestions] = useState<WarmthQuestion[]>(initialQuestions)
  const [savedRequired, setSavedRequired] = useState(initialRequired)
  const [savedQuestions, setSavedQuestions] = useState<WarmthQuestion[]>(initialQuestions)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const dirty =
    required !== savedRequired ||
    JSON.stringify(questions) !== JSON.stringify(savedQuestions)

  function updateLabel(index: number, value: string) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, label: value } : q)))
  }

  function onSave() {
    startTransition(async () => {
      const tasks: Array<Promise<{ success: boolean; error?: string }>> = []
      if (required !== savedRequired) {
        tasks.push(saveOrgSetting('warmth_survey_required', required))
      }
      if (JSON.stringify(questions) !== JSON.stringify(savedQuestions)) {
        tasks.push(saveOrgSetting('warmth_questions', questions))
      }
      const results = await Promise.all(tasks)
      const failed = results.find((r) => !r.success)
      if (failed) {
        toast({
          title: 'No se pudo guardar',
          description: failed.error,
          variant: 'destructive',
        })
        return
      }
      setSavedRequired(required)
      setSavedQuestions(questions)
      toast({ title: 'Encuesta de calidez actualizada' })
    })
  }

  return (
    <ParamsSection
      title="Encuesta de calidez"
      desc="Preguntas que el colaborador responde al cerrar una sesión."
      dirty={dirty}
      isPending={isPending}
      onSave={onSave}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            fontSize: 13.5,
          }}
        >
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />
          <span>Encuesta obligatoria al cerrar la sesión</span>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {questions.map((q, i) => (
            <div key={q.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="ui-label" htmlFor={`q-${q.key}`}>
                Pregunta {i + 1}
              </label>
              <input
                id={`q-${q.key}`}
                type="text"
                className="ui-input"
                maxLength={200}
                value={q.label}
                onChange={(e) => updateLabel(i, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    </ParamsSection>
  )
}
