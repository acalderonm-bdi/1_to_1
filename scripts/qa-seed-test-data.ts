/**
 * Seed temporal para validar EXTRA-2 y C.4.
 *
 * Acciones:
 *   1. (EXTRA-2) Garantizar que UN colab de Carolina tenga exactamente 1
 *      acuerdo pendiente y resto en otro status — para ver "1 pendiente"
 *      en singular.
 *   2. (C.4) Forzar la condición `is_transferred` en al menos un acuerdo
 *      abierto de Pedro Ramírez: cambia el `leader_id` de la meeting
 *      asociada a un líder distinto a Carolina, y limpia
 *      `transfer_banner_dismissed_at` del relation Carolina↔Pedro.
 *
 * Modo: solo lee/escribe vía SUPABASE_SERVICE_ROLE_KEY (bypassa RLS).
 *
 * El script imprime:
 *   - SQL inverso para revertir cada cambio
 *   - IDs modificados
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!url || !key) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  console.log('=== QA seed test data ===\n')

  // 0. Identificar a Carolina (líder.tech@demo.com)
  const { data: carolina } = await sb
    .from('users')
    .select('id, full_name, email')
    .eq('email', 'lider.tech@demo.com')
    .single()
  if (!carolina) {
    console.error('No encontré a Carolina (lider.tech@demo.com)')
    process.exit(1)
  }
  console.log(`Carolina: ${carolina.id}`)

  // 1. (EXTRA-2) Buscar un colab de Carolina con varios pendientes
  const { data: pedro } = await sb
    .from('users')
    .select('id, full_name, email')
    .eq('email', 'dev3@demo.com')
    .single()
  if (!pedro) {
    console.error('No encontré a Pedro (dev3@demo.com)')
    process.exit(1)
  }
  console.log(`Pedro:    ${pedro.id}\n`)

  // Encontrar acuerdos pendientes de Pedro en meetings de Carolina
  const { data: pedroMeetings } = await sb
    .from('one_on_ones')
    .select('id')
    .eq('leader_id', carolina.id)
    .eq('collaborator_id', pedro.id)
  const meetingIds = (pedroMeetings ?? []).map((m: any) => m.id)

  const { data: openAgreements } = await sb
    .from('agreements')
    .select('id, description, status, one_on_one_id, due_date')
    .eq('responsible_id', pedro.id)
    .in('one_on_one_id', meetingIds)
    .eq('status', 'pendiente')
    .order('created_at', { ascending: false })

  console.log(`Acuerdos pendientes actuales de Pedro: ${openAgreements?.length ?? 0}`)
  if ((openAgreements?.length ?? 0) === 0) {
    console.log('  → Creo un acuerdo pendiente para tener al menos 1')
    if (meetingIds[0]) {
      await sb.from('agreements').insert({
        one_on_one_id: meetingIds[0],
        responsible_id: pedro.id,
        description: '[QA-SEED] Pendiente único para ver singular',
        status: 'pendiente',
      })
    }
  } else if (openAgreements!.length > 1) {
    // Dejar 1 pendiente, marcar el resto como cumplido (revertible)
    const toClose = openAgreements!.slice(1).map((a: any) => a.id)
    console.log(`  → Cierro ${toClose.length} acuerdos (status='cumplido') para dejar 1`)
    console.log(`     Revertir con:`)
    console.log(`       UPDATE agreements SET status='pendiente' WHERE id IN ('${toClose.join("','")}');`)
    const { error } = await sb
      .from('agreements')
      .update({ status: 'cumplido' as never })
      .in('id', toClose)
    if (error) console.error(`     ERROR: ${error.message}`)
  } else {
    console.log('  → Ya tiene exactamente 1, no hago nada')
  }

  // 2. (C.4) Crear condición transferred + limpiar dismissed_at
  // Necesitamos: un agreement abierto cuya meeting tenga leader_id != Carolina.
  // Estrategia: temporalmente cambiar UNA meeting de Pedro a otro líder.
  const { data: otherLeader } = await sb
    .from('users')
    .select('id, email, full_name')
    .neq('id', carolina.id)
    .eq('role', 'leader')
    .limit(1)
    .single()
  if (!otherLeader) {
    console.error('No encontré otro líder para simular transferencia')
  } else {
    console.log(`\nOtro líder para simular transfer: ${otherLeader.email} (${otherLeader.id})`)

    // Buscar una meeting cualquiera de Pedro con Carolina que tenga acuerdo pendiente
    const { data: openAfter } = await sb
      .from('agreements')
      .select('id, one_on_one_id')
      .eq('responsible_id', pedro.id)
      .eq('status', 'pendiente')
      .in('one_on_one_id', meetingIds)
      .limit(1)
    const targetMeetingId = openAfter?.[0]?.one_on_one_id
    if (!targetMeetingId) {
      console.error('  → No quedó ningún pendiente para simular transfer (raro)')
    } else {
      console.log(`  → Meeting target: ${targetMeetingId}`)
      console.log(`     Revertir con:`)
      console.log(`       UPDATE one_on_ones SET leader_id='${carolina.id}' WHERE id='${targetMeetingId}';`)
      const { error: e1 } = await sb
        .from('one_on_ones')
        .update({ leader_id: otherLeader.id })
        .eq('id', targetMeetingId)
      if (e1) console.error(`     ERROR meeting: ${e1.message}`)
    }

    // Limpiar transfer_banner_dismissed_at del relation Carolina↔Pedro
    const { data: relation } = await sb
      .from('leadership_relations')
      .select('id, transfer_banner_dismissed_at')
      .eq('leader_id', carolina.id)
      .eq('collaborator_id', pedro.id)
      .is('ended_at', null)
      .single()
    if (relation) {
      console.log(`  → Relation Carolina↔Pedro: ${relation.id}`)
      console.log(`     dismissed_at actual: ${(relation as any).transfer_banner_dismissed_at}`)
      const { error: e2 } = await sb
        .from('leadership_relations')
        .update({ transfer_banner_dismissed_at: null } as never)
        .eq('id', relation.id)
      if (e2) console.error(`     ERROR relation: ${e2.message}`)
      else console.log(`     → seteado a NULL`)
    }
  }

  console.log('\n=== Seed listo ===')
  console.log(`Verificar en browser: http://localhost:3000/lider/colaborador/${pedro.id}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
