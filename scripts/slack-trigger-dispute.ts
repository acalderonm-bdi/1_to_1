/**
 * Dispara realmente una disputa para validar el wire en markNonRealization.
 *
 * Pasos:
 *   1. Toma una meeting realizada de Ariel↔colab (o crea una)
 *   2. Marca status='no_realizada' con motivo X (simulando que el colab marcó X)
 *   3. Llama markNonRealization simulando que Ariel (líder) marca con motivo Y
 *      → goToDispute=true → debería disparar notifyDispute
 *
 * Limitación: markNonRealization es una server action que necesita una sesión
 * autenticada. La invocamos directamente desde Node simulando el flow vía
 * inserts/updates a DB y disparando notifyDispute directamente — replicando
 * lo que el código de prod hace tras un UPDATE exitoso.
 *
 * NOTA: este test NO ejecuta la action real (requiere browser/cookies).
 * Lo que valida es: que el HELPER notifyDispute (re-cableado en la action)
 * efectivamente envía al canal. Para test end-to-end de la action vía UI,
 * abrí dos sesiones (líder y colab) y marcá cada uno con motivo distinto.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { notifyDispute } from '../src/lib/slack/notify'

config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)
const ARIEL = '37d45ceb-706c-497a-a735-83e4de4dd88a'

async function main() {
  const channel = process.env.SLACK_DEFAULT_CHANNEL
  if (!channel) {
    console.error('Falta SLACK_DEFAULT_CHANNEL')
    process.exit(1)
  }

  const { data: rel } = await sb
    .from('leadership_relations')
    .select('collaborator_id')
    .eq('leader_id', ARIEL)
    .is('ended_at', null)
    .limit(1)
    .single()
  if (!rel) {
    console.error('Ariel sin colab')
    process.exit(1)
  }
  const collabId = (rel as any).collaborator_id

  const { data: meeting } = await sb
    .from('one_on_ones')
    .select('id, scheduled_at, leader_id, collaborator_id')
    .eq('leader_id', ARIEL)
    .eq('collaborator_id', collabId)
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .single()

  if (!meeting) {
    console.error('Sin 1:1 para usar')
    process.exit(1)
  }
  const m = meeting as { id: string; scheduled_at: string; leader_id: string; collaborator_id: string }

  // Resolver nombres como lo hace el wire
  const { data: people } = await sb
    .from('users')
    .select('id, full_name')
    .in('id', [m.leader_id, m.collaborator_id])
  const leader = (people as any[])?.find((p) => p.id === m.leader_id)
  const collab = (people as any[])?.find((p) => p.id === m.collaborator_id)
  const meetingDate = new Date(m.scheduled_at).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  console.log(`Disparando notifyDispute (replica del wire en markNonRealization)`)
  console.log(`  leader=${leader?.full_name} collab=${collab?.full_name} fecha=${meetingDate} id=${m.id}`)
  const res = await notifyDispute(
    channel,
    leader?.full_name ?? 'Líder',
    collab?.full_name ?? 'Colaborador',
    meetingDate,
    m.id,
  )
  console.log('Resultado:', res)
}

main().catch((e) => {
  console.error('FAIL:', e.message ?? e)
  process.exit(1)
})
