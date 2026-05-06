'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MinuteEditor } from './minute-editor'
import { AgreementList } from './agreement-list'
import { VoboButton } from './vobo-button'
import { FollowupModal } from './followup-modal'
import type { ExtractedAgreement } from '@/types/domain'

interface Agreement {
  id: string
  description: string
  responsible_id: string
  due_date: string | null
  status: string
  ai_generated: boolean
}

interface PendingAgreement {
  id: string
  description: string
  due_date: string | null
}

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
}

export function DetailInteraction({
  oneOnOneId,
  initialMinuteContent,
  initialAgreements,
  participants,
  hasVobo,
  voboValue,
  pendingPrevAgreements,
  currentUserId,
  meetingStatus,
}: DetailInteractionProps) {
  const [extractedSuggestions, setExtractedSuggestions] = useState<
    ExtractedAgreement[]
  >([])
  const [showFollowup, setShowFollowup] = useState(false)
  const [voboReady, setVoboReady] = useState(hasVobo)

  function handleVoboClick() {
    if (pendingPrevAgreements.length > 0 && !voboReady) {
      setShowFollowup(true)
    }
  }

  return (
    <>
      <FollowupModal
        agreements={pendingPrevAgreements}
        oneOnOneId={oneOnOneId}
        open={showFollowup}
        onClose={() => {
          setShowFollowup(false)
          setVoboReady(true)
        }}
      />

      {/* Minuta */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Minuta</CardTitle>
        </CardHeader>
        <CardContent>
          <MinuteEditor
            oneOnOneId={oneOnOneId}
            initialContent={initialMinuteContent}
            participants={participants}
            onAgreementsExtracted={setExtractedSuggestions}
          />
        </CardContent>
      </Card>

      {/* Acuerdos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Acuerdos</CardTitle>
        </CardHeader>
        <CardContent>
          <AgreementList
            oneOnOneId={oneOnOneId}
            initialAgreements={initialAgreements}
            currentUserId={currentUserId}
            participants={participants}
            extractedSuggestions={extractedSuggestions}
            onSuggestionsUsed={() => setExtractedSuggestions([])}
          />
        </CardContent>
      </Card>

      {/* VoBo */}
      {meetingStatus !== 'realizada' && meetingStatus !== 'no_realizada' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              VoBo — ¿Se realizó esta 1:1?
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingPrevAgreements.length > 0 && !voboReady ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Tienes{' '}
                  <strong>
                    {pendingPrevAgreements.length} acuerdo
                    {pendingPrevAgreements.length !== 1 ? 's' : ''}
                  </strong>{' '}
                  pendientes de la última sesión. Reporta su estado antes de dar
                  VoBo.
                </p>
                <button
                  onClick={handleVoboClick}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Revisar acuerdos anteriores →
                </button>
              </div>
            ) : (
              <VoboButton oneOnOneId={oneOnOneId} userVobo={voboValue} />
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}
