import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Calendar, Clock, Video, MapPin, CheckSquare, ArrowRight, Filter, AlertTriangle } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/constants'
import { EmptyState } from '@/components/shared/empty-state'

const STATUS_TONE: Record<string, string> = {
  agendada: 'blue', realizada: 'green', no_realizada: 'red', en_disputa: 'orange',
}

const FILTERS = [
  { key: 'all',          label: 'Todas' },
  { key: 'agendada',     label: 'Próximas' },
  { key: 'realizada',    label: 'Realizadas' },
  { key: 'no_realizada', label: 'No realizadas' },
  { key: 'en_disputa',   label: 'En disputa' },
] as const

interface MeetingRow {
  id: string; scheduled_at: string; modality: string; status: string; duration_minutes: number
  leader: { id: string; full_name: string } | Array<{ id: string; full_name: string }> | null
  agreements: Array<{ id: string; status: string }>
}

export default async function HistorialPage({
  searchParams,
}: { searchParams: { filter?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const activeFilter = (FILTERS.find(f => f.key === searchParams.filter)?.key) ?? 'all'

  const { data: raw } = await supabase
    .from('one_on_ones')
    .select(`
      id, scheduled_at, modality, status, duration_minutes,
      leader:users!one_on_ones_leader_id_fkey(id, full_name),
      agreements(id, status)
    `)
    .eq('collaborator_id', user.id)
    .order('scheduled_at', { ascending: false })
    .limit(50)

  const all = (raw ?? []) as MeetingRow[]
  const filtered = activeFilter === 'all' ? all : all.filter(m => m.status === activeFilter)

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Calendar size={12} /> Tu archivo</span>
          <h1 className="page__title">Historial de 1:1s</h1>
          <p className="page__subtitle">
            Todas tus reuniones, ordenadas de más reciente a más antigua. Hasta las últimas 50.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'var(--text-muted)' }} />
        {FILTERS.map(f => {
          const isActive = activeFilter === f.key
          return (
            <Link
              key={f.key}
              href={f.key === 'all' ? '/colaborador/historial' : `/colaborador/historial?filter=${f.key}`}
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
              <Calendar size={15} /> {FILTERS.find(f => f.key === activeFilter)!.label}
            </h3>
            <p className="ui-card__desc">
              {filtered.length === 0
                ? 'Sin reuniones en este filtro'
                : `${filtered.length} reunion${filtered.length === 1 ? '' : 'es'}`}
            </p>
          </div>
        </div>
        <div className="ui-card__body ui-card__body--flush">
          {filtered.length === 0 ? (
            <EmptyState
              illustration="meetings"
              title="Sin 1:1s en este filtro"
              description="Cuando se agenden o realicen 1:1s aparecerán aquí."
            />
          ) : (
            filtered.map(m => {
              const leader = Array.isArray(m.leader) ? m.leader[0] : m.leader
              const d = new Date(m.scheduled_at)
              const agreementCount = m.agreements.length
              const compliedCount = m.agreements.filter(a => a.status === 'cumplido').length
              return (
                <div key={m.id} className="list-row">
                  <div className="list-row__content">
                    <div className="list-row__title">
                      <span className={`ui-badge ui-badge--${STATUS_TONE[m.status] ?? 'slate'}`}>
                        {STATUS_LABELS[m.status]}
                      </span>
                      <span>1:1 con {leader?.full_name ?? 'líder'}</span>
                    </div>
                    <div className="list-row__meta">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} /> {d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · {d.toTimeString().slice(0, 5)}
                      </span>
                      {m.modality === 'virtual' ? <Video size={12} /> : <MapPin size={12} />}
                      <span>{m.duration_minutes} min</span>
                      {agreementCount > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckSquare size={11} /> {compliedCount}/{agreementCount} cumplidos
                        </span>
                      )}
                      {m.status === 'en_disputa' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--orange-700)' }}>
                          <AlertTriangle size={11} /> Disputa abierta
                        </span>
                      )}
                    </div>
                  </div>
                  <Link href={`/colaborador/1to1/${m.id}`} className="ui-btn ui-btn--outline ui-btn--sm list-row__action">
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
