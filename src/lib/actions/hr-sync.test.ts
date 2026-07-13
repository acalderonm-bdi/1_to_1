/**
 * Tests del parser de Excel de RH (`parseExcel`).
 *
 * Adaptado del test de org-sync (CSV) de la rama feat/acceso-relacional durante
 * la reconciliación feat->main: se descartó el sync por CSV (D1: gana el Excel
 * nativo de main), así que las pruebas apuntan al parser que SÍ quedó. Cubre lo
 * PURO del sync (parseo, trim, padStart, detección de columnas, errores por
 * fila); la validación de árbol/ciclos vive en previewExcelSync (requiere DB) y
 * queda fuera de este test.
 */
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseExcel } from './hr-sync'

const HEADERS = {
  ID: 'ID',
  NOMBRE: 'NOMBRE',
  AREA: 'AREA',
  CORREO: 'CORREO ELECTRONICO EMPRESARIAL',
  LIDER: 'LIDER INMEDIATO ID',
} as const

/** Construye un buffer .xlsx con la hoja indicada a partir de filas objeto. */
function makeXlsx(rows: Record<string, unknown>[], sheetName = 'PERSONAL ACTIVO'): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

describe('parseExcel', () => {
  it('parsea, hace trim, normaliza email a minúsculas y rellena IDs a 4 dígitos', () => {
    const buf = makeXlsx([
      { [HEADERS.ID]: '6', [HEADERS.NOMBRE]: '  Ana Pérez  ', [HEADERS.AREA]: 'Ventas', [HEADERS.CORREO]: 'ANA@B-DRIVE.COM.MX', [HEADERS.LIDER]: '1070' },
    ])
    const { rows, errors } = parseExcel(buf)
    expect(errors).toEqual([])
    expect(rows).toEqual([
      { hr_id: '0006', full_name: 'Ana Pérez', email: 'ana@b-drive.com.mx', area: 'Ventas', leader_hr_id: '1070' },
    ])
  })

  it('deja leader_hr_id en null cuando la celda de líder viene vacía (raíz del árbol)', () => {
    const buf = makeXlsx([
      { [HEADERS.ID]: '1070', [HEADERS.NOMBRE]: 'Jefa', [HEADERS.AREA]: 'Dirección', [HEADERS.CORREO]: 'jefa@b-drive.com.mx', [HEADERS.LIDER]: '' },
    ])
    const { rows } = parseExcel(buf)
    expect(rows[0].leader_hr_id).toBeNull()
  })

  it('omite filas en blanco sin generar error', () => {
    const buf = makeXlsx([
      { [HEADERS.ID]: '', [HEADERS.NOMBRE]: '', [HEADERS.AREA]: '', [HEADERS.CORREO]: '', [HEADERS.LIDER]: '' },
      { [HEADERS.ID]: '7', [HEADERS.NOMBRE]: 'Beto', [HEADERS.AREA]: 'IT', [HEADERS.CORREO]: 'beto@b-drive.com.mx', [HEADERS.LIDER]: '1070' },
    ])
    const { rows, errors } = parseExcel(buf)
    expect(rows).toHaveLength(1)
    expect(rows[0].hr_id).toBe('0007')
    expect(errors).toEqual([])
  })

  it('omite y reporta filas con correo inválido o nombre vacío', () => {
    const buf = makeXlsx([
      { [HEADERS.ID]: '8', [HEADERS.NOMBRE]: 'Sin Correo', [HEADERS.AREA]: 'IT', [HEADERS.CORREO]: 'no-arroba', [HEADERS.LIDER]: '1070' },
      { [HEADERS.ID]: '9', [HEADERS.NOMBRE]: '', [HEADERS.AREA]: 'IT', [HEADERS.CORREO]: 'x@b-drive.com.mx', [HEADERS.LIDER]: '1070' },
    ])
    const { rows, errors } = parseExcel(buf)
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(2)
    expect(errors[0]).toContain('correo inválido')
    expect(errors[1]).toContain('nombre vacío')
  })

  it('rechaza el archivo si falta la hoja "PERSONAL ACTIVO"', () => {
    const buf = makeXlsx([{ [HEADERS.ID]: '1', [HEADERS.NOMBRE]: 'X', [HEADERS.AREA]: 'Y', [HEADERS.CORREO]: 'x@b-drive.com.mx', [HEADERS.LIDER]: '' }], 'OTRA HOJA')
    const { rows, errors } = parseExcel(buf)
    expect(rows).toEqual([])
    expect(errors[0]).toContain('No se encontró la hoja')
  })

  it('rechaza el archivo si faltan columnas esperadas', () => {
    const buf = makeXlsx([{ COL_RARA: 'x', OTRA: 'y' }])
    const { rows, errors } = parseExcel(buf)
    expect(rows).toEqual([])
    expect(errors[0]).toContain('Columnas no encontradas')
  })
})
