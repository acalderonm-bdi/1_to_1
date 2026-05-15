import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  ChevronLeft, Calendar, Clock, CheckSquare, AlertTriangle, TrendingUp,
  ArrowRight, Plus, Video, MapPin, Mail, Building2,
} from 'lucide-react'
import { STATUS_LABELS, AGREEMENT_LABELS } from '@/lib/constants'
import { EmptyState } from '@/components/shared/empty-state'
import { TransferBanner } from '@/components/shared/transfer-banner'
import { getOrgSetting } from '@/lib/org-settings'

const STATUS_TONE: Record<string, string> = {
  agendada: 'blue', realizada: 'green', no_realizada: 'red', en_disputa: 'orange',
}
const AGREEMENT_TONE: Record<string, string> = {
  pendiente: 'amber', cumplido: 'green', parcial: 'blue', no_cumplido: 'red',
}

export default async function LeaderCollabProfile({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('users')
    .select('id, full_name, email, avatar_url, role, is_active, department:departments(name)')
    .eq('id', params.id)
    .maybeSingle()
  if (!rawProfile) notFound()
  const collab = rawProfile as {
    id: string; full_name: string; email: string; avatar_url: string | null; role: string; is_active: boolean
    department: { name: string } | Array<{ name: string }> | null
  }
  const departmentName = (Array.isArray(collab.department) ? collab.department[0] : collab.department)?.name ?? null

  // Validar que sea mi colaborador (relación activa) o que sea HR.
  const [relationRes, { data: myProfile }] = await Promise.all([
    supabase.from('leadership_relations')
      .select('id, leader_id, started_at, ended_at, transfer_banner_dismissed_at')
      .eq('leader_id', user.id)
      .eq('collaborator_id', params.id)
      .is('ended_at', null)
      .maybeSingle(),
    supabase.from('users').select('role').eq('id', user.id).single<{ role: string }>(),
  ])
  const relation = relationRes.data
  const isMyCollab = !!relation
  const isHr = myProfile?.role === 'hr'
  if (!isMyCollab && !isHr) redirect('/lider')

  // Traer 1:1s entre este líder y este colab (todas).
  const { data: rawMeetings } = await supabase
    .from('one_on_ones')
    .select('id, scheduled_at, modality, status, duration_minutes, agreements(id, status)')
    .eq('leader_id', user.id)
    .eq('collaborator_id', params.id)
    .order('scheduled_at', { ascending: false })

  const meetings = (rawMeetings ?? []) as Array<{
    id: string; scheduled_at: string; modality: string; status: string; duration_minutes: number
    agreements: Array<{ id: string; status: string }>
  }>

  // Acuerdos donde este colab es responsable (de 1:1s míos solamente, por privacidad).
  const myMeetingIds = meetings.map(m => m.id)
  let agreementsRaw: Array<{
    id: string; description: string; status: string; due_date: string | null; ai_generated: boolean
    one_on_one_id: string; created_at: string
  }> = []
  if (myMeetingIds.length > 0) {
    const { data } = await supabase
      .from('agreements')
      .select('id, description, status, due_date, ai_generated, one_on_one_id, created_at')
      .eq('responsible_id', params.id)
      .in('one_on_one_id', myMeetingIds)
      .order('created_at', { ascending: false })
    agreementsRaw = (data ?? []) as typeof agreementsRaw
  }

  // F4: traer acuerdos abiertos desde la view (incluye is_transferred y
  // original_leader_id). View columns are nullable, so cuidamos null en el map.
  const openAgreementsRes = await supabase
    .from('open_agreements_by_collaborator')
    .select('*')
    .eq('collaborator_id', params.id)
    .order('due_date', { ascending: true, nullsFirst: false })
  const openAgreements = openAgreementsRes.data ?? []
  const transferredMap = new Map<string, boolean>(
    openAgreements
      .filter((a): a is typeof a & { id: string; is_transferred: boolean } =>
        a.id !== null && a.is_transferred !== null,
      )
      .map((a) => [a.id, a.is_transferred]),
  )
  const transferredCount = openAgreements.filter((a) => a.is_transferred).length

  // Decidir si mostramos el banner: yo soy el líder actual, no lo he descartado,
  // hay al menos un acuerdo transferido y el setting global `transfer_banner_enabled`
  // está activo (RH puede ocultarlo globalmente desde /parametros).
  const transferBannerEnabled = await getOrgSetting('transfer_banner_enabled')
  const shouldShowBanner = Boolean(
    transferBannerEnabled &&
    relation &&
    relation.leader_id === user.id &&
    !relation.transfer_banner_dismissed_at &&
    transferredCount > 0
  )

  let previousLeaderName: string | null = null
  if (shouldShowBanner) {
    const firstTransferred = openAgreements.find(a => a.is_transferred)
    if (firstTransferred?.original_leader_id) {
      const { data: prevLeader } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', firstTransferred.original_leader_id)
        .single<{ full_name: string }>()
      previousLeaderName = prevLeader?.full_name ?? 'líder anterior'
    }
  }

  const now = new Date()
  const realizedMeetings = meetings.filter(m => m.status === 'realizada')
  const pastMeetings = meetings.filter(m => new Date(m.scheduled_at) < now)
  const upcomingMeetings = meetings.filter(m => new Date(m.scheduled_at) >= now && m.status === 'agendada')

  const totalFinalized = meetings.filter(m => m.status === 'realizada' || m.status === 'no_realizada').length
  const complianceRate = totalFinalized > 0
    ? Math.round((realizedMeetings.length / totalFinalized) * 100)
    : 0

  const lastRealized = realizedMeetings[0]
  const daysSinceLast = lastRealized
    ? Math.floor((now.getTime() - new Date(lastRealized.scheduled_at).getTime()) / 86400000)
    : null

  const agreementsByStatus = {
    pendiente: agreementsRaw.filter(a => a.status === 'pendiente'),
    cumplido: agreementsRaw.filter(a => a.status === 'cumplido'),
    parcial: agreementsRaw.filter(a => a.status === 'parcial'),
    no_cumplido: agreementsRaw.filter(a => a.status === 'no_cumplido'),
  }
  const completionRate = agreementsRaw.length > 0
    ? Math.round((agreementsByStatus.cumplido.length / agreementsRaw.length) * 100)
    : 0

  const initials = collab.full_name.split(' ').map(p => p[0]?.toUpperCase()).slice(0, 2).join('') || '?'
  const complianceTone =
    complianceRate >= 80 ? 'green' :
    complianceRate >= 60 ? 'amber' :
    complianceRate >= 40 ? 'orange' : 'red'

  function formatMonthDay(iso: string) {
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <Link href="/lider/equipo" className="ui-btn ui-btn--ghost ui-btn--sm">
          <ChevronLeft size={13} /> Volver a mi equipo
        </Link>
      </div>

      {/* Header */}
      <div className="hero-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
          <div className="avatar avatar--lg av-blue" style={{ width: 64, height: 64, fontSize: 22 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1 className="font-serif" style={{ fontSize: 30, letterSpacing: '-0.024em', fontWeight: 500, margin: '0 0 4px', lineHeight: 1.1 }}>
              {collab.full_name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10, fontSize: 13.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Mail size={13} /> {collab.email}
              </span>
              {departmentName && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Building2 size={13} /> {departmentName}
                </span>
              )}
              {!collab.is_active && (
                <span className="ui-badge ui-badge--red">Inactivo</span>
              )}
            </div>
          </div>
          <Link href="/colaborador/1to1/nueva" className="ui-btn ui-btn--accent">
            <Plus size={14} /> <span>Agendar 1:1</span>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }} className="anim-stagger">
        <div className="kpi">
          <div className={`kpi__icon kpi__icon--${complianceTone}`}><TrendingUp /></div>
          <div className="kpi__label">Cumplimiento de cadencia</div>
          <div className="kpi__value u-tabular">{complianceRate}%</div>
          <div className="kpi__delta">{realizedMeetings.length}/{totalFinalized} 1:1s realizadas</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--blue"><Calendar /></div>
          <div className="kpi__label">Total 1:1s</div>
          <div className="kpi__value u-tabular">{meetings.length}</div>
          <div className="kpi__delta">{upcomingMeetings.length} próximas</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--amber"><CheckSquare /></div>
          <div className="kpi__label">Acuerdos pendientes</div>
          <div className="kpi__value u-tabular">{agreementsByStatus.pendiente.length}</div>
          <div className="kpi__delta">{completionRate}% cumplidos histórico</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--violet"><Clock /></div>
          <div className="kpi__label">Última 1:1 realizada</div>
          <div className="kpi__value u-tabular" style={{ fontSize: daysSinceLast !== null ? 32 : 22 }}>
            {daysSinceLast === null ? 'Nunca' : daysSinceLast === 0 ? 'Hoy' : `${daysSinceLast}d`}
          </div>
          <div className="kpi__delta">{lastRealized ? formatMonthDay(lastRealized.scheduled_at) : 'sin historial'}</div>
        </div>
      </div>

      {/* F4: banner de acuerdos heredados (sólo para el líder actual). */}
      {shouldShowBanner && relation && (
        <TransferBanner
          leadershipRelationId={relation.id}
          collaboratorName={collab.full_name}
          previousLeaderName={previousLeaderName ?? 'líder anterior'}
          openAgreementsCount={transferredCount}
        />
      )}

      {/* Acuerdos del colaborador */}
      <div className="ui-card" style={{ marginBottom: 18 }}>
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title"><CheckSquare size={15} /> Compromisos de {collab.full_name.split(' ')[0]}</h3>
            <p className="ui-card__desc">
              {agreementsRaw.length === 0
                ? 'Aún no hay compromisos registrados'
                : (() => {
                    const p = agreementsByStatus.pendiente.length
                    const c = agreementsByStatus.cumplido.length
                    const pa = agreementsByStatus.parcial.length
                    const n = agreementsByStatus.no_cumplido.length
                    return `${p} pendiente${p === 1 ? '' : 's'} · ${c} cumplido${c === 1 ? '' : 's'} · ${pa} parcial${pa === 1 ? '' : 'es'} · ${n} no cumplido${n === 1 ? '' : 's'}`
                  })()}
            </p>
          </div>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          {agreementsRaw.length === 0 ? (
            <EmptyState
              illustration="success"
              title="Sin acuerdos por ahora"
              description="Los compromisos aparecerán aquí conforme cierres 1:1s con notas."
            />
          ) : (
            agreementsRaw.map(a => {
              const overdue = a.status === 'pendiente' && a.due_date && new Date(a.due_date) < now
              return (
                <div key={a.id} className="list-row">
                  <div className="list-row__content">
                    <div className="list-row__title">
                      <span className={`ui-badge ui-badge--${overdue ? 'red' : AGREEMENT_TONE[a.status]}`}>
                        {overdue ? 'Vencido' : AGREEMENT_LABELS[a.status]}
                      </span>
                      {a.ai_generated && <span className="ai-chip">IA</span>}
                      {transferredMap.get(a.id) && (
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
                      <span>{a.description}</span>
                    </div>
                    <div className="list-row__meta">
                      {a.due_date && (
                        <span style={{ color: overdue ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))' }}>
                          <Calendar size={11} /> Vence {formatMonthDay(a.due_date)}
                        </span>
                      )}
                      <span>Creado {formatMonthDay(a.created_at)}</span>
                      <Link href={`/lider/1to1/${a.one_on_one_id}`} style={{ color: 'hsl(var(--primary))' }}>
                        Ver 1:1 origen
                      </Link>
                    </div>
                  </div>
                  <Link href={`/lider/1to1/${a.one_on_one_id}`} className="ui-btn ui-btn--outline ui-btn--sm list-row__action">
                    Abrir
                  </Link>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Historial de 1:1s */}
      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title"><Calendar size={15} /> Historial de 1:1s</h3>
            <p className="ui-card__desc">
              {meetings.length === 0
                ? 'Sin reuniones registradas'
                : `${meetings.length} reuniones — ${realizedMeetings.length} realizadas, ${pastMeetings.length - realizedMeetings.length - meetings.filter(m => m.status === 'en_disputa').length} no realizadas`}
            </p>
          </div>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          {meetings.length === 0 ? (
            <EmptyState
              illustration="meetings"
              title="Sin historial"
              description="No has tenido 1:1s con esta persona aún."
              action={
                <Link href="/colaborador/1to1/nueva" className="ui-btn ui-btn--accent">
                  <Plus size={13} /> <span>Agendar primera 1:1</span>
                </Link>
              }
            />
          ) : (
            meetings.map(m => {
              const agreementCount = m.agreements.length
              const compliedCount = m.agreements.filter(a => a.status === 'cumplido').length
              const d = new Date(m.scheduled_at)
              return (
                <div key={m.id} className="list-row">
                  <div className="list-row__content">
                    <div className="list-row__title">
                      <span className={`ui-badge ui-badge--${STATUS_TONE[m.status] ?? 'slate'}`}>
                        {STATUS_LABELS[m.status]}
                      </span>
                      <span>
                        {d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · {d.toTimeString().slice(0, 5)}
                      </span>
                    </div>
                    <div className="list-row__meta">
                      {m.modality === 'virtual' ? <Video size={12} /> : <MapPin size={12} />}
                      <span>{m.duration_minutes} min</span>
                      {agreementCount > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckSquare size={11} /> {compliedCount}/{agreementCount} cumplidos
                        </span>
                      )}
                      {m.status === 'en_disputa' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'hsl(var(--warning))' }}>
                          <AlertTriangle size={11} /> Disputa abierta
                        </span>
                      )}
                    </div>
                  </div>
                  <Link href={`/lider/1to1/${m.id}`} className="ui-btn ui-btn--outline ui-btn--sm list-row__action">
                    Abrir <ArrowRight size={12} />
                  </Link>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
