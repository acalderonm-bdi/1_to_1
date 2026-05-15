/**
 * Inventario: muestra el rol de Ariel, qué notification_rules existen,
 * y qué triggers están cableados a Slack realmente vs. solo registrados en DB.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

async function main() {
  const { data: ariel } = await sb
    .from('users')
    .select('id, full_name, email, role, slack_user_id, department_id')
    .eq('email', 'acalderonm@b-drive.com.mx')
    .single()
  console.log('=== Ariel en DB ===')
  console.log(ariel)

  console.log('\n=== Notification rules existentes ===')
  const { data: rules } = await sb
    .from('notification_rules' as never)
    .select('id, name, trigger_type, channels, audience, enabled, threshold')
  for (const r of (rules ?? []) as any[]) {
    console.log(`  [${r.enabled ? '✓' : '✗'}] ${r.name} | trigger=${r.trigger_type} | channels=${JSON.stringify(r.channels)} | audience=${JSON.stringify(r.audience)} | threshold=${JSON.stringify(r.threshold)}`)
  }

  console.log('\n=== Leadership relations de Ariel (como líder) ===')
  const { data: relLeader } = await sb
    .from('leadership_relations')
    .select('id, collaborator_id, started_at, ended_at')
    .eq('leader_id', (ariel as any)?.id ?? '')
    .is('ended_at', null)
  console.log(`  ${relLeader?.length ?? 0} colab(s)`)
  for (const r of (relLeader ?? []) as any[]) {
    console.log(`    relation=${r.id} colab=${r.collaborator_id}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
