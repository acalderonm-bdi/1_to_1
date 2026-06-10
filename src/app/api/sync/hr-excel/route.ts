/**
 * POST /api/sync/hr-excel?action=preview|apply
 *
 * Acepta multipart/form-data con campo "file" (archivo .xlsx).
 * Solo accesible para usuarios con role = 'hr'.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { requireHR } from '@/lib/auth-guards'
import { previewExcelSync, applyExcelSync } from '@/lib/actions/hr-sync'

export async function POST(req: NextRequest) {
  const guard = await requireHR()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: 403 })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get('action') ?? 'preview'

  if (action !== 'preview' && action !== 'apply') {
    return NextResponse.json(
      { error: 'Parámetro action inválido. Use preview o apply.' },
      { status: 400 },
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'No se pudo parsear el form data.' }, { status: 400 })
  }

  const result =
    action === 'preview'
      ? await previewExcelSync(formData)
      : await applyExcelSync(formData)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({ data: result.data })
}
