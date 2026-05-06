import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Clock } from 'lucide-react'

export default async function CadenciasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: globalCadenceRaw } = await supabase
    .from('cadence_configs')
    .select('id, frequency_days, scope_type')
    .eq('scope_type', 'global')
    .maybeSingle()

  const globalCadence = globalCadenceRaw as { id: string; frequency_days: number; scope_type: string } | null

  const { data: deptCadencesRaw } = await supabase
    .from('cadence_configs')
    .select('id, frequency_days, departments(name)')
    .eq('scope_type', 'department')

  const deptCadences = deptCadencesRaw as Array<{
    id: string
    frequency_days: number
    departments: { name: string } | Array<{ name: string }> | null
  }> | null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cadencias</h1>
        <p className="text-slate-500 mt-1">Frecuencia esperada de las reuniones 1:1</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Cadencia global
          </CardTitle>
          <CardDescription>Aplica a toda la organización cuando no hay cadencia específica</CardDescription>
        </CardHeader>
        <CardContent>
          {globalCadence ? (
            <div className="flex items-center gap-3">
              <div className="text-4xl font-bold text-slate-900">{globalCadence.frequency_days}</div>
              <div>
                <p className="font-medium">días entre 1:1s</p>
                <p className="text-sm text-slate-500">Cada {globalCadence.frequency_days} días</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Sin cadencia global configurada</p>
          )}
        </CardContent>
      </Card>

      {deptCadences && deptCadences.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cadencias por área</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deptCadences.map(c => {
                const dept = Array.isArray(c.departments) ? c.departments[0] : c.departments
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded border">
                    <span className="text-sm font-medium">{dept?.name ?? 'Área'}</span>
                    <span className="text-sm text-slate-600">Cada {c.frequency_days} días</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
