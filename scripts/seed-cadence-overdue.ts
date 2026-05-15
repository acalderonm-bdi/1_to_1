/**
 * Seed: garantiza que la relación Ariel↔colab no tenga 1:1 realizada
 * en los últimos `cadenceDays` (default 14). Esto fuerza que el cron
 * check-cadence detecte cadencia vencida y mande un DM a Ariel.
 *
 * Acciones:
 *   - Lee la relación de Ariel como líder
 *   - Lista 1:1s con status='realizada' (si hay) → mueve scheduled_at hacia
 *     hace > 30 días (no las borra, solo las "envejece")
 *
 * Reversible: imprime SQL inverso para restaurar las fechas originales.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const ARIEL_ID = '37d45ceb-706c-497a-a735-83e4de4dd88a'

async function main() {
  // 1. Obtener relación de Ariel
  const { data: rel } = await sb
    .from('leadership_relations')
    .select('id, collaborator_id')
    .eq('leader_id', ARIEL_ID)
    .is('ended_at', null)
    .limit(1)
    .single()
  if (!rel) {
    console.error('Ariel no tiene colab asignado')
    process.exit(1)
  }
  const collabId = (rel as any).collaborator_id
  console.log(`Relación: líder=Ariel colab=${collabId}\n`)

  // 2. Buscar 1:1s recientes (últimos 30 días) con status='realizada'
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const { data: recent } = await sb
    .from('one_on_ones')
    .select('id, scheduled_at, status')
    .eq('leader_id', ARIEL_ID)
    .eq('collaborator_id', collabId)
    .eq('status', 'realizada')
    .gte('scheduled_at', cutoff.toISOString())

  console.log(`1:1s "realizada" en últimos 30 días: ${recent?.length ?? 0}`)

  if (!recent || recent.length === 0) {
    console.log('No hay nada que envejecer — ya estás en condición de cadencia vencida ✓')
  } else {
    // Mover cada una hacia 35 días atrás (5 días más allá del cutoff)
    const newDate = new Date()
    newDate.setDate(newDate.getDate() - 35)
    const newIso = newDate.toISOString()

    console.log('\n📝 SQL inverso (para revertir):')
    for (const m of recent as any[]) {
      console.log(`  UPDATE one_on_ones SET scheduled_at='${m.scheduled_at}' WHERE id='${m.id}';`)
    }

    console.log('\n→ Envejeciendo a -35 días...')
    for (const m of recent as any[]) {
      const { error } = await sb
        .from('one_on_ones')
        .update({ scheduled_at: newIso })
        .eq('id', m.id)
      console.log(`  ${error ? '✗ ' + error.message : '✓'} ${m.id}`)
    }
  }

  // 3. Asegurar que existe global cadence_config = 14 días
  const { data: cadence } = await sb
    .from('cadence_configs')
    .select('id, frequency_days')
    .eq('scope_type', 'global')
    .maybeSingle()
  if (!cadence) {
    console.log('\nSin cadence_config global → insertando con 14 días...')
    await sb.from('cadence_configs').insert({ scope_type: 'global', frequency_days: 14 } as never)
  } else {
    console.log(`\nCadence global: ${(cadence as any).frequency_days} días ✓`)
  }

  console.log('\n=== Listo. Ahora dispará el cron: ===')
  console.log(`  curl -H "Authorization: Bearer ${process.env.CRON_SECRET}" http://localhost:3000/api/cron/check-cadence`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
