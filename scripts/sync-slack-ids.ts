/**
 * Sincroniza users.slack_user_id en Supabase usando Slack `users.lookupByEmail`.
 *
 * Para cada usuario en public.users con email no nulo:
 *   - Llama lookupByEmail en Slack
 *   - Si encuentra match, hace UPDATE de slack_user_id
 *   - Si no encuentra (users_not_found) o el email es bot, lo saltea
 *
 * Es idempotente — correrlo varias veces no genera duplicados.
 * Modo dry-run por default; pasá --apply para escribir a DB.
 */
import { WebClient } from '@slack/web-api'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const DRY_RUN = !process.argv.includes('--apply')

async function main() {
  const slackToken = process.env.SLACK_BOT_TOKEN
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!slackToken || !sbUrl || !sbKey) {
    console.error('Faltan SLACK_BOT_TOKEN, NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const slack = new WebClient(slackToken)
  const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } })

  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (sin escribir)' : 'APPLY (escribe a DB)'}\n`)

  const { data: users, error } = await sb
    .from('users')
    .select('id, email, full_name, role, slack_user_id')
    .not('email', 'is', null)
    .order('full_name')

  if (error) {
    console.error('Error leyendo users:', error.message)
    process.exit(1)
  }
  console.log(`Users en DB: ${users?.length ?? 0}\n`)

  let matched = 0
  let alreadySet = 0
  let notFound = 0
  let updated = 0

  for (const u of users ?? []) {
    const user = u as { id: string; email: string; full_name: string; role: string; slack_user_id: string | null }
    process.stdout.write(`[${user.full_name}] <${user.email}> ... `)

    try {
      const res = await slack.users.lookupByEmail({ email: user.email })
      if (!res.ok || !res.user) {
        console.log('no Slack user')
        notFound++
        continue
      }
      const slackId = res.user.id!
      matched++

      if (user.slack_user_id === slackId) {
        console.log(`ya seteado (${slackId})`)
        alreadySet++
        continue
      }

      if (DRY_RUN) {
        console.log(`MATCH ${slackId} (dry-run, no escribo)`)
      } else {
        const { error: upErr } = await sb
          .from('users')
          .update({ slack_user_id: slackId })
          .eq('id', user.id)
        if (upErr) {
          console.log(`ERROR UPDATE: ${upErr.message}`)
        } else {
          console.log(`UPDATED → ${slackId}`)
          updated++
        }
      }
    } catch (e: any) {
      if (e.data?.error === 'users_not_found') {
        console.log('no Slack user')
        notFound++
      } else {
        console.log(`Slack error: ${e.data?.error ?? e.message}`)
      }
    }
  }

  console.log('\n=== Resumen ===')
  console.log(`  Match Slack:    ${matched}`)
  console.log(`  Ya seteado:     ${alreadySet}`)
  console.log(`  No en Slack:    ${notFound}`)
  if (!DRY_RUN) console.log(`  Updated DB:     ${updated}`)
  else console.log(`  (re-correr con --apply para escribir a DB)`)
}

main().catch((e) => {
  console.error('FAIL:', e.message ?? e)
  process.exit(1)
})
