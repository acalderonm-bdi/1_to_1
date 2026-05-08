'use client'

import { useState, useTransition } from 'react'
import { Plus, Calendar, ChevronDown, Sparkles } from 'lucide-react'
import { createAgreement, updateAgreementStatus } from '@/lib/actions/agreements'
import { AGREEMENT_LABELS } from '@/lib/constants'
import type { ExtractedAgreement } from '@/types/domain'

interface Agreement {
  id: string; description: string; responsible_id: string;
  due_date: string | null; status: string; ai_generated: boolean
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
  const [newResponsible, setNewResponsible] = useState(participants.collaborator.id)
  const [newDueDate, setNewDueDate] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

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
    setNewDesc(''); setNewDueDate(''); setShowAdd(false)
    startTransition(() => { void handleAdd(desc, responsibleId, dueDate) })
  }

  async function handleAcceptSuggestion(s: ExtractedAgreement) {
    const responsibleId = s.responsible_email === participants.leader.email
      ? participants.leader.id
      : participants.collaborator.id
    await handleAdd(s.description, responsibleId, s.due_date, true, s.confidence)
  }

  async function handleStatusChange(agreementId: string, status: string) {
    setOpenMenuId(null)
    const previous = agreements.find(a => a.id === agreementId)
    if (!previous) return
    setAgreements(prev => prev.map(a => a.id === agreementId ? { ...a, status } : a))
    setErrorMsg(null)
    const result = await updateAgreementStatus({
      agreementId,
      status: status as 'pendiente' | 'cumplido' | 'parcial' | 'no_cumplido',
    })
    if (!result.success) {
      setAgreements(prev => prev.map(a => a.id === agreementId ? { ...a, status: previous.status } : a))
      setErrorMsg(result.error ?? 'No se pudo cambiar el estado')
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
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
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
                <Sparkles size={14} style={{ color: 'var(--accent-500)', flexShrink: 0, marginTop: 3 }} />
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
          <Sparkles size={22} style={{ color: 'var(--accent-500)', opacity: 0.7, marginBottom: 8 }} />
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
        <div className="ui-field-error" role="alert" style={{ padding: '8px 12px', background: 'var(--red-50)', border: '1px solid var(--red-200)', borderRadius: 'var(--r-sm)' }}>
          {errorMsg}
        </div>
      )}

      {agreements.map((a, idx) => {
        const r = responsibleInfo(a.responsible_id, idx)
        const isOptimistic = a.id.startsWith('temp-')
        return (
          <div key={a.id} className="agreement anim-fade-in" style={{ opacity: isOptimistic ? 0.7 : 1 }}>
            <div className="agreement__head">
              <p className="agreement__desc">{a.description}</p>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={`status-select status-select--${a.status}`}
                  onClick={() => setOpenMenuId(openMenuId === a.id ? null : a.id)}
                  disabled={isOptimistic}
                >
                  {AGREEMENT_LABELS[a.status]}
                  <ChevronDown size={11} />
                </button>
                {openMenuId === a.id && (
                  <div className="popover" style={{ top: 'calc(100% + 4px)', right: 0, padding: 4, minWidth: 160 }}>
                    {Object.entries(AGREEMENT_LABELS).map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleStatusChange(a.id, k)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          background: a.status === k ? 'var(--bg-subtle)' : 'transparent',
                          border: 'none', padding: '7px 10px',
                          borderRadius: 5, fontSize: 12.5, cursor: 'pointer',
                          color: 'var(--text-c)',
                          fontFamily: 'inherit',
                          fontWeight: a.status === k ? 600 : 400,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                        onMouseLeave={e => e.currentTarget.style.background = a.status === k ? 'var(--bg-subtle)' : 'transparent'}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--sm"
              onClick={() => { setShowAdd(false); setNewDesc(''); setNewDueDate('') }}
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
      )}
    </div>
  )
}
