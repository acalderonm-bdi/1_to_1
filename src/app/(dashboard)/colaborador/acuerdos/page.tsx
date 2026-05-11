import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CheckSquare, Calendar, Filter } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { AgreementStatusPill } from '@/components/one-on-one/agreement-status-pill'

const FILTERS = [
  { key: 'all',         label: 'Todos' },
  { key: 'pendiente',   label: 'Pendientes' },
  { key: 'cumplido',    label: 'Cumplidos' },
  { key: 'parcial',     label: 'Parciales' },
  { key: 'no_cumplido', label: 'No cumplidos' },
] as const

interface OneOnOneRef {
  id: string
  scheduled_at: string
  leader: { id: string; full_name: string } | Array<{ id: string; full_name: string }> | null
}

interface AgreementRow {
  id: string
  description: string
  status: string
  due_date: string | null
  ai_generated: boolean
  created_at: string
  one_on_one: OneOnOneRef | OneOnOneRef[] | null
}

export default async function AcuerdosPage({
  searchParams,
}: { searchParams: { filter?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const activeFilter = (FILTERS.find(f => f.key === searchParams.filter)?.key) ?? 'all'

  const { data: rawAgreements } = await supabase
    .from('agreements')
    .select(`
      id, description, status, due_date, ai_generated, created_at,
      one_on_one:one_on_ones!agreements_one_on_one_id_fkey(
        id, scheduled_at,
        leader:users!one_on_ones_leader_id_fkey(id, full_name)
      )
    `)
    .eq('responsible_id', user.id)
    .order('created_at', { ascending: false })

  const all = (rawAgreements ?? []) as AgreementRow[]
  const filtered = activeFilter === 'all' ? all : all.filter(a => a.status === activeFilter)

  const counts = {
    total: all.length,
    pendiente: all.filter(a => a.status === 'pendiente').length,
    cumplido: all.filter(a => a.status === 'cumplido').length,
    no_cumplido: all.filter(a => a.status === 'no_cumplido').length,
  }

  const now = new Date()
  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  function formatShort(iso: string) {
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><CheckSquare size={12} /> Compromisos</span>
          <h1 className="page__title">Mis acuerdos</h1>
          <p className="page__subtitle">
            {counts.total} compromiso{counts.total === 1 ? '' : 's'} en total — {counts.pendiente} pendiente{counts.pendiente === 1 ? '' : 's'}.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }} className="anim-stagger">
        <div className="kpi">
          <div className="kpi__icon kpi__icon--blue"><CheckSquare /></div>
          <div className="kpi__label">Total</div>
          <div className="kpi__value u-tabular">{counts.total}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--amber"><CheckSquare /></div>
          <div className="kpi__label">Pendientes</div>
          <div className="kpi__value u-tabular">{counts.pendiente}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--green"><CheckSquare /></div>
          <div className="kpi__label">Cumplidos</div>
          <div className="kpi__value u-tabular">{counts.cumplido}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon kpi__icon--red"><CheckSquare /></div>
          <div className="kpi__label">No cumplidos</div>
          <div className="kpi__value u-tabular">{counts.no_cumplido}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'var(--text-muted)' }} />
        {FILTERS.map(f => {
          const isActive = activeFilter === f.key
          return (
            <Link
              key={f.key}
              href={f.key === 'all' ? '/colaborador/acuerdos' : `/colaborador/acuerdos?filter=${f.key}`}
              className={`ui-badge ui-badge--${isActive ? 'blue' : 'slate'}`}
              style={{ textDecoration: 'none', cursor: 'pointer' }}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">
              <CheckSquare size={15} /> {FILTERS.find(f => f.key === activeFilter)!.label}
            </h3>
            <p className="ui-card__desc">
              {filtered.length === 0
                ? 'Sin compromisos en este filtro'
                : `${filtered.length} compromiso${filtered.length === 1 ? '' : 's'} · clic en el estado para cambiarlo`}
            </p>
          </div>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          {filtered.length === 0 ? (
            <EmptyState
              illustration="list"
              title="Sin acuerdos en este filtro"
              description={activeFilter === 'all'
                ? 'Aparecerán aquí los compromisos que se generen al cerrar tus 1:1s.'
                : 'Prueba con otro filtro o vuelve cuando se generen más compromisos.'}
            />
          ) : (
            filtered.map(a => {
              const ref = Array.isArray(a.one_on_one) ? a.one_on_one[0] : a.one_on_one
              const leader = ref && (Array.isArray(ref.leader) ? ref.leader[0] : ref.leader)
              const overdue = a.status === 'pendiente' && !!a.due_date && new Date(a.due_date) < now
              return (
                <div key={a.id} className="list-row">
                  <div className="list-row__content">
                    <div className="list-row__title">
                      {a.ai_generated && <span className="ai-chip">IA</span>}
                      <span>{a.description}</span>
                    </div>
                    <div className="list-row__meta">
                      {a.due_date && (
                        <span style={{ color: overdue ? 'var(--red-700)' : 'var(--text-muted)' }}>
                          <Calendar size={11} /> Vence {formatDate(a.due_date)}
                        </span>
                      )}
                      <span>Creado {formatShort(a.created_at)}</span>
                      {ref && leader && (
                        <Link
                          href={`/colaborador/1to1/${ref.id}`}
                          style={{ color: 'var(--accent-500)' }}
                        >
                          1:1 con {leader.full_name.split(' ')[0]} · {formatShort(ref.scheduled_at)}
                        </Link>
                      )}
                    </div>
                  </div>
                  <AgreementStatusPill agreementId={a.id} status={a.status} overdue={overdue} />
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
