import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Repeat } from 'lucide-react'

export default async function CadenciasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: globalRaw } = await supabase
    .from('cadence_configs').select('id, frequency_days, scope_type')
    .eq('scope_type', 'global').maybeSingle()
  const globalCadence = globalRaw as { id: string; frequency_days: number; scope_type: string } | null

  const { data: deptRaw } = await supabase
    .from('cadence_configs').select('id, frequency_days, departments(name)')
    .eq('scope_type', 'department')
  const deptCadences = deptRaw as Array<{
    id: string; frequency_days: number;
    departments: { name: string } | Array<{ name: string }> | null
  }> | null

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Repeat size={12} /> Ritmo de conversaciones</span>
          <h1 className="page__title">Cadencias</h1>
          <p className="page__subtitle">Frecuencia esperada de las reuniones 1:1 a nivel global y por área.</p>
        </div>
      </div>

      <div className="ui-card" style={{ marginBottom: 18 }}>
        <div className="ui-card__head">
          <div>
            <h3 className="ui-card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Repeat size={15} /> Cadencia global
            </h3>
            <p className="ui-card__desc">Aplica a toda la organización por defecto</p>
          </div>
        </div>
        <div className="ui-card__body">
          {globalCadence ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <span
                className="u-tabular"
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 64,
                  fontWeight: 500,
                  letterSpacing: '-0.028em',
                  lineHeight: 1,
                  color: 'var(--text-c)',
                  background: 'linear-gradient(135deg, var(--accent-700), var(--slate-900))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {globalCadence.frequency_days}
              </span>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 500, letterSpacing: '-0.005em' }}>días entre 1:1s</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  ≈ {Math.round(30 / globalCadence.frequency_days)} reuniones por mes
                </div>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin cadencia global configurada.</p>
          )}
        </div>
      </div>

      {deptCadences && deptCadences.length > 0 && (
        <div className="ui-card">
          <div className="ui-card__head">
            <div>
              <h3 className="ui-card__title">Cadencias por área</h3>
              <p className="ui-card__desc">Sobreescriben la cadencia global</p>
            </div>
          </div>
          <div className="ui-card__body ui-card__body--flush">
            {deptCadences.map(c => {
              const dept = Array.isArray(c.departments) ? c.departments[0] : c.departments
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--border-c)' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>{dept?.name ?? 'Área'}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cada <strong style={{ color: 'var(--text-c)' }}>{c.frequency_days}</strong> días</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
