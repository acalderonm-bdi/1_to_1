'use client'

import { useState, useTransition } from 'react'
import { Plus, Calendar, Loader2, ChevronDown } from 'lucide-react'
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

  async function handleAdd(desc: string, responsibleId: string, dueDate: string | null = null, aiGenerated = false, confidence?: number) {
    const result = await createAgreement({
      oneOnOneId,
      description: desc,
      responsibleId,
      dueDate,
      aiGenerated,
      aiConfidence: confidence ?? null,
    })
    if (result.success && result.data) {
      setAgreements(prev => [...prev, result.data as Agreement])
    }
  }

  async function handleAddManual() {
    if (!newDesc.trim()) return
    startTransition(async () => {
      await handleAdd(newDesc.trim(), newResponsible, newDueDate || null)
      setNewDesc(''); setNewDueDate(''); setShowAdd(false)
    })
  }

  async function handleAcceptSuggestion(s: ExtractedAgreement) {
    const responsibleId = s.responsible_email === participants.leader.email
      ? participants.leader.id
      : participants.collaborator.id
    await handleAdd(s.description, responsibleId, s.due_date, true, s.confidence)
  }

  async function handleStatusChange(agreementId: string, status: string) {
    await updateAgreementStatus({
      agreementId,
      status: status as 'pendiente' | 'cumplido' | 'parcial' | 'no_cumplido',
    })
    setAgreements(prev => prev.map(a => a.id === agreementId ? { ...a, status } : a))
    setOpenMenuId(null)
  }

  function responsibleInfo(id: string, idx: number) {
    const p = id === participants.leader.id ? participants.leader : participants.collaborator
    const initials = p.name.split(' ').map(s => s[0]).slice(0, 2).join('')
    return { name: p.name, initials, color: AV_BY_INDEX[idx % AV_BY_INDEX.length] }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {extractedSuggestions && extractedSuggestions.length > 0 && (
        <div className="ai-card" style={{ padding: 14, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="ai-chip">IA</span>
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>
              Extraje {extractedSuggestions.length} acuerdo{extractedSuggestions.length !== 1 ? 's' : ''} — confirma cuáles agregar
            </span>
          </div>
          {extractedSuggestions.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 10, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--ai-border)' }}>
              <p style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>{s.description}</p>
              <button
                type="button"
                className="ui-btn ui-btn--accent ui-btn--sm"
                onClick={() => { handleAcceptSuggestion(s); onSuggestionsUsed?.() }}
              >
                <Plus size={12} /> Agregar
              </button>
            </div>
          ))}
        </div>
      )}

      {agreements.length === 0 && !extractedSuggestions?.length && (
        <div style={{ padding: 32, textAlign: 'center', border: '1px dashed var(--border-strong)', borderRadius: 8, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 13.5, marginBottom: 6 }}>✦ Aún no hay acuerdos</div>
          <div style={{ fontSize: 12.5, maxWidth: 380, margin: '0 auto' }}>
            Cuando termines la minuta, presiona <strong>Extraer acuerdos con IA</strong> o agrégalos manualmente.
          </div>
        </div>
      )}

      {agreements.map((a, idx) => {
        const r = responsibleInfo(a.responsible_id, idx)
        return (
          <div key={a.id} className="agreement">
            <div className="agreement__head">
              <p className="agreement__desc">{a.description}</p>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={`status-select status-select--${a.status}`}
                  onClick={() => setOpenMenuId(openMenuId === a.id ? null : a.id)}
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
                          background: 'transparent', border: 'none', padding: '7px 10px',
                          borderRadius: 5, fontSize: 12.5, cursor: 'pointer',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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
              {a.due_date && <span className="agreement__meta-item"><Calendar size={13} /> {a.due_date}</span>}
              {a.ai_generated && <span className="ai-chip">IA</span>}
            </div>
          </div>
        )
      })}

      {!showAdd ? (
        <button
          type="button"
          className="ui-btn ui-btn--ghost"
          onClick={() => setShowAdd(true)}
          style={{ alignSelf: 'flex-start' }}
        >
          <Plus size={14} /> Agregar acuerdo manualmente
        </button>
      ) : (
        <div className="ui-card" style={{ padding: 14, display: 'grid', gap: 10 }}>
          <input
            className="ui-input"
            placeholder="Descripción del acuerdo…"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select className="ui-select" value={newResponsible} onChange={e => setNewResponsible(e.target.value)}>
              <option value={participants.leader.id}>{participants.leader.name}</option>
              <option value={participants.collaborator.id}>{participants.collaborator.name}</option>
            </select>
            <input className="ui-input" type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => { setShowAdd(false); setNewDesc(''); setNewDueDate('') }}>
              Cancelar
            </button>
            <button type="button" className="ui-btn ui-btn--accent ui-btn--sm" onClick={handleAddManual} disabled={isPending || !newDesc.trim()}>
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
