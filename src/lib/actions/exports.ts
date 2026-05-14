'use server'

/**
 * Server action wrappers para los CSV ad-hoc.
 *
 * El flujo principal de descarga usa el endpoint `/api/exports/[type]`
 * con un `<a href download>`. Estos actions son una alternativa para
 * cuando un componente client necesita el CSV en memoria (p.ej. preview
 * en modal o copy-to-clipboard) sin redirigir al endpoint.
 *
 * Devuelven el contenido en base64 para que el cliente pueda hacer un
 * `Blob([atob(b64)])` y triggerear el download via `URL.createObjectURL`.
 * Las generators ya emiten BOM UTF-8 — se preserva en el base64.
 */
import { requireHR } from '@/lib/auth-guards'
import { generateAcuerdosCSV } from '@/lib/exports/acuerdos-csv'
import { generateCalidezCSV } from '@/lib/exports/calidez-csv'
import { generateCumplimientoCSV } from '@/lib/exports/cumplimiento-csv'
import type { ActionResult } from '@/types/domain'

export type ExportType = 'cumplimiento' | 'acuerdos' | 'calidez'

export interface ExportPayload {
  filename: string
  base64Content: string
}

export async function generateExport(
  type: ExportType,
): Promise<ActionResult<ExportPayload>> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }

  let result
  try {
    if (type === 'cumplimiento') {
      result = await generateCumplimientoCSV()
    } else if (type === 'acuerdos') {
      result = await generateAcuerdosCSV()
    } else if (type === 'calidez') {
      result = await generateCalidezCSV()
    } else {
      return { success: false, error: 'Tipo desconocido' }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error generando CSV'
    return { success: false, error: message }
  }

  const base64Content = Buffer.from(result.content, 'utf-8').toString('base64')

  return {
    success: true,
    data: { filename: result.filename, base64Content },
  }
}
