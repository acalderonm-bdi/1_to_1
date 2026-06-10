'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfileName(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const full_name = String(formData.get('full_name') ?? '').trim()
  if (!full_name) return { success: false, error: 'Nombre requerido' }

  const { error } = await supabase
    .from('users')
    .update({ full_name })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/colaborador/configuracion')
  revalidatePath('/lider/configuracion')
  revalidatePath('/arquitectura-humana/configuracion')
  return { success: true }
}
