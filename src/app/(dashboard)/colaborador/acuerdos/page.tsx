import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { CheckSquare } from 'lucide-react'
import { AGREEMENT_LABELS } from '@/lib/constants'
import type { Agreement } from '@/types/domain'

export default async function AcuerdosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: agreements } = await supabase
    .from('agreements')
    .select('*')
    .eq('responsible_id', user.id)
    .order('created_at', { ascending: false })

  const STATUS_COLORS: Record<string, string> = {
    pendiente: 'bg-yellow-100 text-yellow-800',
    cumplido: 'bg-green-100 text-green-800',
    parcial: 'bg-blue-100 text-blue-800',
    no_cumplido: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mis acuerdos</h1>
        <p className="text-slate-500 mt-1">Todos los compromisos de tus 1:1s</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckSquare className="h-4 w-4" />
            {agreements?.length ?? 0} acuerdos en total
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!agreements?.length ? (
            <EmptyState
              title="Sin acuerdos registrados"
              description="Los acuerdos de tus 1:1s aparecerán aquí"
              className="py-12"
            />
          ) : (
            <div className="space-y-3">
              {(agreements as Agreement[]).map(agr => (
                <div key={agr.id} className="flex items-start justify-between p-4 rounded-lg border hover:border-slate-300 transition-colors">
                  <div className="space-y-1 flex-1 mr-4">
                    <p className="text-sm font-medium">{agr.description}</p>
                    {agr.due_date && (
                      <p className="text-xs text-slate-500">Vence: {agr.due_date}</p>
                    )}
                    {agr.ai_generated && (
                      <p className="text-xs text-slate-400">✦ Generado por IA</p>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${STATUS_COLORS[agr.status] ?? ''}`}>
                    {AGREEMENT_LABELS[agr.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
