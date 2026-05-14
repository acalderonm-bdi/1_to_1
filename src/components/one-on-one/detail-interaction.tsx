'use client'

import { useState } from 'react'
import { Lock, Eye } from 'lucide-react'
import { MinuteEditor } from './minute-editor'
import { AgreementList } from './agreement-list'
import { VoboButton } from './vobo-button'
import { FollowupModal } from './followup-modal'
import { WarmthSurvey } from './warmth-survey'
import { useRealtimeMeeting } from '@/hooks/use-realtime-meeting'
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
  partnerVobo: boolean | null
  pendingPrevAgreements: PendingAgreement[]
  currentUserId: string
  meetingStatus: string
  partnerName: string
  /** F6: estado inicial del gate de calidez (renderiza WarmthSurvey junto al VoBo). */
  hasWarmthResponse?: boolean
  /**
   * Layout switch:
   * - 'stacked' (default): notas → acuerdos → warmth → vobo, todo a 100% de ancho.
   *   Lo usa la vista del colaborador.
   * - 'split-with-rail': grid 2 columnas (notas izquierda, rail derecha con vobo).
   *   Acuerdos quedan full-width abajo. Lo usa la vista del líder.
   */
  layout?: 'stacked' | 'split-with-rail'
  /** Contenido del rail derecho (solo en layout='split-with-rail'). VoBo/Warmth se agregan al final automáticamente. */
  rail?: React.ReactNode
}

export function DetailInteraction({
  oneOnOneId, initialMinuteContent, initialAgreements, participants,
  hasVobo, voboValue, partnerVobo, pendingPrevAgreements, currentUserId, meetingStatus, partnerName,
  hasWarmthResponse = false,
  layout = 'stacked',
  rail,
}: DetailInteractionProps) {
  const [extractedSuggestions, setExtractedSuggestions] = useState<ExtractedAgreement[]>([])
  const [showFollowup, setShowFollowup] = useState(false)
  const [followupDone, setFollowupDone] = useState(hasVobo || pendingPrevAgreements.length === 0)
  const [warmthSubmitted, setWarmthSubmitted] = useState(hasWarmthResponse)

  const isCollaborator = currentUserId === participants.collaborator.id
  // La encuesta debe estar disponible ANTES de que el colaborador dé su VoBo,
  // no después de que la 1:1 quede en 'realizada' (eso solo ocurre con ambos
  // VoBos vía trigger SQL — sería un catch-22). Mostramos en cualquier estado
  // salvo cuando la sesión no se realizó o está en disputa.
  const needsWarmth =
    isCollaborator &&
    !warmthSubmitted &&
    meetingStatus !== 'no_realizada' &&
    meetingStatus !== 'en_disputa'

  // Real-time: cuando el otro participante actualiza notas, acuerdos o VoBo,
  // se refresca la página automáticamente sin tener que recargar manualmente.
  const { lastEventAt } = useRealtimeMeeting(oneOnOneId, currentUserId)

  const notesCard = (
    <div className="ui-card anim-fade-in-up">
      <div className="ui-card__head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <h3 className="ui-card__title">Notas de la reunión</h3>
            <span className="ui-badge ui-badge--slate ui-badge--plain" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Lock size={11} /> Privadas para RH
            </span>
            <span
              title={lastEventAt ? `Última sincronización: ${new Date(lastEventAt).toLocaleTimeString()}` : 'Sincronizado en vivo'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'hsl(var(--success))',
                padding: '3px 8px',
                background: 'hsl(var(--success) / 0.1)',
                border: '1px solid hsl(var(--success) / 0.3)',
                borderRadius: 999,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: 'hsl(var(--success))',
                  animation: 'pulse-soft 1.6s var(--ease-out) infinite',
                }}
              />
              En vivo
            </span>
          </div>
          <p className="ui-card__desc">
            {participants.leader.name.split(' ')[0]} y {participants.collaborator.name.split(' ')[0]} comparten estas notas.
            Cualquiera puede editarlas — la IA extrae los acuerdos al guardar.
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
            <strong>RH no ve estas notas.</strong>{' '}
            <span>Solo ven los acuerdos estructurados que la IA extrae.</span>
          </div>
        </div>
        <MinuteEditor
          oneOnOneId={oneOnOneId}
          initialContent={initialMinuteContent}
          participants={participants}
          isCollaborator={isCollaborator}
          meetingStatus={meetingStatus}
        />
      </div>
    </div>
  )

  const agreementsCard = (
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
  )

  // F6: encuesta de calidez del colaborador — renderizada junto al VoBo para
  // que el flujo sea evidente (responder → habilitar VoBo). El servidor también
  // gatea la mutación submitVobo, esto es UX adelantada.
  const warmthBlock = needsWarmth ? (
    <WarmthSurvey
      oneOnOneId={oneOnOneId}
      onSubmitted={() => setWarmthSubmitted(true)}
    />
  ) : null

  // VoBo — siempre visible post-reunión.
  // Si la 1:1 ya cerró (realizada/no_realizada), el componente muestra el estado
  // de ambos votos y permite cambiar si alguien quiere reabrir la discusión.
  const voboBlock =
    pendingPrevAgreements.length > 0 && !followupDone ? (
      <div className="vobo">
        <h3 className="vobo__title">Antes de aprobar</h3>
        <p className="vobo__sub">
          Tienes {pendingPrevAgreements.length} acuerdo{pendingPrevAgreements.length !== 1 ? 's' : ''} pendientes de la sesión anterior.
          Reporta su estado antes de aprobar esta reunión.
        </p>
        <div className="vobo__buttons">
          <button type="button" className="ui-btn ui-btn--accent" onClick={() => setShowFollowup(true)}>
            <span>Revisar acuerdos anteriores</span>
          </button>
        </div>
      </div>
    ) : needsWarmth ? null : (
      <VoboButton
        oneOnOneId={oneOnOneId}
        userVobo={voboValue}
        partnerVobo={partnerVobo}
        partnerName={partnerName}
        agreementsCount={initialAgreements.length}
      />
    )

  const followupModal = (
    <FollowupModal
      agreements={pendingPrevAgreements}
      oneOnOneId={oneOnOneId}
      open={showFollowup}
      onClose={() => { setShowFollowup(false); setFollowupDone(true) }}
    />
  )

  if (layout === 'split-with-rail') {
    return (
      <>
        {followupModal}
        <div className="meeting-grid">
          <div className="meeting-grid__main">
            {notesCard}
          </div>
          <aside className="meeting-grid__rail">
            {rail}
            {warmthBlock}
            {voboBlock}
          </aside>
        </div>
        <div className="meeting-grid__full">
          {agreementsCard}
        </div>
      </>
    )
  }

  // Default: stacked (colaborador)
  return (
    <>
      {followupModal}
      {notesCard}
      {agreementsCard}
      {warmthBlock}
      {voboBlock}
    </>
  )
}
