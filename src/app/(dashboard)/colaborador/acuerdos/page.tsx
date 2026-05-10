import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CheckSquare, Calendar, Sparkles } from 'lucide-react'
import { AGREEMENT_LABELS } from '@/lib/constants'
import { formatCount } from '@/lib/utils/format'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils/cn'

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'brand' | 'destructive'> = {
  pendiente: 'warning',
  cumplido: 'success',
  parcial: 'brand',
  no_cumplido: 'destructive',
}

export default async function AcuerdosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawAgreements } = await supabase
    .from('agreements')
    .select('id, description, status, due_date, ai_generated, created_at')
    .eq('responsible_id', user.id)
    .order('created_at', { ascending: false })

  const agreements = (rawAgreements ?? []) as Array<{
    id: string; description: string; status: string; due_date: string | null;
    ai_generated: boolean; created_at: string
  }>

  const counts = {
    total: agreements.length,
    pendiente: agreements.filter(a => a.status === 'pendiente').length,
    cumplido: agreements.filter(a => a.status === 'cumplido').length,
    no_cumplido: agreements.filter(a => a.status === 'no_cumplido').length,
  }

  function formatDueDate(due: string) {
    return new Date(due).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 anim-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-medium tracking-tight">Mis acuerdos</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          {counts.total} compromiso{counts.total === 1 ? '' : 's'} en total — {counts.pendiente} pendiente{counts.pendiente === 1 ? '' : 's'}.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6 anim-stagger">
        <KpiTile label="Total" value={counts.total} empty={counts.total === 0} icon={CheckSquare} />
        <KpiTile label="Pendientes" value={counts.pendiente} empty={counts.pendiente === 0} icon={CheckSquare} />
        <KpiTile label="Cumplidos" value={counts.cumplido} empty={counts.cumplido === 0} icon={CheckSquare} />
        <KpiTile label="No cumplidos" value={counts.no_cumplido} empty={counts.no_cumplido === 0} icon={CheckSquare} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="size-4 text-muted-foreground" /> Todos los acuerdos
          </CardTitle>
          <CardDescription>Ordenados por fecha de creación, más recientes primero.</CardDescription>
        </CardHeader>
        <div>
          {agreements.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="Sin acuerdos registrados"
              description="Aparecerán aquí los compromisos que se generen al cerrar tus 1:1s."
            />
          ) : (
            <div className="divide-y">
              {agreements.map(a => (
                <div key={a.id} className="px-6 py-3.5">
                  <div className="flex items-start gap-3">
                    <p className="flex-1 text-[13.5px] leading-relaxed">{a.description}</p>
                    <Badge variant={STATUS_VARIANT[a.status] ?? 'muted'}>
                      {AGREEMENT_LABELS[a.status]}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-[12px] text-muted-foreground items-center">
                    {a.due_date && (
                      <span className="inline-flex items-center gap-1"><Calendar className="size-3" /> Vence {formatDueDate(a.due_date)}</span>
                    )}
                    {a.ai_generated && <Badge variant="brand" className="text-[10.5px]"><Sparkles className="size-3" /> IA</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function KpiTile({
  label, value, empty, icon: Icon,
}: {
  label: string; value: number; empty: boolean; icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="px-5 py-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted-foreground">{label}</span>
        <span className="inline-flex items-center justify-center size-7 rounded-md bg-secondary text-muted-foreground">
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className={cn(
        'font-mono-numeric text-[28px] font-medium leading-none mt-1 tracking-tight',
        empty ? 'text-muted-foreground/70' : 'text-foreground'
      )}>
        {empty ? '—' : formatCount(value)}
      </div>
    </Card>
  )
}
