import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Settings } from 'lucide-react'
import { SettingsShell } from '@/components/settings/settings-shell'
import { WarmthTrendChart } from '@/components/arquitectura-humana/warmth-trend-chart'
import { NotificationPreferencesForm } from '@/components/configuracion/notification-preferences-form'
import { getMyPreferences } from '@/lib/actions/notification-preferences'

interface WarmthAggregate {
  leader_id: string
  response_count: number
  avg_felt_heard: number
  avg_comfortable_sharing: number
  avg_leader_engaged: number
  avg_conversation_quality: number
  avg_clarity_after_session: number
  avg_overall: number
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>{label}</p>
      <p style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>{Number(value).toFixed(1)}</p>
    </div>
  )
}

export default async function ConfiguracionLiderPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('users').select('full_name, email').eq('id', user.id).single()
  const profile = rawProfile as { full_name: string; email: string } | null

  // F6: agregados de calidez personales (líder ve solo agregados de su propio equipo).
  const aggQuery = await supabase
    .from('warmth_metrics_by_leader')
    .select('*')
    .eq('leader_id', user.id)
    .maybeSingle()
  // View row columns are nullable; the consumer (`Metric`) only renders when
  // there is at least one response, so map nulls to 0 at the boundary.
  const aggRow = aggQuery.data
  const agg: WarmthAggregate | null = aggRow && aggRow.leader_id
    ? {
        leader_id: aggRow.leader_id,
        response_count: aggRow.response_count ?? 0,
        avg_felt_heard: aggRow.avg_felt_heard ?? 0,
        avg_comfortable_sharing: aggRow.avg_comfortable_sharing ?? 0,
        avg_leader_engaged: aggRow.avg_leader_engaged ?? 0,
        avg_conversation_quality: aggRow.avg_conversation_quality ?? 0,
        avg_clarity_after_session: aggRow.avg_clarity_after_session ?? 0,
        avg_overall: aggRow.avg_overall ?? 0,
      }
    : null

  const trendQuery = await supabase
    .from('warmth_trend_by_leader_month')
    .select('month, avg_overall, response_count')
    .eq('leader_id', user.id)
    .order('month', { ascending: true })
    .limit(6)
  const trend = (trendQuery.data ?? [])
    .filter((r): r is { month: string; avg_overall: number | null; response_count: number | null } =>
      r.month !== null,
    )
    .map((r) => ({
      month: r.month,
      avg_overall: r.avg_overall ?? 0,
      response_count: r.response_count ?? 0,
    }))

  const prefsResult = await getMyPreferences()
  const initialPreferences = prefsResult.success ? (prefsResult.data ?? []) : []

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Settings size={12} /> Tu cuenta</span>
          <h1 className="page__title">Configuración</h1>
          <p className="page__subtitle">Personaliza tu experiencia en 1to1.</p>
        </div>
      </div>

      {agg ? (
        <section className="ui-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Tu calidez histórica</h3>
          <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1rem' }}>
            Promedio de las 5 dimensiones de tus colaboradores. Privado para vos.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <Metric label="Escucha" value={agg.avg_felt_heard} />
            <Metric label="Confianza" value={agg.avg_comfortable_sharing} />
            <Metric label="Presencia" value={agg.avg_leader_engaged} />
            <Metric label="Significado" value={agg.avg_conversation_quality} />
            <Metric label="Claridad" value={agg.avg_clarity_after_session} />
          </div>
          <WarmthTrendChart data={trend} />
        </section>
      ) : (
        <section className="ui-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Tu calidez histórica</h3>
          <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
            Aún no hay respuestas de calidez. Después de algunas 1:1 vas a poder ver acá tu promedio.
          </p>
        </section>
      )}

      <section style={{ marginBottom: '1rem' }}>
        <NotificationPreferencesForm initialPreferences={initialPreferences} />
      </section>

      <SettingsShell
        role="leader"
        user={{
          name: profile?.full_name ?? 'Usuario',
          email: profile?.email ?? '',
        }}
      />
    </div>
  )
}
