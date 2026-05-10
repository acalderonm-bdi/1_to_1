import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatPct } from '@/lib/utils/format'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'

type Tone = 'neutral' | 'success' | 'warning' | 'destructive'

const LEGEND: Array<{ tone: Tone; label: string; dot: string }> = [
  { tone: 'success', label: '≥ 80%', dot: 'bg-success' },
  { tone: 'warning', label: '60–79%', dot: 'bg-warning' },
  { tone: 'destructive', label: '< 60%', dot: 'bg-destructive' },
  { tone: 'neutral', label: 'Sin datos', dot: 'bg-muted-foreground/30' },
]

function rateToTone(rate: number | null, hasData: boolean): Tone {
  if (!hasData) return 'neutral'
  const r = rate ?? 0
  if (r >= 80) return 'success'
  if (r >= 60) return 'warning'
  return 'destructive'
}

export default async function MapaCalorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawMetrics } = await supabase
    .from('compliance_metrics')
    .select('*')
    .order('compliance_rate', { ascending: false })

  const metrics = (rawMetrics ?? []) as Array<{
    department_id: string | null; department_name: string | null;
    total_meetings: number | null; realized_meetings: number | null;
    disputed_meetings: number | null; total_agreements: number | null;
    fulfilled_agreements: number | null; compliance_rate: number | null
  }>

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 anim-fade-in">
      <div className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-[28px] font-medium tracking-tight">Mapa de calor</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Cumplimiento de 1:1s por área organizacional este mes.
          </p>
        </div>
        <div className="flex items-center gap-4 px-3.5 py-2 border rounded-md bg-card text-[11.5px] text-muted-foreground shrink-0">
          {LEGEND.map(l => (
            <span key={l.tone} className="inline-flex items-center gap-1.5">
              <span className={cn('size-2.5 rounded-sm', l.dot)} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 anim-stagger">
        {metrics.map(d => {
          const hasData = (d.total_meetings ?? 0) > 0
          const tone = rateToTone(d.compliance_rate, hasData)
          const accent =
            tone === 'success' ? 'text-success bg-success-muted' :
            tone === 'warning' ? 'text-warning bg-warning-muted' :
            tone === 'destructive' ? 'text-destructive bg-destructive/10' :
            'text-muted-foreground bg-secondary'
          const fill =
            tone === 'success' ? 'bg-success' :
            tone === 'warning' ? 'bg-warning' :
            tone === 'destructive' ? 'bg-destructive' :
            'bg-muted-foreground/30'
          const borderL =
            tone === 'success' ? 'border-l-success' :
            tone === 'warning' ? 'border-l-warning' :
            tone === 'destructive' ? 'border-l-destructive' :
            'border-l-border'
          return (
            <Card key={d.department_id} className={cn('p-5 flex flex-col gap-3.5 border-l-2', borderL)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[14.5px] font-medium tracking-tight">{d.department_name}</h3>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {hasData
                      ? `${d.realized_meetings ?? 0}/${d.total_meetings ?? 0} reuniones realizadas`
                      : 'Sin reuniones programadas'}
                  </p>
                </div>
                <span className={cn('inline-flex items-center justify-center size-8 rounded-md', accent)} aria-hidden="true">
                  <span className="size-2 rounded-full bg-current" />
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className={cn(
                  'font-mono-numeric text-[36px] font-medium leading-none tracking-tight',
                  hasData ? 'text-foreground' : 'text-muted-foreground/60'
                )}>
                  {formatPct(d.compliance_rate, { hasData })}
                </span>
              </div>

              <div className="h-1 rounded-full bg-secondary overflow-hidden">
                {hasData && <div className={cn('h-full rounded-full transition-[width]', fill)} style={{ width: `${d.compliance_rate ?? 0}%` }} />}
              </div>

              <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                <Stat label="Disputas" value={d.disputed_meetings ?? 0} />
                <Stat label="Acuerdos" value={d.total_agreements ?? 0} />
                <Stat label="Cumplidos" value={d.fulfilled_agreements ?? 0} />
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground font-medium">{label}</div>
      <div className="text-[15px] font-medium font-mono-numeric tabular-nums mt-0.5">{value}</div>
    </div>
  )
}
