'use client'

import { useState } from 'react'
import { Lock, Eye } from 'lucide-react'
import { MinuteEditor } from './minute-editor'
import { AgreementList } from './agreement-list'
import { VoboButton } from './vobo-button'
import { FollowupModal } from './followup-modal'
import type { ExtractedAgreement } from '@/types/domain'

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
      <div className="ui-card anim-fade-in-up">
        <div className="ui-card__head">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h3 className="ui-card__title">Minuta</h3>
              <span className="ui-badge ui-badge--slate ui-badge--plain" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Lock size={11} /> Privado
              </span>
            </div>
            <p className="ui-card__desc">
              Lo que conversaron. Solo lo ven {participants.leader.name.split(' ')[0]} y {participants.collaborator.name.split(' ')[0]}.
            </p>
          </div>
        </div>
        <div className="ui-card__body" style={{ paddingTop: 12 }}>
          <div className="privacy-banner" style={{ marginBottom: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <div>
              <strong>Esta minuta es privada.</strong>{' '}
              <span>RH no tiene acceso al contenido — solo a los acuerdos estructurados que decidas guardar.</span>
            </div>
          </div>
          <MinuteEditor
            oneOnOneId={oneOnOneId}
            initialContent={initialMinuteContent}
            participants={participants}
            onAgreementsExtracted={setExtractedSuggestions}
          />
        </div>
      </div>

      {/* Acuerdos */}
      <div className="ui-card anim-fade-in-up">
        <div className="ui-card__head">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h3 className="ui-card__title">Acuerdos</h3>
              <span className="ui-badge ui-badge--blue ui-badge--plain" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Eye size={11} /> Visible para RH
              </span>
            </div>
            <p className="ui-card__desc">Compromisos estructurados que quedan registrados para seguimiento.</p>
          </div>
        </div>
        <div className="ui-card__body">
          <AgreementList
            oneOnOneId={oneOnOneId}
            initialAgreements={initialAgreements}
            currentUserId={participants.collaborator.id}
            participants={participants}
            extractedSuggestions={extractedSuggestions}
            onSuggestionsUsed={() => setExtractedSuggestions([])}
          />
        </div>
      </div>

      {/* VoBo */}
      {meetingStatus !== 'realizada' && meetingStatus !== 'no_realizada' && (
        <>
          {pendingPrevAgreements.length > 0 && !followupDone ? (
            <div className="vobo">
              <h3 className="vobo__title">Antes de dar VoBo</h3>
              <p className="vobo__sub">
                Tienes {pendingPrevAgreements.length} acuerdo{pendingPrevAgreements.length !== 1 ? 's' : ''} pendientes de la sesión anterior.
                Reporta su estado antes de confirmar esta reunión.
              </p>
              <div className="vobo__buttons">
                <button type="button" className="ui-btn ui-btn--accent" onClick={() => setShowFollowup(true)}>
                  <span>Revisar acuerdos anteriores</span>
                </button>
              </div>
            </div>
          ) : (
            <VoboButton
              oneOnOneId={oneOnOneId}
              userVobo={voboValue}
              partnerName={partnerName}
            />
          )}
        </>
      )}
    </>
  )
}
