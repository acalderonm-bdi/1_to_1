import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

type GuardResultOk = {
  ok: true
  user: { id: string; email?: string | null }
  supabase: SupabaseClient
}
type GuardResultErr = { ok: false; error: string }

export async function requireHR(): Promise<GuardResultOk | GuardResultErr> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()
  if (data?.role !== 'hr') return { ok: false, error: 'Sin permisos (requiere rol RH)' }
  return { ok: true, user: { id: user.id, email: user.email ?? null }, supabase }
}
