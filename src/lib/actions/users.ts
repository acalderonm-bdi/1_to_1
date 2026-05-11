'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/types/domain'

async function requireHr() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' } as const
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()
  if (profile?.role !== 'hr') return { ok: false, error: 'No autorizado' } as const
  return { ok: true, userId: user.id, supabase } as const
}

// Cambiar rol
const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['collaborator', 'leader', 'hr']),
})
export async function updateUserRole(input: z.infer<typeof roleSchema>): Promise<ActionResult> {
  const check = await requireHr()
  if (!check.ok) return { success: false, error: check.error }
  const parsed = roleSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('users')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.userId)
  if (error) return { success: false, error: error.message }

  await admin.from('audit_logs').insert({
    user_id: check.userId,
    action: 'role_changed',
    resource_type: 'user',
    resource_id: parsed.data.userId,
    metadata: { new_role: parsed.data.role },
  })

  revalidatePath('/arquitectura-humana/usuarios')
  revalidatePath(`/arquitectura-humana/usuarios/${parsed.data.userId}`)
  return { success: true }
}

// Activar / desactivar
const activeSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean(),
})
export async function updateUserActive(input: z.infer<typeof activeSchema>): Promise<ActionResult> {
  const check = await requireHr()
  if (!check.ok) return { success: false, error: check.error }
  const parsed = activeSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('users')
    .update({ is_active: parsed.data.isActive })
    .eq('id', parsed.data.userId)
  if (error) return { success: false, error: error.message }

  await admin.from('audit_logs').insert({
    user_id: check.userId,
    action: parsed.data.isActive ? 'user_activated' : 'user_deactivated',
    resource_type: 'user',
    resource_id: parsed.data.userId,
    metadata: {},
  })

  revalidatePath('/arquitectura-humana/usuarios')
  revalidatePath(`/arquitectura-humana/usuarios/${parsed.data.userId}`)
  return { success: true }
}

// Asignar líder (crea nueva relación, cierra anterior si existe)
const leaderSchema = z.object({
  collaboratorId: z.string().uuid(),
  newLeaderId: z.string().uuid().nullable(),
})
export async function assignLeader(input: z.infer<typeof leaderSchema>): Promise<ActionResult> {
  const check = await requireHr()
  if (!check.ok) return { success: false, error: check.error }
  const parsed = leaderSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  if (parsed.data.newLeaderId && parsed.data.newLeaderId === parsed.data.collaboratorId) {
    return { success: false, error: 'Una persona no puede ser su propio líder' }
  }

  const admin = createAdminClient()

  // Cerrar relaciones activas previas
  const { error: closeErr } = await admin
    .from('leadership_relations')
    .update({ ended_at: new Date().toISOString() })
    .eq('collaborator_id', parsed.data.collaboratorId)
    .is('ended_at', null)
  if (closeErr) return { success: false, error: closeErr.message }

  // Si pasamos un nuevo líder, crear la nueva relación
  if (parsed.data.newLeaderId) {
    const { error: insErr } = await admin.from('leadership_relations').insert({
      leader_id: parsed.data.newLeaderId,
      collaborator_id: parsed.data.collaboratorId,
    })
    if (insErr) return { success: false, error: insErr.message }
  }

  await admin.from('audit_logs').insert({
    user_id: check.userId,
    action: 'leader_assigned',
    resource_type: 'user',
    resource_id: parsed.data.collaboratorId,
    metadata: { new_leader_id: parsed.data.newLeaderId },
  })

  revalidatePath('/arquitectura-humana/usuarios')
  revalidatePath('/arquitectura-humana/estructura')
  revalidatePath(`/arquitectura-humana/usuarios/${parsed.data.collaboratorId}`)
  return { success: true }
}
