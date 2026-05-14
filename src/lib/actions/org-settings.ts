'use server'

import { revalidatePath } from 'next/cache'
import { requireHR } from '@/lib/auth-guards'
import { setOrgSetting, type SettingKey } from '@/lib/org-settings'
import type { ActionResult } from '@/types/domain'

export async function saveOrgSetting<K extends SettingKey>(
  key: K,
  value: unknown,
): Promise<ActionResult> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }
  try {
    await setOrgSetting(key, value, guard.user.id)
    revalidatePath('/arquitectura-humana/parametros')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
