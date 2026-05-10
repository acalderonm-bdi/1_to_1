'use client'

import { useState, useTransition } from 'react'
import { Save, Loader2, Sparkles } from 'lucide-react'
import { saveMinute } from '@/lib/actions/minutes'
import type { ExtractedAgreement } from '@/types/domain'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface MinuteEditorProps {
  oneOnOneId: string
  initialContent: string
  participants: {
    leader: { id: string; name: string; email: string }
    collaborator: { id: string; name: string; email: string }
  }
  onAgreementsExtracted: (agreements: ExtractedAgreement[]) => void
}

export function MinuteEditor({ oneOnOneId, initialContent, onAgreementsExtracted }: MinuteEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [isSaving, startSave] = useTransition()
  const [isExtracting, setIsExtracting] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [aiError, setAiError] = useState('')
  const [hasExtracted, setHasExtracted] = useState(false)

  async function handleSave() {
    startSave(async () => {
      const result = await saveMinute({ oneOnOneId, rawContent: content })
      if (result.success) {
        setSavedMsg('Guardado')
        setTimeout(() => setSavedMsg(''), 2000)
      }
    })
  }

  async function handleExtract() {
    if (!content.trim()) return
    setIsExtracting(true)
    setAiError('')
    try {
      const res = await fetch('/api/ai/extract-agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oneOnOneId, rawContent: content }),
      })
      const data = await res.json() as { agreements: ExtractedAgreement[]; error?: string }
      if (data.error && !data.agreements.length) setAiError(data.error)
      else {
        onAgreementsExtracted(data.agreements)
        setHasExtracted(true)
      }
    } catch {
      setAiError('IA no disponible — agrega los acuerdos manualmente')
    } finally {
      setIsExtracting(false)
    }
  }

  return (
    <div>
      <Textarea
        placeholder="Escribe lo que pasó en la reunión. Compromisos, decisiones, temas pendientes…"
        value={content}
        onChange={e => setContent(e.target.value)}
        className="min-h-[180px] text-[13.5px] leading-relaxed"
      />
      {aiError && <p className="text-[12px] text-warning mt-1.5">{aiError}</p>}
      <div className="flex items-center justify-between mt-3">
        <div className="text-[11.5px] text-muted-foreground">
          {content.length} caracteres{savedMsg && ` · ${savedMsg}`}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Guardar
          </Button>
          <Button type="button" variant="brand" size="sm" onClick={handleExtract} disabled={isExtracting || !content.trim()}>
            {isExtracting ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {isExtracting ? 'Procesando…' : (hasExtracted ? 'Reextraer acuerdos' : 'Extraer acuerdos con IA')}
          </Button>
        </div>
      </div>
    </div>
  )
}
