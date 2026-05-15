/**
 * Limpieza de la data seedeada por qa-all-notifs-ariel.ts y qa-dispute-flow.ts.
 * Idempotente — corrérlo varias veces no hace nada destructivo.
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
  // 1. Agreements [QA-NOTIF]
  const { data: agrs } = await sb
    .from('agreements')
    .select('id')
    .like('description', '[QA-NOTIF]%')
  const agrIds = (agrs ?? []).map((a) => (a as { id: string }).id)
  if (agrIds.length > 0) {
    await sb.from('agreements').delete().in('id', agrIds)
    console.log(`✓ Borrados ${agrIds.length} agreements [QA-NOTIF]`)
  }

  // 2. notification_rules [QA-NOTIF]
  await sb.from('notification_rules').delete().like('name', '[QA-NOTIF]%')
  console.log('✓ Borradas rules [QA-NOTIF]')

  // 3. notification_dispatches recientes de Ariel
  const cutoff = new Date(Date.now() - 86400000).toISOString()
  await sb.from('notification_dispatches').delete().eq('recipient_id', ARIEL_ID).gte('created_at', cutoff)
  console.log('✓ Borrados dispatches del último día de Ariel')

  // 4. 1:1s en_disputa creadas por seed (las que NO tienen Google Calendar event)
  const { data: disputed } = await sb
    .from('one_on_ones')
    .select('id, google_calendar_event_id, scheduled_at')
    .eq('status', 'en_disputa')
    .is('google_calendar_event_id', null)
  for (const m of (disputed ?? []) as Array<{ id: string }>) {
    await sb.from('one_on_ones').delete().eq('id', m.id)
  }
  console.log(`✓ Borradas ${disputed?.length ?? 0} 1:1s en_disputa sin Google Calendar (seed-data)`)

  // 5. notifications in-app recientes de Ariel
  await sb.from('notifications').delete().eq('user_id', ARIEL_ID).gte('created_at', cutoff)
  console.log('✓ Borradas in-app notifications del último día')

  console.log('\n=== Cleanup completo ===')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
