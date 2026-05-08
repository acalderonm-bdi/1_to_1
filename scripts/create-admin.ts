import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import ws from 'ws'

config({ path: '.env.local' })

// Node 20 lacks native WebSocket; supabase-js realtime needs one at construction.
;(globalThis as unknown as { WebSocket: unknown }).WebSocket = ws

async function main() {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  const email = process.env['ADMIN_EMAIL']
  const password = process.env['ADMIN_PASSWORD']
  const fullName = process.env['ADMIN_FULL_NAME'] ?? 'Administrador del Sistema'

  if (!supabaseUrl || !serviceKey || !email || !password) {
    throw new Error('Faltan variables de entorno para crear el admin')
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verificar si ya existe
  const { data: existing } = await supabase
    .from('users')
    .select('id, role')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    if (existing.role !== 'hr') {
      await supabase.from('users').update({ role: 'hr', full_name: fullName }).eq('id', existing.id)
      console.log('   Usuario existente actualizado a rol HR')
    } else {
      console.log('   Admin ya existe y tiene rol HR')
    }
    return
  }

  // Crear en auth.users
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (authErr) throw authErr

  // El trigger handle_new_user crea el registro en public.users con rol 'collaborator'
  // Actualizamos a 'hr'
  const { error: updateErr } = await supabase
    .from('users')
    .update({ role: 'hr', full_name: fullName })
    .eq('id', authUser.user!.id)

  if (updateErr) throw updateErr

  console.log(`   Admin creado: ${email}`)
}

main().catch(err => {
  console.error('Error creando admin:', err)
  process.exit(1)
})
