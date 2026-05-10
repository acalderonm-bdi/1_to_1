'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Insight { id: string; type: string; content: unknown; created_at: string }
interface LeaderInsightPanelProps {
  collaboratorId: string
  collaboratorName: string
  insights: Insight[]
}

const CATEGORY_LABELS: Record<string, string> = {
  desempeño: 'Desempeño',
  desarrollo: 'Desarrollo',
  bienestar: 'Bienestar',
  seguimiento: 'Seguimiento',
  feedback: 'Feedback',
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
    <div className="grid gap-4 sticky top-20">
      <Card className="border-brand/30 bg-brand-muted/30">
        <CardContent className="px-5 py-4">
          <Badge variant="brand" className="mb-2"><Sparkles className="size-3" /> Asistente</Badge>
          <h3 className="text-base font-medium tracking-tight">
            Preguntas para {collaboratorName.split(' ')[0]}
          </h3>
          <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
            Sugerencias contextuales basadas en sus últimas 1:1s, acuerdos y temas recurrentes.
          </p>
          {questions.length === 0 && (
            <Button type="button" variant="brand" onClick={handleGenerate} disabled={isLoading} className="w-full mt-3.5">
              {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {isLoading ? 'Generando…' : 'Generar preguntas'}
            </Button>
          )}
          {error && <p className="mt-2.5 text-[12px] text-warning">{error}</p>}
        </CardContent>

        {questions.length > 0 && (
          <>
            <div className="border-t border-dashed border-brand/20 mx-5" />
            <div className="px-5 py-4 grid gap-2.5">
              {questions.map((q, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-md border bg-background hover:border-brand/40 transition-colors">
                  <div className="size-6 rounded-full bg-brand-muted text-brand border border-brand/30 flex items-center justify-center text-[11px] font-medium font-mono-numeric shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] leading-relaxed m-0">{q.question}</p>
                    {q.rationale && <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">{q.rationale}</p>}
                    <Badge variant="muted" className="mt-2 text-[10.5px]">
                      {CATEGORY_LABELS[q.category] ?? q.category}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4">
              <Button type="button" variant="ghost" size="sm" onClick={handleGenerate} className="w-full">
                <Sparkles className="size-3.5" /> Generar otras preguntas
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card>
        <CardContent className="px-5 py-4">
          <h4 className="text-[13px] font-medium mb-3">Contexto rápido</h4>
          <div className="grid gap-2.5 text-[12.5px]">
            <Row label="1:1s realizadas (3m)" value="5 / 6" />
            <Row label="Acuerdos cumplidos" value="89%" />
            <Row label="Última 1:1" value="hace 14 días" />
            <Row label="Cadencia" value="Quincenal" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <strong className="font-medium">{value}</strong>
    </div>
  )
}
