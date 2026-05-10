import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'

const CATEGORY_LABELS: Record<string, string> = {
  desempeño: 'Desempeño',
  desarrollo: 'Desarrollo',
  bienestar: 'Bienestar',
  seguimiento: 'Seguimiento',
  feedback: 'Feedback',
}

export default async function InsightsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawInsights } = await supabase
    .from('ai_insights')
    .select('id, type, content, used, created_at, users!ai_insights_collaborator_id_fkey(full_name)')
    .eq('leader_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const insights = (rawInsights ?? []) as Array<{
    id: string; type: string; content: unknown; used: boolean; created_at: string;
    users: { full_name: string } | Array<{ full_name: string }> | null
  }>

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 anim-fade-in">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-[28px] font-medium tracking-tight">Insights del asistente</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
            Sugerencias contextuales para tus 1:1s, basadas en patrones de conversación y acuerdos.
          </p>
        </div>
        <Badge variant="brand"><Sparkles className="size-3" /> Asistente IA</Badge>
      </div>

      {insights.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Sparkles}
              title="Sin sugerencias por ahora"
              description="Las sugerencias del asistente aparecerán después de tus próximas 1:1s."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3.5 anim-stagger">
          {insights.map(insight => {
            const collab = Array.isArray(insight.users) ? insight.users[0] : insight.users
            const content = insight.content as Record<string, unknown>
            return (
              <Card key={insight.id} className="border-brand/30 bg-brand-muted/20">
                <CardContent className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="brand"><Sparkles className="size-3" /> Sugerencia</Badge>
                    <span className="text-[12px] text-muted-foreground">
                      {new Date(insight.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <h3 className="text-lg font-medium tracking-tight">
                    Para {collab?.full_name?.split(' ')[0] ?? 'tu colaborador'}
                  </h3>

                  <div className="grid gap-2.5 mt-4">
                    {insight.type === 'suggested_questions' && Array.isArray(content['questions']) &&
                      (content['questions'] as Array<{ question: string; rationale: string; category: string }>).map((q, i) => (
                        <div key={i} className="flex gap-3 p-3 rounded-md border bg-background">
                          <div className="size-6 rounded-full bg-brand-muted text-brand border border-brand/30 flex items-center justify-center text-[11px] font-medium font-mono-numeric shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13.5px] leading-relaxed m-0">{q.question}</p>
                            {q.rationale && <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">{q.rationale}</p>}
                            <Badge variant="muted" className="mt-2 text-[10.5px]">
                              {CATEGORY_LABELS[q.category] ?? q.category}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    {insight.type !== 'suggested_questions' && typeof content['description'] === 'string' && (
                      <p className="text-[13.5px] leading-relaxed">{content['description'] as string}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
