import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CheckSquare, Calendar } from 'lucide-react'
import { AGREEMENT_LABELS } from '@/lib/constants'

const STATUS_TONE: Record<string, string> = {
  pendiente: 'amber',
  cumplido: 'green',
  parcial: 'blue',
  no_cumplido: 'red',
}

export default async function AcuerdosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawAgreements } = await supabase
    .from('agreements')
    .select('id, description, status, due_date, ai_generated, created_at')
    .eq('responsible_id', user.id)
    .order('created_at', { ascending: false })

  const agreements = (rawAgreements ?? []) as Array<{
    id: string; description: string; status: string; due_date: string | null;
    ai_generated: boolean; created_at: string
  }>

  const counts = {
    total: agreements.length,
    pendiente: agreements.filter(a => a.status === 'pendiente').length,
    cumplido: agreements.filter(a => a.status === 'cumplido').length,
    no_cumplido: agreements.filter(a => a.status === 'no_cumplido').length,
  }

  function formatDueDate(due: string) {
    return new Date(due).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }} className="anim-stagger">
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

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title">
              <CheckSquare size={15} /> Todos los acuerdos
            </h3>
            <p className="ui-card__desc">Ordenados por fecha de creación, más recientes primero</p>
          </div>
        </div>
        <div className="ui-card__body" style={{ display: 'grid', gap: 10 }}>
          {agreements.length === 0 ? (
            <div className="empty">
              <div className="empty__icon"><CheckSquare /></div>
              <h3 className="empty__title">Sin acuerdos registrados</h3>
              <p className="empty__desc">
                Aparecerán aquí los compromisos que se generen al cerrar tus 1:1s.
              </p>
            </div>
          ) : (
            agreements.map(a => (
              <div key={a.id} className="agreement">
                <div className="agreement__head">
                  <p className="agreement__desc">{a.description}</p>
                  <span className={`ui-badge ui-badge--${STATUS_TONE[a.status] ?? 'slate'}`}>
                    {AGREEMENT_LABELS[a.status]}
                  </span>
                </div>
                <div className="agreement__meta">
                  {a.due_date && (
                    <span className="agreement__meta-item">
                      <Calendar size={13} /> Vence {formatDueDate(a.due_date)}
                    </span>
                  )}
                  {a.ai_generated && <span className="ai-chip">IA</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
