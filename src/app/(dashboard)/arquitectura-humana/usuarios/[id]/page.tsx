import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  ChevronLeft, Calendar, Clock, CheckSquare, AlertTriangle, TrendingUp,
  ArrowRight, Video, MapPin, Mail, Building2, History,
} from 'lucide-react'
import { STATUS_LABELS, AGREEMENT_LABELS, ROLE_LABELS } from '@/lib/constants'
import { EmptyState } from '@/components/shared/empty-state'
import { UserAdminControls } from '@/components/arquitectura-humana/user-admin-controls'

const STATUS_TONE: Record<string, string> = {
  agendada: 'blue', realizada: 'green', no_realizada: 'red', en_disputa: 'orange',
}
const AGREEMENT_TONE: Record<string, string> = {
  pendiente: 'amber', cumplido: 'green', parcial: 'blue', no_cumplido: 'red',
}
const ROLE_TONE: Record<string, string> = { hr: 'violet', leader: 'blue', collaborator: 'slate' }

export default async function HrUserProfile({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user: viewer } } = await supabase.auth.getUser()
  if (!viewer) redirect('/login')
  const { data: myProfile } = await supabase
    .from('users').select('role').eq('id', viewer.id).single<{ role: string }>()
  if (myProfile?.role !== 'hr') redirect('/')

  const { data: rawProfile } = await supabase
    .from('users')
    .select('id, full_name, email, avatar_url, role, is_active, created_at, department:departments(id, name)')
    .eq('id', params.id)
    .maybeSingle()
  if (!rawProfile) notFound()
  const target = rawProfile as {
    id: string; full_name: string; email: string; avatar_url: string | null; role: string; is_active: boolean
    created_at: string
    department: { id: string; name: string } | Array<{ id: string; name: string }> | null
  }
  const dept = Array.isArray(target.department) ? target.department[0] : target.department

  // Relación líder actual
  const { data: rawRel } = await supabase
    .from('leadership_relations')
    .select('leader_id, started_at, users!leadership_relations_leader_id_fkey(id, full_name, email)')
    .eq('collaborator_id', params.id)
    .is('ended_at', null)
    .maybeSingle()
  const relation = rawRel as {
    leader_id: string; started_at: string
    users: { id: string; full_name: string; email: string } | Array<{ id: string; full_name: string; email: string }> | null
  } | null
  const currentLeader = relation ? (Array.isArray(relation.users) ? relation.users[0] : relation.users) : null

  // Lista de candidatos a líder (todos los líderes activos)
  const { data: leaderOpts } = await supabase
    .from('users')
    .select('id, full_name, email')
    .in('role', ['leader', 'hr'])
    .eq('is_active', true)
    .order('full_name')
  const leaderOptions = (leaderOpts ?? []) as Array<{ id: string; full_name: string; email: string }>

  // 1:1s (en cualquier rol: como líder o como colab)
  const { data: rawMeetings } = await supabase
    .from('one_on_ones')
    .select(`
      id, scheduled_at, modality, status, duration_minutes, leader_id, collaborator_id,
      counterpart_leader:users!one_on_ones_leader_id_fkey(id, full_name),
      counterpart_collab:users!one_on_ones_collaborator_id_fkey(id, full_name),
      agreements(id, status)
    `)
    .or(`leader_id.eq.${params.id},collaborator_id.eq.${params.id}`)
    .order('scheduled_at', { ascending: false })
    .limit(50)

  const meetings = (rawMeetings ?? []) as Array<{
    id: string; scheduled_at: string; modality: string; status: string; duration_minutes: number
    leader_id: string; collaborator_id: string
    counterpart_leader: { id: string; full_name: string } | Array<{ id: string; full_name: string }> | null
    counterpart_collab: { id: string; full_name: string } | Array<{ id: string; full_name: string }> | null
    agreements: Array<{ id: string; status: string }>
  }>

  // Acuerdos donde es responsable
  const { data: rawAgreements } = await supabase
    .from('agreements')
    .select('id, description, status, due_date, ai_generated, created_at, one_on_one_id')
    .eq('responsible_id', params.id)
    .order('created_at', { ascending: false })
    .limit(30)
  const agreementsRaw = (rawAgreements ?? []) as Array<{
    id: string; description: string; status: string; due_date: string | null
    ai_generated: boolean; created_at: string; one_on_one_id: string
  }>

  // Auditoría (acciones sobre este usuario)
  const { data: rawAudit } = await supabase
    .from('audit_logs')
    .select('action, metadata, created_at')
    .eq('resource_type', 'user')
    .eq('resource_id', params.id)
    .order('created_at', { ascending: false })
    .limit(10)
  const audit = (rawAudit ?? []) as Array<{ action: string; metadata: Record<string, unknown> | null; created_at: string }>

  const now = new Date()
  const realizedMeetings = meetings.filter(m => m.status === 'realizada')
  const totalFinalized = meetings.filter(m => m.status === 'realizada' || m.status === 'no_realizada').length
  const complianceRate = totalFinalized > 0 ? Math.round((realizedMeetings.length / totalFinalized) * 100) : 0

  const agreementsByStatus = {
    pendiente: agreementsRaw.filter(a => a.status === 'pendiente').length,
    cumplido: agreementsRaw.filter(a => a.status === 'cumplido').length,
    parcial: agreementsRaw.filter(a => a.status === 'parcial').length,
    no_cumplido: agreementsRaw.filter(a => a.status === 'no_cumplido').length,
  }
  const initials = target.full_name.split(' ').map(p => p[0]?.toUpperCase()).slice(0, 2).join('') || '?'
  const complianceTone =
    complianceRate >= 80 ? 'green' :
    complianceRate >= 60 ? 'amber' :
    complianceRate >= 40 ? 'orange' : 'red'

  function fShort(iso: string) {
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  }
  function fLong(iso: string) {
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <Link href="/arquitectura-humana/usuarios" className="ui-btn ui-btn--ghost ui-btn--sm">
          <ChevronLeft size={13} /> Volver a usuarios
        </Link>
      </div>

      {/* Header */}
      <div className="hero-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
          <div className="avatar avatar--lg av-blue" style={{ width: 64, height: 64, fontSize: 22 }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className={`ui-badge ui-badge--${ROLE_TONE[target.role] ?? 'slate'}`}>
                {ROLE_LABELS[target.role] ?? target.role}
              </span>
              {!target.is_active && <span className="ui-badge ui-badge--red">Inactivo</span>}
            </div>
            <h1 className="font-serif" style={{ fontSize: 30, letterSpacing: '-0.024em', fontWeight: 500, margin: '0 0 4px', lineHeight: 1.1 }}>
              {target.full_name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10, fontSize: 13.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mail size={13} /> {target.email}</span>
              {dept && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Building2 size={13} /> {dept.name}</span>}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Calendar size={13} /> Activo desde {fLong(target.created_at)}</span>
              {currentLeader && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  Reporta a <strong style={{ color: 'var(--text-c)' }}>{currentLeader.full_name}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }} className="anim-stagger">
        <div className="kpi">
          <div className={`kpi__icon kpi__icon--${complianceTone}`}><TrendingUp /></div>
          <div className="kpi__label">Cumplimiento</div>
          <div className="kpi__value u-tabular">{complianceRate}%</div>
          <div className="kpi__delta">{realizedMeetings.length}/{totalFinalized} realizadas</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--blue"><Calendar /></div>
          <div className="kpi__label">Total 1:1s</div>
          <div className="kpi__value u-tabular">{meetings.length}</div>
          <div className="kpi__delta">{meetings.filter(m => m.status === 'agendada').length} próximas</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--amber"><CheckSquare /></div>
          <div className="kpi__label">Acuerdos pend.</div>
          <div className="kpi__value u-tabular">{agreementsByStatus.pendiente}</div>
          <div className="kpi__delta">{agreementsByStatus.cumplido} cumplidos · {agreementsByStatus.no_cumplido} no cumplidos</div>
        </div>
        <div className="kpi">
          <div className={`kpi__icon kpi__icon--${meetings.some(m => m.status === 'en_disputa') ? 'orange' : 'green'}`}><AlertTriangle /></div>
          <div className="kpi__label">Disputas abiertas</div>
          <div className="kpi__value u-tabular">{meetings.filter(m => m.status === 'en_disputa').length}</div>
          <div className="kpi__delta">requieren resolución</div>
        </div>
      </div>

      <div className="layout-2col" style={{ alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          {/* Acuerdos */}
          <div className="ui-card">
            <div className="ui-card__head">
              <div>
                <h3 className="ui-card__title"><CheckSquare size={15} /> Compromisos como responsable</h3>
                <p className="ui-card__desc">Últimos 30 acuerdos asignados a esta persona.</p>
              </div>
            </div>
            <div className="ui-card__body ui-card__body--flush">
              {agreementsRaw.length === 0 ? (
                <EmptyState illustration="success" title="Sin acuerdos" description="Esta persona no tiene compromisos registrados." />
              ) : (
                agreementsRaw.map(a => {
                  const overdue = a.status === 'pendiente' && !!a.due_date && new Date(a.due_date) < now
                  return (
                    <div key={a.id} className="list-row">
                      <div className="list-row__content">
                        <div className="list-row__title">
                          <span className={`ui-badge ui-badge--${overdue ? 'red' : AGREEMENT_TONE[a.status]}`}>
                            {overdue ? 'Vencido' : AGREEMENT_LABELS[a.status]}
                          </span>
                          {a.ai_generated && <span className="ai-chip">IA</span>}
                          <span>{a.description}</span>
                        </div>
                        <div className="list-row__meta">
                          {a.due_date && <span><Calendar size={11} /> Vence {fShort(a.due_date)}</span>}
                          <span>Creado {fShort(a.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* 1:1s */}
          <div className="ui-card">
            <div className="ui-card__head">
              <div>
                <h3 className="ui-card__title"><Calendar size={15} /> Historial de 1:1s</h3>
                <p className="ui-card__desc">{meetings.length} reuniones registradas (últimas 50).</p>
              </div>
            </div>
            <div className="ui-card__body ui-card__body--flush">
              {meetings.length === 0 ? (
                <EmptyState illustration="meetings" title="Sin 1:1s" description="Esta persona no tiene reuniones registradas." />
              ) : (
                meetings.map(m => {
                  const counterpart = m.leader_id === params.id
                    ? (Array.isArray(m.counterpart_collab) ? m.counterpart_collab[0] : m.counterpart_collab)
                    : (Array.isArray(m.counterpart_leader) ? m.counterpart_leader[0] : m.counterpart_leader)
                  const role = m.leader_id === params.id ? 'como líder' : 'como colab'
                  const d = new Date(m.scheduled_at)
                  return (
                    <div key={m.id} className="list-row">
                      <div className="list-row__content">
                        <div className="list-row__title">
                          <span className={`ui-badge ui-badge--${STATUS_TONE[m.status] ?? 'slate'}`}>
                            {STATUS_LABELS[m.status]}
                          </span>
                          <span>1:1 con {counterpart?.full_name ?? '—'} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}>({role})</span></span>
                        </div>
                        <div className="list-row__meta">
                          <span><Clock size={11} /> {d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · {d.toTimeString().slice(0, 5)}</span>
                          {m.modality === 'virtual' ? <Video size={12} /> : <MapPin size={12} />}
                          <span>{m.duration_minutes} min</span>
                          {m.agreements.length > 0 && (
                            <span><CheckSquare size={11} /> {m.agreements.filter(a => a.status === 'cumplido').length}/{m.agreements.length}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <UserAdminControls
            userId={target.id}
            currentRole={target.role as 'collaborator' | 'leader' | 'hr'}
            isActive={target.is_active}
            currentLeaderId={currentLeader?.id ?? null}
            leaderOptions={leaderOptions}
          />

          {/* Auditoría */}
          <div className="ui-card">
            <div className="ui-card__head">
              <div>
                <h3 className="ui-card__title"><History size={15} /> Auditoría reciente</h3>
                <p className="ui-card__desc">Cambios administrativos sobre este usuario.</p>
              </div>
            </div>
            <div className="ui-card__body" style={{ paddingTop: 12 }}>
              {audit.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Sin eventos registrados.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                  {audit.map((e, i) => (
                    <li key={i} style={{ fontSize: 12.5, color: 'var(--text-c)' }}>
                      <span style={{ fontWeight: 500 }}>{e.action.replace(/_/g, ' ')}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                        {fShort(e.created_at)} · {new Date(e.created_at).toTimeString().slice(0, 5)}
                      </span>
                      {e.metadata && Object.keys(e.metadata).length > 0 && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                          {JSON.stringify(e.metadata)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
