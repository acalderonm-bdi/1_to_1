/**
 * GET /api/exports/[type]
 *
 * Generates an ad-hoc CSV for HR. The endpoint is protected by
 * `requireHR()` and accepts the three report types defined in the
 * `scheduled_reports` enum:
 *
 *   - `cumplimiento`  → compliance per department
 *   - `acuerdos`      → all agreements + responsable / lider / score IA
 *   - `calidez`       → warmth metrics aggregated per leader
 *
 * Browser hits this as a normal `<a href download>` link and gets back
 * a UTF-8 (BOM-prefixed) CSV attachment.
 */
import { NextResponse, type NextRequest } from 'next/server'

import { requireHR } from '@/lib/auth-guards'
import { generateAcuerdosCSV } from '@/lib/exports/acuerdos-csv'
import { generateCalidezCSV } from '@/lib/exports/calidez-csv'
import { generateCumplimientoCSV } from '@/lib/exports/cumplimiento-csv'

export async function GET(
  _req: NextRequest,
  { params }: { params: { type: string } },
) {
  const guard = await requireHR()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: 403 })
  }

  let result
  switch (params.type) {
    case 'cumplimiento':
      result = await generateCumplimientoCSV()
      break
    case 'acuerdos':
      result = await generateAcuerdosCSV()
      break
    case 'calidez':
      result = await generateCalidezCSV()
      break
    default:
      return NextResponse.json({ error: 'Tipo desconocido' }, { status: 400 })
  }

  return new Response(result.content, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
