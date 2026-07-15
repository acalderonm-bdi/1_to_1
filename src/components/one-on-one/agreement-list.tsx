'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Plus, Calendar, Sparkles, Trash2, AlertTriangle } from 'lucide-react'
import { createAgreement, deleteAgreement } from '@/lib/actions/agreements'
import { checkAgreementQuality } from '@/lib/agreement-quality'
import type { ExtractedAgreement } from '@/types/domain'

interface Agreement {
  id: string; description: string; responsible_id: string;
  due_date: string | null; status: string; ai_generated: boolean
  // F4: marca acuerdos heredados de un líder anterior (vía view
  // open_agreements_by_collaborator). Opcional para no romper consumers.
  is_transferred?: boolean
  // F1: score de calidad IA — opcional, sólo se usa en algunas vistas.
  ai_quality_score?: number | null
}
interface AgreementListProps {
  oneOnOneId: string
  initialAgreements: Agreement[]
  currentUserId: string
  participants: {
    leader: { id: string; name: string; email: string }
    collaborator: { id: string; name: string; email: string }
  }
  extractedSuggestions?: ExtractedAgreement[]
  onSuggestionsUsed?: () => void
}

const AV_BY_INDEX = ['av-blue', 'av-violet', 'av-green', 'av-amber']

export function AgreementList({
  oneOnOneId, initialAgreements, participants, extractedSuggestions, onSuggestionsUsed,
}: AgreementListProps) {
  const [agreements, setAgreements] = useState<Agreement[]>(initialAgreements)
  const [newDesc, setNewDesc] = useState('')

  // Sincronizar con cambios externos (realtime: cuando el otro participante crea
  // acuerdos o la IA los extrae al guardar la minuta). Si tengo filas optimistic
  // pendientes (id empieza con temp-), no las clobbeo.
  useEffect(() => {
    setAgreements(prev => {
      const optimistic = prev.filter(a => a.id.startsWith('temp-'))
      return [...initialAgreements, ...optimistic]
    })
  }, [initialAgreements])
  const [newResponsible, setNewResponsible] = useState(participants.collaborator.id)
  const [newDueDate, setNewDueDate] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // F1: sugerencias y validación IA on-demand
  const [aiSuggestion, setAiSuggestion] = useState<{
    quality_score: number
    warnings: Array<{ code: string; message: string; suggestion?: string | null }>
    refined_description: string | null
  } | null>(null)
  const [validating, setValidating] = useState(false)

  // F1: contar acuerdos abiertos del responsable elegido para detectar
  // sobrecarga sin tener que ir al server en cada keystroke.
  const collaboratorOpenCount = useMemo(
    () =>
      agreements.filter(
        a =>
          a.responsible_id === newResponsible &&
          (a.status === 'pendiente' || a.status === 'parcial'),
      ).length,
    [agreements, newResponsible],
  )

  // F1: heurísticas SMART en vivo mientras el usuario escribe.
  // El componente es client-side y se re-evalúa por keystroke; usar
  // `getOrgSetting('collaborator_max_open_agreements')` requeriría un fetch async
  // en cada cambio, lo que rompería la experiencia. Mantenemos el default
  // sincrónico (7) acá — la persistencia server-side (createAgreement /
  // saveMinute) sí lee el valor configurado vía `checkAgreementQualityWithConfig`.
  const liveQuality = useMemo(
    () =>
      checkAgreementQuality({
        description: newDesc,
        responsibleId: newResponsible,
        dueDate: newDueDate || null,
        collaboratorOpenAgreementsCount: collaboratorOpenCount,
      }),
    [newDesc, newResponsible, newDueDate, collaboratorOpenCount],
  )

  function responsibleNameById(id: string): string {
    return id === participants.leader.id
      ? participants.leader.name
      : participants.collaborator.name
  }

  async function handleValidateWithAI() {
    if (!newDesc.trim() || newDesc.trim().length < 5) return
    setValidating(true)
    try {
      const res = await fetch('/api/ai/agreement-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: newDesc,
          responsibleName: responsibleNameById(newResponsible),
          dueDate: newDueDate || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiSuggestion(data)
      }
    } finally {
      setValidating(false)
    }
  }

  async function handleAdd(desc: string, responsibleId: string, dueDate: string | null = null, aiGenerated = false, confidence?: number) {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const optimistic: Agreement = {
      id: tempId,
      description: desc,
      responsible_id: responsibleId,
      due_date: dueDate,
      status: 'pendiente',
      ai_generated: aiGenerated,
    }
    setAgreements(prev => [...prev, optimistic])
    setErrorMsg(null)
    const result = await createAgreement({
      oneOnOneId,
      description: desc,
      responsibleId,
      dueDate,
      aiGenerated,
      aiConfidence: confidence ?? null,
    })
    if (result.success && result.data) {
      setAgreements(prev => prev.map(a => a.id === tempId ? (result.data as Agreement) : a))
    } else {
      setAgreements(prev => prev.filter(a => a.id !== tempId))
      setErrorMsg(result.error ?? 'No se pudo guardar el acuerdo')
    }
  }

  async function handleAddManual() {
    if (!newDesc.trim()) return
    const desc = newDesc.trim()
    const responsibleId = newResponsible
    const dueDate = newDueDate || null
    setNewDesc(''); setNewDueDate(''); setShowAdd(false); setAiSuggestion(null)
    startTransition(() => { void handleAdd(desc, responsibleId, dueDate) })
  }

  async function handleAcceptSuggestion(s: ExtractedAgreement) {
    const responsibleId = s.responsible_email === participants.leader.email
      ? participants.leader.id
      : participants.collaborator.id
    await handleAdd(s.description, responsibleId, s.due_date, true, s.confidence)
  }

  async function handleDelete(agreementId: string) {
    const target = agreements.find(a => a.id === agreementId)
    if (!target) return
    if (!confirm(`¿Eliminar este acuerdo?\n\n"${target.description.slice(0, 120)}"\n\nSi alguien ya había aprobado, su aprobación se invalidará y deberá votar de nuevo.`)) return

    // Optimistic
    setAgreements(prev => prev.filter(a => a.id !== agreementId))
    setErrorMsg(null)
    const result = await deleteAgreement({ agreementId })
    if (!result.success) {
      // Rollback
      setAgreements(prev => [...prev, target])
      setErrorMsg(result.error ?? 'No se pudo eliminar el acuerdo')
    }
  }

  function responsibleInfo(id: string, idx: number) {
    const p = id === participants.leader.id ? participants.leader : participants.collaborator
    const initials = p.name.split(' ').map(s => s[0]).slice(0, 2).join('')
    return { name: p.name, initials, color: AV_BY_INDEX[idx % AV_BY_INDEX.length] }
  }

  function formatDueDate(iso: string) {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    // due_date es fecha-only (columna `date`); se formatea en UTC para que el
    // día calendario sea estable server (UTC) y cliente (tz local) — evita el
    // off-by-one que mostraba el día anterior en el navegador.
    return d.toLocaleDateString('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'short' })
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {extractedSuggestions && extractedSuggestions.length > 0 && (
        <div className="ai-card anim-fade-in" style={{ padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="ai-chip">IA</span>
            <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.005em' }}>
              Extraje {extractedSuggestions.length} acuerdo{extractedSuggestions.length !== 1 ? 's' : ''} —
              <span className="u-muted"> confirma cuáles agregar</span>
            </span>
          </div>
          <div className="anim-stagger" style={{ display: 'grid', gap: 8 }}>
            {extractedSuggestions.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 'var(--r-md)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--ai-border)',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <Sparkles size={14} style={{ color: 'hsl(var(--primary))', flexShrink: 0, marginTop: 3 }} />
                <p style={{ flex: 1, fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{s.description}</p>
                <button
                  type="button"
                  className="ui-btn ui-btn--accent ui-btn--sm"
                  onClick={() => { void handleAcceptSuggestion(s); onSuggestionsUsed?.() }}
                >
                  <Plus size={12} /> <span>Agregar</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {agreements.length === 0 && !extractedSuggestions?.length && (
        <div
          style={{
            padding: '28px 20px',
            textAlign: 'center',
            border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--r-md)',
            color: 'var(--text-muted)',
            background: 'var(--bg-subtle)',
          }}
        >
          <Sparkles size={22} style={{ color: 'hsl(var(--primary))', opacity: 0.7, marginBottom: 8 }} />
          <div style={{ fontSize: 14, marginBottom: 6, fontWeight: 600, color: 'var(--text-c)', letterSpacing: '-0.008em' }}>
            Aún no hay acuerdos
          </div>
          <div style={{ fontSize: 12.5, maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
            Cuando termines la minuta, presiona <strong>Extraer acuerdos con IA</strong> o
            agrégalos manualmente.
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="ui-field-error" role="alert" style={{ padding: '8px 12px', background: 'hsl(var(--destructive) / 0.1)', border: '1px solid hsl(var(--destructive) / 0.3)', borderRadius: 'var(--r-sm)' }}>
          {errorMsg}
        </div>
      )}

      {agreements.map((a, idx) => {
        const r = responsibleInfo(a.responsible_id, idx)
        const isOptimistic = a.id.startsWith('temp-')
        return (
          <div key={a.id} className="agreement anim-fade-in" style={{ opacity: isOptimistic ? 0.7 : 1 }}>
            <div className="agreement__head" style={{ alignItems: 'center' }}>
              <p className="agreement__desc">{a.description}</p>
              {/* En el detalle de la 1:1 no mostramos estado — todos los acuerdos
                  nacen 'pendiente'. El seguimiento se hace en "Mis acuerdos". */}
              <button
                type="button"
                onClick={() => handleDelete(a.id)}
                disabled={isOptimistic}
                title="Eliminar acuerdo"
                aria-label="Eliminar acuerdo"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: 'transparent',
                  border: '1px solid var(--border-c)',
                  borderRadius: 'var(--r-md)',
                  cursor: isOptimistic ? 'not-allowed' : 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  flexShrink: 0,
                  transition: 'all 0.15s var(--ease-out)',
                }}
                onMouseEnter={e => {
                  if (!isOptimistic) {
                    e.currentTarget.style.background = 'hsl(var(--destructive) / 0.1)'
                    e.currentTarget.style.color = 'hsl(var(--destructive))'
                    e.currentTarget.style.borderColor = 'hsl(var(--destructive) / 0.3)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-muted)'
                  e.currentTarget.style.borderColor = 'var(--border-c)'
                }}
              >
                <Trash2 size={14} />
                <span>Eliminar</span>
              </button>
            </div>
            <div className="agreement__meta">
              <span className="agreement__meta-item">
                <span className={`avatar avatar--sm ${r.color}`}>{r.initials}</span>
                <span style={{ marginLeft: 2 }}>{r.name}</span>
              </span>
              {a.due_date && (
                <span className="agreement__meta-item">
                  <Calendar size={13} /> {formatDueDate(a.due_date)}
                </span>
              )}
              {a.ai_generated && <span className="ai-chip">IA</span>}
              {a.is_transferred && (
                <span
                  className="ui-badge"
                  style={{
                    background: 'hsl(var(--warning) / 0.15)',
                    color: 'hsl(var(--warning-foreground, 0 0% 10%))',
                    fontSize: '0.7rem',
                    padding: '0.125rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontWeight: 600,
                  }}
                >
                  Transferido del líder anterior
                </span>
              )}
              {isOptimistic && (
                <span className="agreement__meta-item u-muted">
                  <span className="spinner" style={{ width: 11, height: 11 }} />
                  Guardando…
                </span>
              )}
            </div>
          </div>
        )
      })}

      {!showAdd ? (
        <button
          type="button"
          className="ui-btn ui-btn--ghost ui-btn--sm"
          onClick={() => setShowAdd(true)}
          style={{ alignSelf: 'flex-start' }}
        >
          <Plus size={13} /> <span>Agregar acuerdo manualmente</span>
        </button>
      ) : (
        <div className="ui-card anim-fade-in" style={{ padding: 14, display: 'grid', gap: 10 }}>
          <input
            className="ui-input"
            placeholder="Descripción del acuerdo…"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select className="ui-select" value={newResponsible} onChange={e => setNewResponsible(e.target.value)}>
              <option value={participants.leader.id}>{participants.leader.name}</option>
              <option value={participants.collaborator.id}>{participants.collaborator.name}</option>
            </select>
            <input className="ui-input" type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} />
          </div>

          {/* F1: warnings inline SMART en vivo */}
          {newDesc.trim() && liveQuality.warnings.length > 0 && (
            <div style={{ display: 'grid', gap: 4 }}>
              {liveQuality.warnings.map(w => (
                <div
                  key={w.code}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    fontSize: 12,
                    color: 'hsl(var(--warning))',
                    padding: '2px 0',
                  }}
                >
                  <AlertTriangle
                    size={12}
                    style={{ marginTop: 2, flexShrink: 0, color: 'hsl(var(--warning))' }}
                  />
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* F1: sugerencia IA on-demand */}
          {aiSuggestion?.refined_description && (
            <div
              style={{
                padding: 12,
                border: '1px solid hsl(var(--primary) / 0.3)',
                background: 'hsl(var(--primary) / 0.05)',
                borderRadius: 'var(--r-md)',
              }}
            >
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                Sugerencia de IA (score {aiSuggestion.quality_score.toFixed(1)}/5):
              </p>
              <p style={{ fontSize: 13, margin: 0 }}>{aiSuggestion.refined_description}</p>
              <button
                type="button"
                className="ui-btn ui-btn--ghost ui-btn--sm"
                style={{ marginTop: 8, fontSize: 12 }}
                onClick={() => {
                  if (aiSuggestion.refined_description) {
                    setNewDesc(aiSuggestion.refined_description)
                  }
                  setAiSuggestion(null)
                }}
              >
                <Sparkles size={12} />
                <span>Aplicar sugerencia</span>
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--sm"
              onClick={() => void handleValidateWithAI()}
              disabled={validating || !newDesc.trim() || newDesc.trim().length < 5}
            >
              {validating ? <span className="spinner" /> : <Sparkles size={13} />}
              <span>{validating ? 'Validando…' : 'Validar con IA'}</span>
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="ui-btn ui-btn--ghost ui-btn--sm"
                onClick={() => {
                  setShowAdd(false)
                  setNewDesc('')
                  setNewDueDate('')
                  setAiSuggestion(null)
                }}
              >
                <span>Cancelar</span>
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--accent ui-btn--sm"
                onClick={handleAddManual}
                disabled={isPending || !newDesc.trim()}
              >
                {isPending ? <span className="spinner" /> : <Plus size={13} />}
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
