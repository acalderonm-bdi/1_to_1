import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BarChart2, AlertTriangle, FileText, CheckSquare } from 'lucide-react'

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

  const metrics = rawMetrics as Array<{
    department_id: string | null
    department_name: string | null
    compliance_rate: number | null
    realized_meetings: number | null
    total_meetings: number | null
  }> | null
  const monthMeetings = rawMeetings as Array<{ status: string }> | null
  const agreements = rawAgreements as Array<{ status: string }> | null

  const totalMeetings = monthMeetings?.length ?? 0
  const realized = monthMeetings?.filter(m => m.status === 'realizada').length ?? 0
  const disputed = monthMeetings?.filter(m => m.status === 'en_disputa').length ?? 0
  const missed = monthMeetings?.filter(m => m.status === 'no_realizada').length ?? 0

  const totalAgreements = agreements?.length ?? 0
  const fulfilled = agreements?.filter(a => a.status === 'cumplido').length ?? 0
  const pending = agreements?.filter(a => a.status === 'pendiente').length ?? 0

  const globalCompliance = totalMeetings > 0 ? Math.round((realized / totalMeetings) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Panel de Arquitectura Humana</h1>
        <p className="text-slate-500 mt-1">Visibilidad global del cumplimiento organizacional</p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-green-600">{globalCompliance}%</p>
            <p className="text-xs text-slate-500 mt-1">Cumplimiento global este mes</p>
            <p className="text-xs text-slate-400">{realized}/{totalMeetings} realizadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-red-500">{missed}</p>
            <p className="text-xs text-slate-500 mt-1">1:1s no realizadas</p>
            <p className="text-xs text-slate-400">este mes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-3xl font-bold text-orange-500">{disputed}</p>
                <p className="text-xs text-slate-500 mt-1">En disputa</p>
              </div>
              {disputed > 0 && (
                <Button asChild size="sm" variant="outline" className="text-xs">
                  <Link href="/arquitectura-humana/disputas">Ver</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-3xl font-bold text-blue-500">{unreviewedReports ?? 0}</p>
                <p className="text-xs text-slate-500 mt-1">Reportes IA sin revisar</p>
              </div>
              {(unreviewedReports ?? 0) > 0 && (
                <Button asChild size="sm" variant="outline" className="text-xs">
                  <Link href="/arquitectura-humana/reportes">Ver</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Acuerdos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckSquare className="h-8 w-8 text-slate-400" />
            <div>
              <p className="text-2xl font-bold">{pending}</p>
              <p className="text-xs text-slate-500">Acuerdos pendientes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckSquare className="h-8 w-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold">{fulfilled}</p>
              <p className="text-xs text-slate-500">Acuerdos cumplidos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <BarChart2 className="h-8 w-8 text-slate-400" />
            <div>
              <p className="text-2xl font-bold">{totalAgreements}</p>
              <p className="text-xs text-slate-500">Total de acuerdos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance por departamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cumplimiento por área</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(metrics ?? []).map(dept => (
              <div key={dept.department_id} className="flex items-center justify-between">
                <span className="text-sm font-medium">{dept.department_name}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-slate-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-green-500"
                      style={{ width: `${dept.compliance_rate ?? 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12 text-right">
                    {dept.compliance_rate ?? 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
