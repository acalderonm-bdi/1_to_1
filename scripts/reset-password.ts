import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import ws from 'ws'

config({ path: '.env.local' })

;(globalThis as unknown as { WebSocket: unknown }).WebSocket = ws

async function main() {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  const email = process.argv[2]
  const newPassword = process.argv[3]

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  }
  if (!email || !newPassword) {
    throw new Error('Uso: tsx scripts/reset-password.ts <email> <nueva_password>')
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listErr) throw listErr

  const user = list.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) throw new Error(`No se encontró usuario con email ${email}`)

  const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword,
  })
  if (updErr) throw updErr

  console.log(`✓ Contraseña actualizada para ${email} (id: ${user.id})`)
}

main().catch(err => {
  console.error('Error:', err.message ?? err)
  process.exit(1)
})
