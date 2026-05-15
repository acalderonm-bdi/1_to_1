/**
 * Verifica que el bot pueda postear al SLACK_DEFAULT_CHANNEL.
 * Envía un mensaje de test (visible en el canal) y luego lo borra.
 */
import { WebClient } from '@slack/web-api'
import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const token = process.env.SLACK_BOT_TOKEN
  const channel = process.env.SLACK_DEFAULT_CHANNEL
  if (!token || !channel) {
    console.error('Faltan SLACK_BOT_TOKEN o SLACK_DEFAULT_CHANNEL')
    process.exit(1)
  }

  const client = new WebClient(token)

  console.log(`Posting test message to ${channel}...`)
  const post = await client.chat.postMessage({
    channel,
    text: '🧪 Test desde 1to1 — si ves este mensaje, el bot está bien configurado. (Se borra solo en 5 segundos.)',
  })

  if (!post.ok || !post.ts) {
    console.error('FAIL post:', post)
    process.exit(1)
  }
  console.log(`  ✓ Posted ts=${post.ts}`)

  await new Promise((r) => setTimeout(r, 5000))

  console.log('Deleting test message...')
  const del = await client.chat.delete({ channel, ts: post.ts })
  console.log(del.ok ? '  ✓ Deleted' : `  ✗ Could not delete: ${del.error}`)
}

main().catch((e) => {
  console.error('FAIL:', e.message ?? e)
  process.exit(1)
})
