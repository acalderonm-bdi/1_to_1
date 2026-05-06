import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { Sparkles } from 'lucide-react'

export default async function InsightsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: insights } = await supabase
    .from('ai_insights')
    .select('*, users!ai_insights_collaborator_id_fkey(full_name)')
    .eq('leader_id', user.id)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(20)

  const CATEGORY_COLORS: Record<string, string> = {
    suggested_questions: 'bg-blue-100 text-blue-800',
    followup_plan: 'bg-green-100 text-green-800',
    pattern_alert: 'bg-orange-100 text-orange-800',
  }

  const CATEGORY_LABELS: Record<string, string> = {
    suggested_questions: 'Preguntas sugeridas',
    followup_plan: 'Plan de seguimiento',
    pattern_alert: 'Alerta de patrón',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sugerencias de IA</h1>
        <p className="text-slate-500 mt-1">Recomendaciones personalizadas para tus próximas 1:1s</p>
      </div>

      {!insights?.length ? (
        <EmptyState
          icon={Sparkles}
          title="Sin sugerencias por ahora"
          description="Las sugerencias de IA aparecerán después de tus próximas 1:1s"
          className="py-16"
        />
      ) : (
        <div className="space-y-4">
          {insights.map(insight => {
            const collaborator = Array.isArray(insight.users) ? insight.users[0] : insight.users
            const content = insight.content as Record<string, unknown>
            return (
              <Card key={insight.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {collaborator?.full_name ?? 'Colaborador'}
                    </CardTitle>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${CATEGORY_COLORS[insight.type] ?? 'bg-slate-100 text-slate-700'}`}>
                      {CATEGORY_LABELS[insight.type] ?? insight.type}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {insight.type === 'suggested_questions' && Array.isArray(content['questions']) && (
                    <ul className="space-y-2">
                      {(content['questions'] as Array<{ question: string; category: string }>).map((q, i) => (
                        <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                          <span className="text-slate-400 shrink-0">{i + 1}.</span>
                          <span>{q.question}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {insight.type === 'followup_plan' && typeof content['summary'] === 'string' && (
                    <p className="text-sm text-slate-700">{content['summary']}</p>
                  )}
                  {insight.type === 'pattern_alert' && typeof content['description'] === 'string' && (
                    <p className="text-sm text-slate-700">{content['description']}</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
