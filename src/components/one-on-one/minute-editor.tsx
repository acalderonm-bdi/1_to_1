'use client'

import { useEffect, useState, useTransition } from 'react'
import { Save, Sparkles, Check } from 'lucide-react'
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

  const dirty = content !== initialContent

  useEffect(() => {
    if (savedMsg) {
      const t = setTimeout(() => setSavedMsg(''), 2200)
      return () => clearTimeout(t)
    }
  }, [savedMsg])

  async function handleSave() {
    startSave(async () => {
      const result = await saveMinute({ oneOnOneId, rawContent: content })
      if (result.success) {
        setSavedMsg('Guardado')
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

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  return (
    <div>
      <textarea
        className="ui-textarea"
        placeholder="Escribe lo que pasó en la reunión. Compromisos, decisiones, temas pendientes…"
        value={content}
        onChange={e => setContent(e.target.value)}
        style={{ minHeight: 200, fontSize: 13.5, lineHeight: 1.65, fontFamily: 'var(--font-sans)' }}
      />
      {aiError && (
        <p style={{ fontSize: 12, color: 'var(--amber-700)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={12} /> {aiError}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span>{wordCount} {wordCount === 1 ? 'palabra' : 'palabras'} · {content.length} car.</span>
          {savedMsg && (
            <span className="anim-fade-in" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--green-700)', fontWeight: 500 }}>
              <Check size={12} /> {savedMsg}
            </span>
          )}
          {dirty && !savedMsg && !isSaving && (
            <span style={{ color: 'var(--amber-700)' }}>· sin guardar</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="ui-btn ui-btn--ghost ui-btn--sm"
            onClick={handleSave}
            disabled={isSaving || !dirty}
          >
            {isSaving ? <span className="spinner" /> : <Save size={13} />}
            <span>{isSaving ? 'Guardando…' : 'Guardar'}</span>
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--accent ui-btn--sm"
            onClick={handleExtract}
            disabled={isExtracting || !content.trim()}
          >
            {isExtracting ? <span className="spinner" /> : <Sparkles size={13} />}
            <span>{isExtracting ? 'Procesando…' : (hasExtracted ? 'Reextraer acuerdos' : 'Extraer acuerdos con IA')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
