import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Repeat } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default async function CadenciasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: globalRaw } = await supabase
    .from('cadence_configs').select('id, frequency_days, scope_type')
    .eq('scope_type', 'global').maybeSingle()
  const globalCadence = globalRaw as { id: string; frequency_days: number; scope_type: string } | null

  const { data: deptRaw } = await supabase
    .from('cadence_configs').select('id, frequency_days, departments(name)')
    .eq('scope_type', 'department')
  const deptCadences = deptRaw as Array<{
    id: string; frequency_days: number;
    departments: { name: string } | Array<{ name: string }> | null
  }> | null

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 anim-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-medium tracking-tight">Cadencias</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Frecuencia esperada de las reuniones 1:1 a nivel global y por área.
        </p>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="size-4 text-muted-foreground" /> Cadencia global
          </CardTitle>
          <CardDescription>Aplica a toda la organización por defecto.</CardDescription>
        </CardHeader>
        <CardContent>
          {globalCadence ? (
            <div className="flex items-baseline gap-4">
              <span className="font-mono-numeric tabular-nums text-[64px] font-medium leading-none tracking-tight">
                {globalCadence.frequency_days}
              </span>
              <div>
                <div className="text-[14.5px] font-medium tracking-tight">días entre 1:1s</div>
                <div className="text-[12.5px] text-muted-foreground mt-0.5">
                  ≈ {Math.round(30 / globalCadence.frequency_days)} reuniones por mes
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">Sin cadencia global configurada.</p>
          )}
        </CardContent>
      </Card>

      {deptCadences && deptCadences.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cadencias por área</CardTitle>
            <CardDescription>Sobreescriben la cadencia global.</CardDescription>
          </CardHeader>
          <div className="divide-y">
            {deptCadences.map(c => {
              const dept = Array.isArray(c.departments) ? c.departments[0] : c.departments
              return (
                <div key={c.id} className="flex items-center justify-between px-6 py-3.5">
                  <span className="text-[13.5px] font-medium">{dept?.name ?? 'Área'}</span>
                  <span className="text-[13px] text-muted-foreground">
                    Cada <strong className="text-foreground font-medium tabular-nums">{c.frequency_days}</strong> días
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
