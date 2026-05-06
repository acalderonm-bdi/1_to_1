import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { FileText } from 'lucide-react'
import { formatRelative } from '@/lib/utils/dates'
import { SEVERITY_LABELS } from '@/lib/constants'
import type { AIReport } from '@/types/domain'

export default async function ReportesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: reports } = await supabase
    .from('ai_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const SEVERITY_COLORS: Record<string, string> = {
    info: 'bg-blue-100 text-blue-800',
    warning: 'bg-yellow-100 text-yellow-800',
    critical: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reportes de IA</h1>
        <p className="text-slate-500 mt-1">Patrones y alertas detectadas automáticamente</p>
      </div>

      {!reports?.length ? (
        <EmptyState
          icon={FileText}
          title="Sin reportes por ahora"
          description="Los reportes de IA aparecerán aquí cuando se detecten patrones relevantes"
          className="py-16"
        />
      ) : (
        <div className="space-y-4">
          {(reports as AIReport[]).map(report => (
            <Card key={report.id} className={report.reviewed ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-sm font-semibold">{report.title}</CardTitle>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${SEVERITY_COLORS[report.severity] ?? ''}`}>
                      {SEVERITY_LABELS[report.severity]}
                    </span>
                    {report.reviewed && (
                      <Badge variant="outline" className="text-xs">Revisado</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <p className="text-sm text-slate-600">{report.content}</p>
                <p className="text-xs text-slate-400">{formatRelative(report.created_at)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
