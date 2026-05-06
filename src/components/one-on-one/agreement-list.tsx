'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckSquare, Plus, Loader2 } from 'lucide-react'
import { createAgreement, updateAgreementStatus } from '@/lib/actions/agreements'
import { AGREEMENT_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils/cn'
import type { ExtractedAgreement } from '@/types/domain'

interface Agreement {
  id: string
  description: string
  responsible_id: string
  due_date: string | null
  status: string
  ai_generated: boolean
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

const STATUS_COLORS: Record<string, string> = {
  pendiente: 'text-yellow-700 bg-yellow-50',
  cumplido: 'text-green-700 bg-green-50',
  parcial: 'text-blue-700 bg-blue-50',
  no_cumplido: 'text-red-700 bg-red-50',
}

export function AgreementList({
  oneOnOneId, initialAgreements, currentUserId, participants, extractedSuggestions, onSuggestionsUsed,
}: AgreementListProps) {
  const [agreements, setAgreements] = useState<Agreement[]>(initialAgreements)
  const [newDesc, setNewDesc] = useState('')
  const [newResponsible, setNewResponsible] = useState(participants.collaborator.id)
  const [isPending, startTransition] = useTransition()

  async function handleAdd(desc: string, responsibleId: string, aiGenerated = false, confidence?: number) {
    const result = await createAgreement({
      oneOnOneId,
      description: desc,
      responsibleId,
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
      await handleAdd(newDesc.trim(), newResponsible)
      setNewDesc('')
    })
  }

  async function handleAcceptSuggestion(suggestion: ExtractedAgreement) {
    const responsibleId = suggestion.responsible_email === participants.leader.email
      ? participants.leader.id
      : participants.collaborator.id
    await handleAdd(suggestion.description, responsibleId, true, suggestion.confidence)
  }

  async function handleStatusChange(agreementId: string, status: string) {
    await updateAgreementStatus({ agreementId, status: status as 'pendiente' | 'cumplido' | 'parcial' | 'no_cumplido' })
    setAgreements(prev => prev.map(a => a.id === agreementId ? { ...a, status } : a))
  }

  return (
    <div className="space-y-4">
      {extractedSuggestions && extractedSuggestions.length > 0 && (
        <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-2">
          <p className="text-xs font-medium text-blue-700 flex items-center gap-1">
            <CheckSquare className="h-3.5 w-3.5" />
            IA extrajo {extractedSuggestions.length} acuerdo{extractedSuggestions.length !== 1 ? 's' : ''} — confirma cuáles agregar:
          </p>
          {extractedSuggestions.map((s, i) => (
            <div key={i} className="flex items-start justify-between gap-2 text-sm">
              <span className="text-slate-700 flex-1">{s.description}</span>
              <Button size="sm" variant="outline" className="text-xs h-6 shrink-0"
                onClick={() => { handleAcceptSuggestion(s); onSuggestionsUsed?.() }}>
                Agregar
              </Button>
            </div>
          ))}
        </div>
      )}

      {agreements.length === 0 && !extractedSuggestions?.length && (
        <p className="text-sm text-slate-400 italic">Sin acuerdos registrados.</p>
      )}

      {agreements.map(agr => (
        <div key={agr.id} className="flex items-start gap-3 p-3 rounded-lg border">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700">{agr.description}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">
                {agr.responsible_id === participants.leader.id ? participants.leader.name : participants.collaborator.name}
              </span>
              {agr.due_date && <span className="text-xs text-slate-400">· {agr.due_date}</span>}
              {agr.ai_generated && <span className="text-xs text-slate-300">· ✦ IA</span>}
            </div>
          </div>
          <Select value={agr.status} onValueChange={val => handleStatusChange(agr.id, val)}>
            <SelectTrigger className={cn('h-7 text-xs w-36 shrink-0', STATUS_COLORS[agr.status] ?? '')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(AGREEMENT_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <Input
          placeholder="Nuevo acuerdo..."
          value={newDesc}
          onChange={e => setNewDesc(e.target.value)}
          className="text-sm h-9"
          onKeyDown={e => { if (e.key === 'Enter') handleAddManual() }}
        />
        <Select value={newResponsible} onValueChange={setNewResponsible}>
          <SelectTrigger className="h-9 text-xs w-36 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={participants.leader.id} className="text-xs">{participants.leader.name}</SelectItem>
            <SelectItem value={participants.collaborator.id} className="text-xs">{participants.collaborator.name}</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={handleAddManual} disabled={isPending || !newDesc.trim()}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
