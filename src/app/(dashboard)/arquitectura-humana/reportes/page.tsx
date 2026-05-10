import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FileText, AlertTriangle, Repeat, MessageSquareWarning, CheckSquare, Building2, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils/cn'

const SEVERITY_LABELS: Record<string, string> = { info: 'Informativo', warning: 'Atención', critical: 'Crítico' }
const SEVERITY_VARIANT: Record<string, 'brand' | 'warning' | 'destructive'> = {
  info: 'brand',
  warning: 'warning',
  critical: 'destructive',
}
const SEVERITY_BORDER: Record<string, string> = {
  info: 'border-l-brand',
  warning: 'border-l-warning',
  critical: 'border-l-destructive',
}

type Category = 'cumplimiento' | 'cadencia' | 'disputa' | 'acuerdos' | 'engagement' | 'general'
const CATEGORY_LABELS: Record<Category, string> = {
  cumplimiento: 'Cumplimiento',
  cadencia: 'Cadencia',
  disputa: 'Disputa',
  acuerdos: 'Acuerdos',
  engagement: 'Engagement',
  general: 'Patrón',
}
const CATEGORY_ICONS: Record<Category, typeof FileText> = {
  cumplimiento: AlertTriangle,
  cadencia: Repeat,
  disputa: MessageSquareWarning,
  acuerdos: CheckSquare,
  engagement: FileText,
  general: FileText,
}

function categorize(title: string, content: string): Category {
  const text = `${title} ${content}`.toLowerCase()
  if (/disputa|vobo|contradictori/.test(text)) return 'disputa'
  if (/acuerdo|compromiso|incumpl/.test(text)) return 'acuerdos'
  if (/cadencia|frecuencia|ritmo|periodicidad/.test(text)) return 'cadencia'
  if (/cumplimiento|no.realizad|baja.tasa/.test(text)) return 'cumplimiento'
  if (/engagement|participaci|interés|asistenc/.test(text)) return 'engagement'
  return 'general'
}

export default async function ReportesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawReports } = await supabase
    .from('ai_reports').select('*').order('created_at', { ascending: false }).limit(50)
  const reports = (rawReports ?? []) as Array<{
    id: string; title: string; content: string; severity: string; scope_type: string; scope_id: string;
    reviewed: boolean; created_at: string
  }>

  const unreviewedCount = reports.filter(r => !r.reviewed).length

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 anim-fade-in">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-[28px] font-medium tracking-tight">Reportes del asistente</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
            {reports.length === 0
              ? 'El asistente publicará aquí los patrones organizacionales que detecte.'
              : `${unreviewedCount} sin revisar de ${reports.length} totales · patrones detectados automáticamente.`}
          </p>
        </div>
        <Badge variant="brand"><Sparkles className="size-3" /> Generado por IA</Badge>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FileText}
              title="Sin reportes por ahora"
              description="Aparecerán aquí cuando el asistente detecte patrones organizacionales relevantes."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3.5 anim-stagger">
          {reports.map(r => {
            const cat = categorize(r.title, r.content)
            const CatIcon = CATEGORY_ICONS[cat]
            return (
              <Card
                key={r.id}
                className={cn(
                  'border-l-2 transition-opacity',
                  SEVERITY_BORDER[r.severity] ?? 'border-l-border',
                  r.reviewed && 'opacity-65'
                )}
              >
                <div className="flex items-start justify-between gap-3 px-6 py-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant={SEVERITY_VARIANT[r.severity] ?? 'muted'}>
                        {SEVERITY_LABELS[r.severity]}
                      </Badge>
                      <Badge variant="muted" className="text-[10.5px]">
                        <CatIcon className="size-3" /> {CATEGORY_LABELS[cat]}
                      </Badge>
                      {r.scope_type === 'organization' && (
                        <Badge variant="muted" className="text-[10.5px]">
                          <Building2 className="size-3" /> Organización
                        </Badge>
                      )}
                      {r.reviewed && <Badge variant="muted" className="text-[10.5px]">Revisado</Badge>}
                    </div>
                    <h3 className="text-[16.5px] font-medium tracking-tight">{r.title}</h3>
                    <p className="text-[13.5px] leading-relaxed mt-2.5">{r.content}</p>
                  </div>
                  <span className="text-[11.5px] text-muted-foreground/70 whitespace-nowrap shrink-0">
                    {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
