/**
 * Test directo del helper notifyMissedMeeting — manda un DM al primer usuario
 * con slack_user_id en DB. Validación end-to-end de la integración Slack.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { notifyMissedMeeting } from '../src/lib/slack/notify'

config({ path: '.env.local' })

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: user } = await sb
    .from('users')
    .select('id, full_name, email, slack_user_id')
    .not('slack_user_id', 'is', null)
    .limit(1)
    .single()

  if (!user) {
    console.error('Ningún user tiene slack_user_id seteado')
    process.exit(1)
  }
  const u = user as { full_name: string; slack_user_id: string }
  console.log(`Mandando DM de test a ${u.full_name} (${u.slack_user_id})...`)

  const result = await notifyMissedMeeting(
    u.slack_user_id,
    u.full_name,
    'Pedro Ramírez (test)',
    7,
  )
  console.log('Resultado:', result)
}

main().catch((e) => {
  console.error('FAIL:', e.message ?? e)
  process.exit(1)
})
