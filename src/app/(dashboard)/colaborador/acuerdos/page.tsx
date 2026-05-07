import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CheckSquare } from 'lucide-react'
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

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Mis acuerdos</h1>
          <p className="page__subtitle">{agreements.length} compromisos en total</p>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckSquare size={15} /> Todos
            </h3>
          </div>
        </div>
        <div className="ui-card__body" style={{ display: 'grid', gap: 10 }}>
          {agreements.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Sin acuerdos registrados. Aparecerán aquí cuando tengas tu primera 1:1.
            </div>
          ) : (
            agreements.map(a => (
              <div key={a.id} className="agreement">
                <div className="agreement__head">
                  <p className="agreement__desc">{a.description}</p>
                  <span className={`ui-badge ui-badge--${STATUS_TONE[a.status] ?? 'slate'}`}>{AGREEMENT_LABELS[a.status]}</span>
                </div>
                <div className="agreement__meta">
                  {a.due_date && <span className="agreement__meta-item">📅 {a.due_date}</span>}
                  {a.ai_generated && <span className="ai-chip">Sugerido por IA</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
