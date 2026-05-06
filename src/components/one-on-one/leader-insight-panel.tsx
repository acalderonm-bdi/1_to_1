'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

interface Insight {
  id: string
  type: string
  content: unknown
  created_at: string
}

interface GeneratedQuestion {
  question: string
  rationale: string
  category: string
}

interface LeaderInsightPanelProps {
  collaboratorId: string
  collaboratorName: string
  insights: Insight[]
}

export function LeaderInsightPanel({
  collaboratorId,
  collaboratorName,
  insights,
}: LeaderInsightPanelProps) {
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerateQuestions() {
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/suggest-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collaboratorId }),
      })
      const data = (await res.json()) as {
        questions: GeneratedQuestion[]
        error?: string
      }
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

  const CATEGORY_LABELS: Record<string, string> = {
    desempeño: 'Desempeño',
    desarrollo: 'Desarrollo',
    bienestar: 'Bienestar',
    seguimiento: 'Seguimiento',
    feedback: 'Feedback',
  }

  const hasInsights = insights.length > 0 || questions.length > 0

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-blue-900">
            <Sparkles className="h-4 w-4" />
            Sugerencias de IA para {collaboratorName}
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasInsights && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-blue-600 hover:text-blue-800"
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateQuestions}
              disabled={isLoading}
              className="border-blue-300 text-blue-700 hover:bg-blue-100 h-7 text-xs"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1" />
              )}
              Generar preguntas
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          {error && <p className="text-xs text-amber-600 mb-2">{error}</p>}
          {questions.length > 0 && (
            <ul className="space-y-3">
              {questions.map((q, i) => (
                <li key={i} className="space-y-0.5">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 text-sm shrink-0">
                      {i + 1}.
                    </span>
                    <p className="text-sm font-medium text-slate-800">
                      {q.question}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 pl-4">{q.rationale}</p>
                  <span className="text-xs text-blue-600 pl-4">
                    {CATEGORY_LABELS[q.category] ?? q.category}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  )
}
