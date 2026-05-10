'use client'

import { useState } from 'react'
import { Lock, Eye, Shield } from 'lucide-react'
import { MinuteEditor } from './minute-editor'
import { AgreementList } from './agreement-list'
import { VoboButton } from './vobo-button'
import { FollowupModal } from './followup-modal'
import type { ExtractedAgreement } from '@/types/domain'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Agreement {
  id: string; description: string; responsible_id: string;
  due_date: string | null; status: string; ai_generated: boolean
}
interface PendingAgreement { id: string; description: string; due_date: string | null }
interface DetailInteractionProps {
  oneOnOneId: string
  initialMinuteContent: string
  initialAgreements: Agreement[]
  participants: {
    leader: { id: string; name: string; email: string }
    collaborator: { id: string; name: string; email: string }
  }
  hasVobo: boolean
  voboValue: boolean | null
  pendingPrevAgreements: PendingAgreement[]
  currentUserId: string
  meetingStatus: string
  partnerName: string
}

export function DetailInteraction({
  oneOnOneId, initialMinuteContent, initialAgreements, participants,
  hasVobo, voboValue, pendingPrevAgreements, meetingStatus, partnerName,
}: DetailInteractionProps) {
  const [extractedSuggestions, setExtractedSuggestions] = useState<ExtractedAgreement[]>([])
  const [showFollowup, setShowFollowup] = useState(false)
  const [followupDone, setFollowupDone] = useState(hasVobo || pendingPrevAgreements.length === 0)

  return (
    <>
      <FollowupModal
        agreements={pendingPrevAgreements}
        oneOnOneId={oneOnOneId}
        open={showFollowup}
        onClose={() => { setShowFollowup(false); setFollowupDone(true) }}
      />

      {/* Minuta */}
      <Card className="anim-fade-in-up">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Minuta</CardTitle>
            <Badge variant="muted" className="text-[10.5px]"><Lock className="size-3" /> Privado</Badge>
          </div>
          <CardDescription>
            Lo que conversaron. Solo lo ven {participants.leader.name.split(' ')[0]} y {participants.collaborator.name.split(' ')[0]}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2.5 p-3 rounded-md border border-dashed bg-secondary/30 text-[12.5px] text-muted-foreground mb-4 leading-relaxed">
            <Shield className="size-4 mt-0.5 shrink-0" />
            <div>
              <strong className="text-foreground font-medium">Esta minuta es privada.</strong>{' '}
              RH no tiene acceso al contenido — solo a los acuerdos estructurados que decidas guardar.
            </div>
          </div>
          <MinuteEditor
            oneOnOneId={oneOnOneId}
            initialContent={initialMinuteContent}
            participants={participants}
            onAgreementsExtracted={setExtractedSuggestions}
          />
        </CardContent>
      </Card>

      {/* Acuerdos */}
      <Card className="anim-fade-in-up">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Acuerdos</CardTitle>
            <Badge variant="brand" className="text-[10.5px]"><Eye className="size-3" /> Visible para RH</Badge>
          </div>
          <CardDescription>Compromisos estructurados que quedan registrados para seguimiento.</CardDescription>
        </CardHeader>
        <CardContent>
          <AgreementList
            oneOnOneId={oneOnOneId}
            initialAgreements={initialAgreements}
            currentUserId={participants.collaborator.id}
            participants={participants}
            extractedSuggestions={extractedSuggestions}
            onSuggestionsUsed={() => setExtractedSuggestions([])}
          />
        </CardContent>
      </Card>

      {/* VoBo */}
      {meetingStatus !== 'realizada' && meetingStatus !== 'no_realizada' && (
        <>
          {pendingPrevAgreements.length > 0 && !followupDone ? (
            <Card className="p-6">
              <h3 className="text-lg font-medium tracking-tight">Antes de dar VoBo</h3>
              <p className="text-[13.5px] text-muted-foreground mt-1.5 mb-5 max-w-lg leading-relaxed">
                Tienes {pendingPrevAgreements.length} acuerdo{pendingPrevAgreements.length !== 1 ? 's' : ''} pendientes de la sesión anterior.
                Reporta su estado antes de confirmar esta reunión.
              </p>
              <Button type="button" variant="brand" onClick={() => setShowFollowup(true)}>
                Revisar acuerdos anteriores
              </Button>
            </Card>
          ) : (
            <VoboButton oneOnOneId={oneOnOneId} userVobo={voboValue} partnerName={partnerName} />
          )}
        </>
      )}
    </>
  )
}
