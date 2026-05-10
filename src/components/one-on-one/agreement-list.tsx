'use client'

import { useState, useTransition } from 'react'
import { Plus, Calendar, Loader2, ChevronDown, Sparkles } from 'lucide-react'
import { createAgreement, updateAgreementStatus } from '@/lib/actions/agreements'
import { AGREEMENT_LABELS } from '@/lib/constants'
import type { ExtractedAgreement } from '@/types/domain'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InitialsAvatar } from '@/components/shared/initials-avatar'
import { cn } from '@/lib/utils/cn'

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

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'brand' | 'destructive'> = {
  pendiente: 'warning',
  cumplido: 'success',
  parcial: 'brand',
  no_cumplido: 'destructive',
}

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

  function responsibleName(id: string) {
    return id === participants.leader.id ? participants.leader.name : participants.collaborator.name
  }

  return (
    <div className="grid gap-2.5">
      {extractedSuggestions && extractedSuggestions.length > 0 && (
        <Card className="p-4 grid gap-2.5 border-brand/40 bg-brand-muted/40 anim-fade-in">
          <div className="flex items-center gap-2">
            <Badge variant="brand" className="text-[10.5px]"><Sparkles className="size-3" /> IA</Badge>
            <span className="text-[12.5px] font-medium">
              Extraje {extractedSuggestions.length} acuerdo{extractedSuggestions.length !== 1 ? 's' : ''} — confirma cuáles agregar
            </span>
          </div>
          {extractedSuggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5 p-3 rounded-md border bg-background">
              <p className="flex-1 text-[13.5px] leading-relaxed m-0">{s.description}</p>
              <Button
                type="button" size="sm" variant="brand"
                onClick={() => { handleAcceptSuggestion(s); onSuggestionsUsed?.() }}
              >
                <Plus className="size-3" /> Agregar
              </Button>
            </div>
          ))}
        </Card>
      )}

      {agreements.length === 0 && !extractedSuggestions?.length && (
        <div className="p-8 text-center border border-dashed rounded-md text-muted-foreground bg-secondary/30">
          <Sparkles className="mx-auto size-5 mb-2 text-brand/60" />
          <div className="text-[13.5px] mb-1.5 font-medium text-foreground">Aún no hay acuerdos</div>
          <div className="text-[12.5px] max-w-md mx-auto leading-relaxed">
            Cuando termines la minuta, presiona <strong>Extraer acuerdos con IA</strong> o agrégalos manualmente.
          </div>
        </div>
      )}

      {agreements.map(a => (
        <Card key={a.id} className="px-4 py-3 anim-fade-in">
          <div className="flex items-start gap-3">
            <p className="flex-1 text-[13.5px] leading-relaxed m-0">{a.description}</p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenuId(openMenuId === a.id ? null : a.id)}
                className="inline-flex items-center gap-1"
              >
                <Badge variant={STATUS_VARIANT[a.status] ?? 'muted'} className="cursor-pointer">
                  {AGREEMENT_LABELS[a.status]} <ChevronDown className="size-3 opacity-60" />
                </Badge>
              </button>
              {openMenuId === a.id && (
                <div
                  className="absolute top-full right-0 mt-1 min-w-[160px] rounded-md border bg-popover py-1 z-20 anim-scale-in origin-top-right"
                  style={{ boxShadow: 'var(--shadow-popover)' }}
                >
                  {Object.entries(AGREEMENT_LABELS).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleStatusChange(a.id, k)}
                      className="block w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-secondary transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-[12px] text-muted-foreground items-center">
            <span className="inline-flex items-center gap-1.5">
              <InitialsAvatar name={responsibleName(a.responsible_id)} size="sm" />
              {responsibleName(a.responsible_id)}
            </span>
            {a.due_date && (
              <span className="inline-flex items-center gap-1"><Calendar className="size-3" /> {a.due_date}</span>
            )}
            {a.ai_generated && <Badge variant="brand" className="text-[10.5px]"><Sparkles className="size-3" /> IA</Badge>}
          </div>
        </Card>
      ))}

      {!showAdd ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(true)} className="self-start">
          <Plus className="size-3.5" /> Agregar acuerdo manualmente
        </Button>
      ) : (
        <Card className="p-4 grid gap-2.5 anim-fade-in">
          <Input
            placeholder="Descripción del acuerdo…"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2.5">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              value={newResponsible}
              onChange={e => setNewResponsible(e.target.value)}
            >
              <option value={participants.leader.id}>{participants.leader.name}</option>
              <option value={participants.collaborator.id}>{participants.collaborator.name}</option>
            </select>
            <Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowAdd(false); setNewDesc(''); setNewDueDate('') }}>
              Cancelar
            </Button>
            <Button type="button" variant="brand" size="sm" onClick={handleAddManual} disabled={isPending || !newDesc.trim()}>
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              Guardar
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
