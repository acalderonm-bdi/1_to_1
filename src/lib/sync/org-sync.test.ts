import { describe, it, expect } from 'vitest'
import { parseOrgCsv, validateOrgCsv, deriveLeaderNames, diffLeaderSets, CHAIN_COLUMNS } from './org-sync'

// Encabezado real del export de RH (nótese el espacio colgante en "GERENCIA ").
const HEADER =
  'ID,NOMBRE COMPLETO,ESTATUS,PUESTO,NIVEL DE PUESTO,ESPECIALIDAD,AREA,SUB AREA,PROYECTO,' +
  'SUPERVISION/LIDER TECNICO,COORDINACION,GERENCIA ,SUBDIRECCION,DIRECCION,DIRECCION GENERAL/EJECUTIVA,CORREO ORGANIZACIONAL'

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join('\n')
}

const DG = '0001,GERARDO DG,ACTIVO,DIRECCION GENERAL,D,N/A,DIRECCION GENERAL,N/A,CORPORATIVO,N/A,N/A,N/A,N/A,N/A,N/A,gdg@b-drive.com.mx'

describe('parseOrgCsv', () => {
  it('parsea campos y normaliza encabezados con espacios colgantes', () => {
    const rows = parseOrgCsv(csv(
      '0022,ANA LOPEZ,ACTIVO,ANALISTA,O,N/A,FINANZAS,TESORERIA,CORPORATIVO,N/A,N/A,LUIS PEREZ,N/A,N/A,GERARDO DG,alopez@b-drive.com.mx',
    ))
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r.employeeId).toBe('0022')
    expect(r.name).toBe('ANA LOPEZ')
    expect(r.estatus).toBe('ACTIVO')
    expect(r.puesto).toBe('ANALISTA')
    expect(r.nivelPuesto).toBe('O')
    expect(r.area).toBe('FINANZAS')
    expect(r.subArea).toBe('TESORERIA')
    expect(r.proyecto).toBe('CORPORATIVO')
    expect(r.email).toBe('alopez@b-drive.com.mx')
    // "GERENCIA " (con espacio) debe resolver como columna GERENCIA
    expect(r.leaderNames).toEqual(['LUIS PEREZ'])
  })

  it('convierte N/A y vacío a null en campos de perfil', () => {
    const rows = parseOrgCsv(csv(
      '0030,JUAN RUIZ,ACTIVO,CHOFER,O,N/A,ADMIN,N/A,,N/A,N/A,N/A,N/A,N/A,GERARDO DG,jruiz@b-drive.com.mx',
    ))
    expect(rows[0].subArea).toBeNull()
    expect(rows[0].proyecto).toBeNull()
  })

  it('normaliza el correo a minúsculas', () => {
    const rows = parseOrgCsv(csv(
      '0031,EVA DIAZ,ACTIVO,ANALISTA,O,N/A,ADMIN,N/A,X,N/A,N/A,N/A,N/A,N/A,GERARDO DG,EDiaz@B-Drive.com.mx',
    ))
    expect(rows[0].email).toBe('ediaz@b-drive.com.mx')
  })
})

describe('deriveLeaderNames', () => {
  const base = Object.fromEntries(CHAIN_COLUMNS.map((c) => [c, 'N/A']))

  it('toma la columna más específica no-N/A', () => {
    const rec = { ...base, COORDINACION: 'MARIA SOSA', GERENCIA: 'PEDRO GIL', DIRECCION: 'GERARDO DG' }
    expect(deriveLeaderNames(rec, 'YO MISMO')).toEqual(['MARIA SOSA'])
  })

  it('multi-jefe: separa por "/", recorta espacios y deduplica', () => {
    const rec = { ...base, COORDINACION: 'ALDO RUIZ/ MARIA SOSA /ALDO RUIZ' }
    expect(deriveLeaderNames(rec, 'YO')).toEqual(['ALDO RUIZ', 'MARIA SOSA'])
  })

  it('excluye a la propia persona si aparece en su cadena', () => {
    const rec = { ...base, GERENCIA: 'ANA LOPEZ/PEDRO GIL' }
    expect(deriveLeaderNames(rec, 'Ana Lopez')).toEqual(['PEDRO GIL'])
  })

  it('sin jefes → lista vacía (raíz)', () => {
    expect(deriveLeaderNames(base, 'GERARDO DG')).toEqual([])
  })
})

describe('validateOrgCsv', () => {
  it('CSV válido pasa sin errores', () => {
    const rows = parseOrgCsv(csv(
      DG,
      '0022,ANA LOPEZ,ACTIVO,ANALISTA,O,N/A,FINANZAS,TESORERIA,X,N/A,N/A,N/A,N/A,N/A,GERARDO DG,alopez@b-drive.com.mx',
    ))
    expect(validateOrgCsv(rows)).toEqual([])
  })

  it('detecta IDs duplicados', () => {
    const rows = parseOrgCsv(csv(
      DG,
      '0022,ANA LOPEZ,ACTIVO,ANALISTA,O,N/A,FIN,N/A,X,N/A,N/A,N/A,N/A,N/A,GERARDO DG,a@b-drive.com.mx',
      '0022,LUIS PEREZ,ACTIVO,ANALISTA,O,N/A,FIN,N/A,X,N/A,N/A,N/A,N/A,N/A,GERARDO DG,l@b-drive.com.mx',
    ))
    expect(validateOrgCsv(rows).join(' ')).toContain('IDs duplicados')
  })

  it('detecta nombres duplicados entre activos (ambigüedad de jefes)', () => {
    const rows = parseOrgCsv(csv(
      DG,
      '0022,ANA LOPEZ,ACTIVO,ANALISTA,O,N/A,FIN,N/A,X,N/A,N/A,N/A,N/A,N/A,GERARDO DG,a1@b-drive.com.mx',
      '0023,ANA LOPEZ,ACTIVO,ANALISTA,O,N/A,FIN,N/A,X,N/A,N/A,N/A,N/A,N/A,GERARDO DG,a2@b-drive.com.mx',
    ))
    expect(validateOrgCsv(rows).join(' ')).toContain('Nombres duplicados')
  })

  it('detecta correos fuera de dominio', () => {
    const rows = parseOrgCsv(csv(
      DG,
      '0022,ANA LOPEZ,ACTIVO,ANALISTA,O,N/A,FIN,N/A,X,N/A,N/A,N/A,N/A,N/A,GERARDO DG,ana@gmail.com',
    ))
    expect(validateOrgCsv(rows).join(' ')).toContain('fuera de @b-drive.com.mx')
  })

  it('detecta jefes que no resuelven a una fila activa', () => {
    const rows = parseOrgCsv(csv(
      DG,
      '0022,ANA LOPEZ,ACTIVO,ANALISTA,O,N/A,FIN,N/A,X,N/A,PERSONA INEXISTENTE,N/A,N/A,N/A,GERARDO DG,a@b-drive.com.mx',
    ))
    expect(validateOrgCsv(rows).join(' ')).toContain('no están (activos)')
  })

  it('un jefe dado de BAJA cuenta como no-resuelto', () => {
    const rows = parseOrgCsv(csv(
      DG,
      '0040,PEDRO GIL,BAJA,GERENTE,G,N/A,FIN,N/A,X,N/A,N/A,N/A,N/A,N/A,GERARDO DG,p@b-drive.com.mx',
      '0022,ANA LOPEZ,ACTIVO,ANALISTA,O,N/A,FIN,N/A,X,N/A,N/A,PEDRO GIL,N/A,N/A,GERARDO DG,a@b-drive.com.mx',
    ))
    expect(validateOrgCsv(rows).join(' ')).toContain('no están (activos)')
  })

  it('detecta ciclos de liderazgo', () => {
    const rows = parseOrgCsv(csv(
      '0050,AAA BBB,ACTIVO,X,G,N/A,FIN,N/A,X,N/A,N/A,CCC DDD,N/A,N/A,N/A,aaa@b-drive.com.mx',
      '0051,CCC DDD,ACTIVO,X,G,N/A,FIN,N/A,X,N/A,N/A,AAA BBB,N/A,N/A,N/A,ccc@b-drive.com.mx',
    ))
    expect(validateOrgCsv(rows).join(' ')).toContain('Ciclos de liderazgo')
  })

  it('encabezados incorrectos → error de columna ID', () => {
    const rows = parseOrgCsv('FOO,BAR\n1,2')
    expect(validateOrgCsv(rows).join(' ')).toContain('Columna "ID"')
  })
})

describe('diffLeaderSets', () => {
  it('conserva intersección, cierra sobrantes, crea faltantes', () => {
    const { toClose, toCreate } = diffLeaderSets(new Set(['A', 'B']), new Set(['B', 'C']))
    expect(toClose).toEqual(['C'])
    expect(toCreate).toEqual(['A'])
  })

  it('sin cambios → vacío', () => {
    const { toClose, toCreate } = diffLeaderSets(new Set(['A']), new Set(['A']))
    expect(toClose).toEqual([])
    expect(toCreate).toEqual([])
  })
})

describe('parseOrgCsv + validateOrgCsv contra el CSV real', () => {
  // Smoke con forma real: multi-jefe en COORDINACION como viene en el archivo.
  it('multi-jefe real se deriva como N relaciones', () => {
    const rows = parseOrgCsv(csv(
      DG,
      '0100,ALDO RUIZ,ACTIVO,COORD,C,N/A,OPS,MESA,X,N/A,N/A,N/A,N/A,N/A,GERARDO DG,aldo@b-drive.com.mx',
      '0101,KARLA ZARCO,ACTIVO,COORD,C,N/A,OPS,MESA,X,N/A,N/A,N/A,N/A,N/A,GERARDO DG,karla@b-drive.com.mx',
      '0102,LUIS OP,ACTIVO,ANALISTA,O,N/A,OPS,MESA,X,N/A,ALDO RUIZ/KARLA ZARCO,N/A,N/A,N/A,GERARDO DG,luis@b-drive.com.mx',
    ))
    const op = rows.find((r) => r.employeeId === '0102')!
    expect(op.leaderNames).toEqual(['ALDO RUIZ', 'KARLA ZARCO'])
    expect(validateOrgCsv(rows)).toEqual([])
  })
})
