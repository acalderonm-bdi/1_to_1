import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'
import ws from 'ws'

config({ path: '.env.local' })

;(globalThis as unknown as { WebSocket: unknown }).WebSocket = ws

interface Check {
  name: string
  fn: () => Promise<void>
  optional?: boolean
}

async function checkSupabaseConnection() {
  const supabase = createClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['SUPABASE_SERVICE_ROLE_KEY']!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { error } = await supabase.from('users').select('count').limit(1)
  if (error) throw new Error(error.message)
}

async function checkTables() {
  const supabase = createClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['SUPABASE_SERVICE_ROLE_KEY']!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const tables = [
    'departments', 'users', 'leadership_relations', 'cadence_configs',
    'one_on_ones', 'agenda_items', 'minutes', 'agreements',
    'agreement_followups', 'vobos', 'ai_insights', 'ai_reports',
    'notifications', 'audit_logs',
  ]
  for (const table of tables) {
    const { error } = await supabase.from(table).select('count').limit(1)
    if (error) throw new Error(`Tabla "${table}" no encontrada: ${error.message}`)
  }
}

async function checkAdmin() {
  const supabase = createClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['SUPABASE_SERVICE_ROLE_KEY']!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const email = process.env['ADMIN_EMAIL']
  const { data } = await supabase.from('users').select('id, role').eq('email', email!).maybeSingle()
  if (!data) throw new Error(`Admin ${email} no encontrado`)
  if (data.role !== 'hr') throw new Error(`Admin ${email} no tiene rol HR`)
}

async function checkAnthropic() {
  const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] })
  await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'ok' }],
  })
}

async function checkGoogleOAuth() {
  if (!process.env['GOOGLE_CLIENT_ID'] || !process.env['GOOGLE_CLIENT_SECRET']) {
    throw new Error('GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET no configurados')
  }
}

async function checkSlack() {
  if (!process.env['SLACK_BOT_TOKEN']) {
    throw new Error('SLACK_BOT_TOKEN no configurado')
  }
}

async function checkResend() {
  if (!process.env['RESEND_API_KEY']) {
    throw new Error('RESEND_API_KEY no configurado')
  }
}

async function main() {
  console.log('\n   Ejecutando verificaciones...\n')

  const checks: Check[] = [
    { name: 'Conexión a Supabase', fn: checkSupabaseConnection },
    { name: 'Tablas creadas (14)', fn: checkTables },
    { name: 'Usuario admin existe', fn: checkAdmin },
    { name: 'API Anthropic responde', fn: checkAnthropic },
    { name: 'Google OAuth configurado', fn: checkGoogleOAuth, optional: true },
    { name: 'Slack configurado', fn: checkSlack, optional: true },
    { name: 'Resend configurado', fn: checkResend, optional: true },
  ]

  let hasError = false

  for (const check of checks) {
    try {
      await check.fn()
      console.log(`   ✅ ${check.name}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (check.optional) {
        console.log(`   ⚠️  ${check.name}: ${msg}`)
      } else {
        console.log(`   ❌ ${check.name}: ${msg}`)
        hasError = true
      }
    }
  }

  console.log('')

  if (hasError) {
    console.error('   ❌ Verificación fallida — revisa los errores anteriores')
    process.exit(1)
  }

  console.log('   Todas las verificaciones obligatorias pasaron')
}

main().catch(err => {
  console.error('Error en verify:', err)
  process.exit(1)
})
