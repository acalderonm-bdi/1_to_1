import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'

export default async function MapaCalorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  interface MetricRow {
    department_id: string | null
    department_name: string | null
    total_meetings: number | null
    realized_meetings: number | null
    missed_meetings: number | null
    disputed_meetings: number | null
    total_agreements: number | null
    fulfilled_agreements: number | null
    unfulfilled_agreements: number | null
    compliance_rate: number | null
  }

  const { data: rawMetrics } = await supabase
    .from('compliance_metrics')
    .select('*')
    .order('compliance_rate', { ascending: false })
  const metrics = rawMetrics as MetricRow[] | null

  function getHeatColor(rate: number | null): string {
    const r = rate ?? 0
    if (r >= 80) return 'bg-green-100 border-green-300'
    if (r >= 60) return 'bg-yellow-100 border-yellow-300'
    if (r >= 40) return 'bg-orange-100 border-orange-300'
    return 'bg-red-100 border-red-300'
  }

  function getBarColor(rate: number | null): string {
    const r = rate ?? 0
    if (r >= 80) return 'bg-green-500'
    if (r >= 60) return 'bg-yellow-500'
    if (r >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mapa de calor</h1>
        <p className="text-slate-500 mt-1">Cumplimiento de 1:1s por área</p>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> ≥80%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500" /> 60-79%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500" /> 40-59%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> &lt;40%</span>
      </div>

      {/* Grid de tarjetas de calor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(metrics ?? []).map(dept => (
          <div
            key={dept.department_id}
            className={cn('p-4 rounded-lg border-2', getHeatColor(dept.compliance_rate))}
          >
            <p className="font-semibold text-slate-800 mb-2">{dept.department_name}</p>
            <div className="flex items-end justify-between mb-2">
              <span className="text-3xl font-bold">{dept.compliance_rate ?? 0}%</span>
              <span className="text-xs text-slate-600">{dept.realized_meetings}/{dept.total_meetings} realizadas</span>
            </div>
            <div className="w-full bg-white/60 rounded-full h-2">
              <div
                className={cn('h-2 rounded-full', getBarColor(dept.compliance_rate))}
                style={{ width: `${dept.compliance_rate ?? 0}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-1 mt-3 text-xs text-slate-600">
              <div className="text-center">
                <p className="font-medium">{dept.disputed_meetings}</p>
                <p>disputas</p>
              </div>
              <div className="text-center">
                <p className="font-medium">{dept.total_agreements}</p>
                <p>acuerdos</p>
              </div>
              <div className="text-center">
                <p className="font-medium">{dept.fulfilled_agreements}</p>
                <p>cumplidos</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
