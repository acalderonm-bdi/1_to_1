/**
 * Parser del Excel de RH (hoja "PERSONAL ACTIVO", formato anterior a la base
 * de líderes CSV). Vive FUERA de src/lib/actions porque hr-sync.ts es un
 * archivo 'use server' y Next.js exige que todos sus exports sean async —
 * exportar el parser síncrono desde ahí rompe el build. Aquí queda importable
 * tanto por la action como por los tests.
 */
import * as XLSX from 'xlsx'

// Raw row as read from Excel
export interface HrRow {
  hr_id: string          // e.g. '0006'
  full_name: string
  email: string
  area: string
  leader_hr_id: string | null  // e.g. '1070'
}

export function parseExcel(buffer: ArrayBuffer): { rows: HrRow[]; errors: string[] } {
  const errors: string[] = []
  const wb = XLSX.read(buffer, { type: 'array' })

  const sheetName = 'PERSONAL ACTIVO'
  const ws = wb.Sheets[sheetName]
  if (!ws) {
    return { rows: [], errors: [`No se encontró la hoja "${sheetName}" en el Excel.`] }
  }

  // Header row may have Spanish accents – use raw cell values
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: false,
  })

  if (rawData.length === 0) {
    return { rows: [], errors: ['La hoja "PERSONAL ACTIVO" está vacía.'] }
  }

  // Detect column names (case-insensitive, accent-flexible)
  const firstRow = rawData[0]
  const keys = Object.keys(firstRow)

  function findCol(candidates: string[]): string | undefined {
    return keys.find((k) =>
      candidates.some((c) =>
        k.toUpperCase().replace(/[ÁÉÍÓÚ]/g, (m) => ({ Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U' }[m] ?? m))
         .includes(c.toUpperCase())
      )
    )
  }

  const colId = findCol(['ID'])
  const colNombre = findCol(['NOMBRE'])
  const colArea = findCol(['AREA'])
  const colCorreo = findCol(['CORREO'])
  const colLider = findCol(['LIDER'])

  if (!colId || !colNombre || !colArea || !colCorreo || !colLider) {
    return {
      rows: [],
      errors: [
        `Columnas no encontradas. Se esperaban: ID, NOMBRE, AREA, CORREO ELECTRONICO EMPRESARIAL, LIDER INMEDIATO ID.` +
        ` Columnas detectadas: ${keys.join(', ')}`,
      ],
    }
  }

  const rows: HrRow[] = []

  for (let i = 0; i < rawData.length; i++) {
    const raw = rawData[i]
    const lineNum = i + 2 // +2 because row 1 is header

    const rawId = raw[colId]
    const rawNombre = raw[colNombre]
    const rawArea = raw[colArea]
    const rawCorreo = raw[colCorreo]
    const rawLider = raw[colLider]

    if (!rawId && !rawNombre && !rawCorreo) continue // blank row

    const hr_id = String(rawId ?? '').trim().padStart(4, '0')
    const full_name = String(rawNombre ?? '').trim()
    const email = String(rawCorreo ?? '').trim().toLowerCase()
    const area = String(rawArea ?? '').trim()

    // Leader ID comes as number like 1070.0 or string '1070'
    let leader_hr_id: string | null = null
    if (rawLider !== null && rawLider !== undefined && String(rawLider).trim() !== '') {
      leader_hr_id = String(parseFloat(String(rawLider))).padStart(4, '0')
    }

    if (!hr_id || hr_id === '0000') {
      errors.push(`Fila ${lineNum}: ID vacío, omitida.`)
      continue
    }
    if (!email || !email.includes('@')) {
      errors.push(`Fila ${lineNum} (${hr_id}): correo inválido "${email}", omitida.`)
      continue
    }
    if (!full_name) {
      errors.push(`Fila ${lineNum} (${hr_id}): nombre vacío, omitida.`)
      continue
    }

    rows.push({ hr_id, full_name, email, area, leader_hr_id })
  }

  return { rows, errors }
}
