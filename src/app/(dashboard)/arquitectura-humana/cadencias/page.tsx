import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Repeat } from 'lucide-react'
import { CadenceEditor } from '@/components/arquitectura-humana/cadence-editor'

export default async function CadenciasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: globalRaw } = await supabase
    .from('cadence_configs')
    .select('frequency_days')
    .eq('scope_type', 'global')
    .maybeSingle()
  const initialGlobal = (globalRaw as { frequency_days: number } | null)?.frequency_days ?? null

  // The cadence_configs schema uses `scope_id` (not `department_id`) without a
  // declared FK to departments, so fetch names separately.
  const { data: deptRaw } = await supabase
    .from('cadence_configs')
    .select('id, frequency_days, scope_id')
    .eq('scope_type', 'department')
  const deptRows = (deptRaw ?? []) as Array<{
    id: string
    frequency_days: number
    scope_id: string | null
  }>

  const { data: allDeptsRaw } = await supabase.from('departments').select('id, name').order('name')
  const allDepts = (allDeptsRaw ?? []) as Array<{ id: string; name: string }>
  const deptNameById = new Map(allDepts.map((d) => [d.id, d.name]))

  const initialDepts = deptRows
    .filter((r): r is { id: string; frequency_days: number; scope_id: string } => !!r.scope_id)
    .map((c) => ({
      id: c.id,
      name: deptNameById.get(c.scope_id) ?? 'Área',
      freq: c.frequency_days,
      departmentId: c.scope_id,
    }))

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="page__eyebrow"><Repeat size={12} /> Ritmo de conversaciones</span>
          <h1 className="page__title">Cadencias</h1>
          <p className="page__subtitle">Frecuencia esperada de las reuniones 1:1 a nivel global y por área.</p>
        </div>
      </div>

      <CadenceEditor
        initialGlobal={initialGlobal}
        initialDepts={initialDepts}
        allDepts={allDepts}
      />
    </div>
  )
}
