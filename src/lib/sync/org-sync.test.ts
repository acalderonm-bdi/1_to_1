/**
 * Tests del parseo y validación del org-sync (la pieza más destructiva: carga
 * ~313 personas). Cubre parseOrgCsv (BOM, columnas, trim, N/A) y validateOrgCsv
 * (vacío, duplicados, líder colgante, ciclos no-dueños, dominio, dueños raíz).
 *
 * La lógica de syncOrg contra DB (roles, diff, relaciones, bajas) se valida en
 * Supabase local con el CSV real (Hito 5 / H5.3), no aquí.
 */
import { describe, it, expect } from 'vitest'
import { parseOrgCsv, validateOrgCsv, type OrgRow } from './org-sync'

const HEADER = 'ID,NOMBRE,AREA,CORREO ELECTRONICO EMPRESARIAL,LIDER INMEDIATO ID'

function row(p: Partial<OrgRow> & { employeeId: string }): OrgRow {
  return {
    employeeId: p.employeeId,
    name: p.name ?? `Persona ${p.employeeId}`,
    area: p.area ?? 'OPERACION',
    email: p.email ?? `u${p.employeeId}@b-drive.com.mx`,
    leaderEmployeeId: p.leaderEmployeeId ?? '',
  }
}

describe('parseOrgCsv', () => {
  it('parsea columnas, hace trim y tolera BOM', () => {
    const csv = `﻿${HEADER}\n0006, SAMAEL MARTINEZ ,SMART DESK, smartinez@b-drive.com.mx ,1070`
    const rows = parseOrgCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      employeeId: '0006',
      name: 'SAMAEL MARTINEZ',
      area: 'SMART DESK',
      email: 'smartinez@b-drive.com.mx',
      leaderEmployeeId: '1070',
    })
  })

  it('preserva filas con email N/A (el filtrado es responsabilidad de syncOrg)', () => {
    const csv = `${HEADER}\n0534,ARMANDO HERNANDEZ,ADMINISTRACION,N/A,1130`
    const rows = parseOrgCsv(csv)
    expect(rows[0].email).toBe('N/A')
  })
})

describe('validateOrgCsv', () => {
  it('acepta un árbol válido con dueños mutuos como raíz', () => {
    const rows = [
      row({ employeeId: '0543', leaderEmployeeId: '1095' }), // dueño
      row({ employeeId: '1095', leaderEmployeeId: '0543' }), // dueño (ciclo mutuo permitido)
      row({ employeeId: '0006', leaderEmployeeId: '0543' }),
      row({ employeeId: '0007', leaderEmployeeId: '0006' }),
    ]
    expect(validateOrgCsv(rows)).toEqual([])
  })

  it('rechaza CSV vacío', () => {
    expect(validateOrgCsv([])).toContainEqual(expect.stringContaining('vacío'))
  })

  it('detecta IDs duplicados', () => {
    const rows = [row({ employeeId: '0006', leaderEmployeeId: '0543' }), row({ employeeId: '0006', leaderEmployeeId: '0543' }), row({ employeeId: '0543', leaderEmployeeId: '1095' }), row({ employeeId: '1095', leaderEmployeeId: '0543' })]
    expect(validateOrgCsv(rows).some((e) => e.includes('duplicados'))).toBe(true)
  })

  it('detecta líder referenciado inexistente', () => {
    const rows = [row({ employeeId: '0006', leaderEmployeeId: '9999' })]
    expect(validateOrgCsv(rows).some((e) => e.includes('no están en el archivo'))).toBe(true)
  })

  it('detecta ciclo entre no-dueños', () => {
    const rows = [
      row({ employeeId: 'A', leaderEmployeeId: 'B' }),
      row({ employeeId: 'B', leaderEmployeeId: 'A' }), // ciclo no-dueño
    ]
    expect(validateOrgCsv(rows).some((e) => e.includes('Ciclos'))).toBe(true)
  })

  it('detecta correos fuera de dominio', () => {
    const rows = [
      row({ employeeId: '0543', leaderEmployeeId: '1095' }),
      row({ employeeId: '1095', leaderEmployeeId: '0543' }),
      row({ employeeId: '0006', leaderEmployeeId: '0543', email: 'ext@gmail.com' }),
    ]
    expect(validateOrgCsv(rows).some((e) => e.includes('fuera de'))).toBe(true)
  })

  it('ignora N/A para el chequeo de dominio (no es un correo)', () => {
    const rows = [
      row({ employeeId: '0543', leaderEmployeeId: '1095' }),
      row({ employeeId: '1095', leaderEmployeeId: '0543' }),
      row({ employeeId: '0534', leaderEmployeeId: '0543', email: 'N/A' }),
    ]
    expect(validateOrgCsv(rows)).toEqual([])
  })
})
