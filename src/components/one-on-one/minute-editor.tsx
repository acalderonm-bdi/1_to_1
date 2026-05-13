'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Sparkles, Check, AlertCircle, Radio } from 'lucide-react'
import { saveMinute } from '@/lib/actions/minutes'
import type { ExtractedAgreement } from '@/types/domain'

interface MinuteEditorProps {
  oneOnOneId: string
  initialContent: string
  participants: {
    leader: { id: string; name: string; email: string }
    collaborator: { id: string; name: string; email: string }
  }
  onAgreementsExtracted?: (agreements: ExtractedAgreement[]) => void
}

export function MinuteEditor({ oneOnOneId, initialContent }: MinuteEditorProps) {
  const router = useRouter()
  const [content, setContent] = useState(initialContent)
  const [isPending, startTransition] = useTransition()
  const [savedMsg, setSavedMsg] = useState('')
  const [aiStatus, setAiStatus] = useState<{ count: number; error?: string } | null>(null)
  const [externalUpdate, setExternalUpdate] = useState<string | null>(null)
  const lastBaselineRef = useRef(initialContent)

  const dirty = content !== lastBaselineRef.current

  // Cuando llega un cambio del otro participante (initialContent cambia tras router.refresh),
  // si NO estoy editando, sincronizo el contenido en silencio. Si SÍ estoy editando,
  // guardo la versión nueva para mostrar un banner "hay cambios externos".
  useEffect(() => {
    if (initialContent === lastBaselineRef.current) return
    if (!dirty) {
      setContent(initialContent)
      lastBaselineRef.current = initialContent
      setExternalUpdate(null)
    } else {
      setExternalUpdate(initialContent)
    }
  }, [initialContent, dirty])

  useEffect(() => {
    if (savedMsg) {
      const t = setTimeout(() => setSavedMsg(''), 3000)
      return () => clearTimeout(t)
    }
  }, [savedMsg])

  function acceptExternal() {
    if (externalUpdate === null) return
    setContent(externalUpdate)
    lastBaselineRef.current = externalUpdate
    setExternalUpdate(null)
  }

  async function handleSave() {
    startTransition(async () => {
      setAiStatus(null)
      const result = await saveMinute({ oneOnOneId, rawContent: content })
      if (result.success) {
        setSavedMsg('Guardado')
        setAiStatus({ count: result.data?.extractedCount ?? 0, error: result.data?.aiError })
        lastBaselineRef.current = content  // mi guardado es la nueva baseline
        setExternalUpdate(null)
        router.refresh()
      }
    })
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  return (
    <div>
      {externalUpdate !== null && (
        <div
          className="anim-fade-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            marginBottom: 10,
            background: 'hsl(var(--warning) / 0.1)',
            border: '1px solid hsl(var(--warning) / 0.3)',
            borderRadius: 'var(--r-md)',
            fontSize: 12.5,
          }}
        >
          <Radio size={14} style={{ color: 'hsl(var(--warning))' }} />
          <span style={{ flex: 1, color: 'hsl(var(--warning))' }}>
            La otra persona guardó cambios. Tienes ediciones sin guardar.
          </span>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={acceptExternal}>
            Ver versión nueva
          </button>
        </div>
      )}

      <textarea
        className="ui-textarea"
        placeholder="Escribe lo que pasó en la reunión. Compromisos, decisiones, temas pendientes…"
        value={content}
        onChange={e => setContent(e.target.value)}
        style={{ minHeight: 200, fontSize: 13.5, lineHeight: 1.65, fontFamily: 'var(--font-sans)' }}
      />

      <p
        style={{
          fontSize: 11.5,
          color: 'var(--text-muted)',
          marginTop: 8,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Sparkles size={12} style={{ color: 'hsl(var(--primary))' }} />
        Al guardar, la IA extraerá los acuerdos automáticamente · sincronizado en vivo con el otro participante.
      </p>

      {aiStatus && aiStatus.count > 0 && (
        <p
          className="anim-fade-in"
          style={{
            fontSize: 12,
            color: 'hsl(var(--success))',
            marginTop: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 500,
          }}
        >
          <Check size={12} /> Se extrajeron {aiStatus.count} {aiStatus.count === 1 ? 'acuerdo' : 'acuerdos'}
        </p>
      )}

      {aiStatus && aiStatus.count === 0 && !aiStatus.error && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          La IA no encontró acuerdos claros en esta minuta.
        </p>
      )}

      {aiStatus?.error && (
        <p style={{ fontSize: 12, color: 'hsl(var(--warning))', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={12} /> {aiStatus.error}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span>{wordCount} {wordCount === 1 ? 'palabra' : 'palabras'} · {content.length} car.</span>
          {savedMsg && (
            <span className="anim-fade-in" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'hsl(var(--success))', fontWeight: 500 }}>
              <Check size={12} /> {savedMsg}
            </span>
          )}
          {dirty && !savedMsg && !isPending && (
            <span style={{ color: 'hsl(var(--warning))' }}>· sin guardar</span>
          )}
        </div>
        <button
          type="button"
          className="ui-btn ui-btn--accent ui-btn--sm"
          onClick={handleSave}
          disabled={isPending || !content.trim()}
        >
          {isPending ? <span className="spinner" /> : <Save size={13} />}
          <span>{isPending ? 'Guardando y procesando con IA…' : 'Guardar minuta'}</span>
        </button>
      </div>
    </div>
  )
}
