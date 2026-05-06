import { createAdminClient } from '@/lib/supabase/admin'

interface AuditLogEntry {
  userId?: string
  action: string
  resourceType: string
  resourceId?: string
  metadata?: Record<string, unknown>
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_logs').insert({
      user_id: entry.userId ?? null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      metadata: entry.metadata ?? null,
    })
  } catch {
    // Los errores de auditoría no deben romper el flujo principal
  }
}
