'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, Save, Loader2 } from 'lucide-react'
import { saveMinute } from '@/lib/actions/minutes'
import type { ExtractedAgreement } from '@/types/domain'

interface MinuteEditorProps {
  oneOnOneId: string
  initialContent: string
  participants: {
    leader: { id: string; name: string; email: string }
    collaborator: { id: string; name: string; email: string }
  }
  onAgreementsExtracted: (agreements: ExtractedAgreement[]) => void
}

export function MinuteEditor({ oneOnOneId, initialContent, participants, onAgreementsExtracted }: MinuteEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [isSaving, startSave] = useTransition()
  const [isExtracting, setIsExtracting] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [aiError, setAiError] = useState('')

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
      if (data.error && !data.agreements.length) {
        setAiError(data.error)
      } else {
        onAgreementsExtracted(data.agreements)
      }
    } catch {
      setAiError('IA no disponible — agrega los acuerdos manualmente')
    } finally {
      setIsExtracting(false)
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="Escribe aquí los puntos discutidos, decisiones y compromisos de la reunión..."
        value={content}
        onChange={e => setContent(e.target.value)}
        className="min-h-[160px] text-sm"
      />
      {aiError && <p className="text-xs text-amber-600">{aiError}</p>}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
          {savedMsg || 'Guardar'}
        </Button>
        <Button size="sm" onClick={handleExtract} disabled={isExtracting || !content.trim()}>
          {isExtracting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
          Extraer acuerdos con IA
        </Button>
      </div>
    </div>
  )
}
