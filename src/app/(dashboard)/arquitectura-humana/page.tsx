import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TrendingUp, AlertTriangle, FileText, CheckSquare, ArrowRight, Calendar } from 'lucide-react'
import { formatPct, formatCount } from '@/lib/utils/format'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type Tone = 'neutral' | 'success' | 'warning' | 'destructive' | 'brand'

export default async function ArquitecturaHumanaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [
    { data: rawMetrics },
    { count: unreviewedReports },
    { data: rawMeetings },
    { data: rawAgreements },
  ] = await Promise.all([
    supabase.from('compliance_metrics').select('*').order('compliance_rate', { ascending: true }),
    supabase.from('ai_reports').select('id', { count: 'exact', head: true }).eq('reviewed', false),
    supabase.from('one_on_ones').select('status').gte('scheduled_at', startOfMonth.toISOString()),
    supabase.from('agreements').select('status'),
  ])

  const metrics = (rawMetrics ?? []) as Array<{
    department_id: string | null; department_name: string | null;
    compliance_rate: number | null; realized_meetings: number | null; total_meetings: number | null
  }>
  const monthMeetings = (rawMeetings ?? []) as Array<{ status: string }>
  const agreements = (rawAgreements ?? []) as Array<{ status: string }>

  const totalMeetings = monthMeetings.length
  const realized = monthMeetings.filter(m => m.status === 'realizada').length
  const disputed = monthMeetings.filter(m => m.status === 'en_disputa').length
  const missed = monthMeetings.filter(m => m.status === 'no_realizada').length
  const fulfilled = agreements.filter(a => a.status === 'cumplido').length
  const pending = agreements.filter(a => a.status === 'pendiente').length
  const globalCompliance = totalMeetings > 0 ? Math.round((realized / totalMeetings) * 100) : 0

  const hasMeetingData = totalMeetings > 0

  function rateToTone(rate: number, hasData: boolean): Tone {
    if (!hasData) return 'neutral'
    if (rate >= 80) return 'success'
    if (rate >= 60) return 'warning'
    return 'destructive'
  }

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 anim-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-medium tracking-tight">Panel de Arquitectura Humana</h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
          Visibilidad organizacional del cumplimiento, acuerdos y salud de las conversaciones 1:1.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-4 anim-stagger">
        <Kpi
          label="Cumplimiento"
          value={formatPct(globalCompliance, { hasData: hasMeetingData })}
          icon={TrendingUp}
          empty={!hasMeetingData}
          tone={rateToTone(globalCompliance, hasMeetingData)}
          hint={hasMeetingData ? `${realized}/${totalMeetings} realizadas` : 'Sin reuniones este mes'}
        />
        <Kpi
          label="No realizadas"
          value={hasMeetingData ? String(missed) : '—'}
          icon={Calendar}
          empty={!hasMeetingData || missed === 0}
          tone={missed > 0 ? 'destructive' : 'neutral'}
          hint="este mes"
        />
        <Kpi
          label="En disputa"
          value={hasMeetingData ? String(disputed) : '—'}
          icon={AlertTriangle}
          empty={disputed === 0}
          tone={disputed > 0 ? 'warning' : 'neutral'}
          hint="requieren revisión"
        />
        <Kpi
          label="Reportes IA"
          value={formatCount(unreviewedReports, { hasData: (unreviewedReports ?? 0) > 0 })}
          icon={FileText}
          empty={(unreviewedReports ?? 0) === 0}
          tone={(unreviewedReports ?? 0) > 0 ? 'brand' : 'neutral'}
          hint="sin revisar"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-7 anim-stagger">
        <Kpi label="Acuerdos pendientes" value={formatCount(pending, { hasData: pending > 0 })} icon={CheckSquare} empty={pending === 0} tone={pending > 0 ? 'warning' : 'neutral'} />
        <Kpi label="Acuerdos cumplidos" value={formatCount(fulfilled, { hasData: fulfilled > 0 })} icon={CheckSquare} empty={fulfilled === 0} tone={fulfilled > 0 ? 'success' : 'neutral'} />
        <Kpi label="Total de acuerdos" value={formatCount(agreements.length, { hasData: agreements.length > 0 })} icon={CheckSquare} empty={agreements.length === 0} tone="neutral" />
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-muted-foreground" /> Cumplimiento por área
            </CardTitle>
            <CardDescription>Ordenado de menor a mayor cumplimiento.</CardDescription>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/arquitectura-humana/mapa-calor">Ver mapa de calor <ArrowRight className="size-3" /></Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3.5">
          {metrics.map(d => {
            const rate = d.compliance_rate ?? 0
            const areaHasData = (d.total_meetings ?? 0) > 0
            const tone = rateToTone(rate, areaHasData)
            const fillClass =
              tone === 'success' ? 'bg-success' :
              tone === 'warning' ? 'bg-warning' :
              tone === 'destructive' ? 'bg-destructive' :
              'bg-muted-foreground/30'
            return (
              <div key={d.department_id} className="grid grid-cols-[180px_1fr_60px] items-center gap-4">
                <span className="text-[13.5px] font-medium tracking-tight truncate">{d.department_name}</span>
                <div className="h-1 rounded-full bg-secondary overflow-hidden">
                  {areaHasData && <div className={cn('h-full rounded-full transition-[width]', fillClass)} style={{ width: `${rate}%` }} />}
                </div>
                <span className={cn(
                  'text-right text-[14px] font-medium font-mono-numeric tabular-nums',
                  !areaHasData && 'text-muted-foreground/70'
                )}>
                  {formatPct(rate, { hasData: areaHasData })}
                </span>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function Kpi({
  label, value, icon: Icon, hint, empty, tone,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  hint?: string
  empty: boolean
  tone: Tone
}) {
  const iconBg =
    empty ? 'bg-secondary text-muted-foreground' :
    tone === 'success' ? 'bg-success-muted text-success' :
    tone === 'warning' ? 'bg-warning-muted text-warning' :
    tone === 'destructive' ? 'bg-destructive/10 text-destructive' :
    tone === 'brand' ? 'bg-brand-muted text-brand' :
    'bg-secondary text-foreground'

  return (
    <Card className="px-5 py-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted-foreground">{label}</span>
        <span className={cn('inline-flex items-center justify-center size-7 rounded-md', iconBg)}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className={cn(
        'font-mono-numeric text-[28px] font-medium leading-none mt-1 tracking-tight',
        empty ? 'text-muted-foreground/70' : 'text-foreground'
      )}>
        {value}
      </div>
      {hint && <div className="text-[11.5px] text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  )
}
