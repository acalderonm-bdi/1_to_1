/**
 * Verifica que el SLACK_BOT_TOKEN funciona contra la API real.
 * Llama `auth.test` que es read-only e idempotente.
 */
import { WebClient } from '@slack/web-api'
import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    console.error('Falta SLACK_BOT_TOKEN en .env.local')
    process.exit(1)
  }

  const client = new WebClient(token)
  const res = await client.auth.test()
  console.log('Slack auth.test response:')
  console.log({
    ok: res.ok,
    bot_id: res.bot_id,
    user_id: res.user_id,
    team: res.team,
    team_id: res.team_id,
    url: res.url,
    user: res.user,
  })
}

main().catch((e) => {
  console.error('FAIL:', e.message ?? e)
  process.exit(1)
})
