'use client'

import { useState, useTransition } from 'react'
import { Save, Loader2 } from 'lucide-react'
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
      if (data.error && !data.agreements.length) {
        setAiError(data.error)
      } else {
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
      <textarea
        className="ui-textarea"
        placeholder="Escribe lo que pasó en la reunión. Compromisos, decisiones, temas pendientes…"
        value={content}
        onChange={e => setContent(e.target.value)}
        style={{ minHeight: 180, fontSize: 13.5, lineHeight: 1.6 }}
      />
      {aiError && <p style={{ fontSize: 12, color: 'var(--amber-700)', marginTop: 6 }}>{aiError}</p>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          {content.length} caracteres{savedMsg && ` · ${savedMsg}`}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="ui-btn ui-btn--ghost ui-btn--sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Guardar
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--accent ui-btn--sm"
            onClick={handleExtract}
            disabled={isExtracting || !content.trim()}
          >
            {isExtracting ? <span className="spinner" /> : <span>✦</span>}
            {isExtracting ? 'Procesando…' : (hasExtracted ? 'Reextraer acuerdos' : 'Extraer acuerdos con IA')}
          </button>
        </div>
      </div>
    </div>
  )
}
