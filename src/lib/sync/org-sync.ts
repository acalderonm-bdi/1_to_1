/**
 * Org-sync: importa el directorio de personal de B-Drive (CSV de RH) al sistema.
 *
 * Formato de entrada: "BASE LIDERES" (jul-2026). A diferencia del formato
 * anterior (líder por ID en una columna plana), este CSV trae la cadena de
 * mando POR NOMBRE en 6 columnas (supervisión/LT → coordinación → gerencia →
 * subdirección → dirección → dirección general) y campos de perfil nuevos
 * (puesto, nivel de puesto, subárea, proyecto).
 *
 * Reglas (acordadas con Ariel/RH):
 * - Jefe directo = la columna de cadena MÁS ESPECÍFICA no-N/A de la fila.
 * - Multi-jefe: una celda puede traer varios nombres separados por "/" →
 *   se crea UNA relación de liderazgo por cada jefe (el sistema soporta
 *   relaciones múltiples por colaborador).
 * - Filas sin correo se EXCLUYEN con aviso (no se pueden provisionar: el
 *   login es Google SSO corporativo).
 * - Filas con ESTATUS distinto de ACTIVO cuentan como ausentes (baja).
 * - Rol: 'hr' si área = Arquitectura Humana; si no, 'leader' si alguien lo
 *   referencia como jefe; si no, 'collaborator'. (El acceso real es por
 *   relación; el rol solo define landing + poderes RH.)
 * - Raíz = fila sin ningún jefe en la cadena (p.ej. presidencia del consejo).
 * - Usuarios con role='hr' ya existentes NUNCA se desactivan automáticamente
 *   (se reportan en hrProtected para baja manual) — evita que un CSV mal
 *   exportado deje fuera al equipo que opera el sistema.
 *
 * Patrón plan→ejecutar: primero lee el estado actual y CALCULA el diff por
 * persona (esto es lo que devuelve el dry-run, para que RH apruebe con datos
 * reales); luego, en modo apply, ejecuta el plan. Idempotente por
 * `hr_employee_id` (fallback email): si falla a mitad, basta re-correr.
 * El orden (departamentos → usuarios → relaciones → bajas) garantiza que un
 * corte deja datos consistentes-hacia-adelante.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import type { Database } from '@/types/database.types'

type AdminClient = SupabaseClient<Database>

export const HR_AREA = 'ARQUITECTURA HUMANA Y TRANSFORMACION DEL TALENTO'
export const EMAIL_DOMAIN = '@b-drive.com.mx'

/** Columnas de cadena de mando, de la MÁS específica a la MÁS general. */
export const CHAIN_COLUMNS = [
  'SUPERVISION/LIDER TECNICO',
  'COORDINACION',
  'GERENCIA',
  'SUBDIRECCION',
  'DIRECCION',
  'DIRECCION GENERAL/EJECUTIVA',
] as const

export interface OrgRow {
  employeeId: string
  name: string
  estatus: string
  puesto: string | null
  nivelPuesto: string | null
  subArea: string | null
  proyecto: string | null
  area: string
  email: string
  /** Nombres de los jefes directos (columna más específica, split por "/"). */
  leaderNames: string[]
}

type Role = 'collaborator' | 'leader' | 'hr'

export interface PersonChange {
  employeeId: string
  name: string
  action: 'create' | 'update' | 'reactivate' | 'noop'
  role: Role
  changes: string[] // descripciones legibles de qué cambia (solo update/reactivate)
}

export interface RelationChange {
  collaboratorEmployeeId: string
  collaboratorName: string
  /** employeeIds de los líderes actuales que se cierran. */
  closes: string[]
  /** employeeIds de los líderes nuevos que se crean. */
  creates: string[]
}

export interface SyncReport {
  dryRun: boolean
  totalRows: number
  excluded: string[] // "ID — nombre (motivo)" de filas que no se importan
  departmentsToCreate: string[]
  departmentsExisting: number
  usersCreated: number
  usersUpdated: number
  usersReactivated: number
  relationsCreated: number
  relationsClosed: number
  roots: string[] // employeeIds sin jefe en el CSV (quedan raíz del árbol)
  deactivated: string[] // employeeIds que ya no están ACTIVOS en el CSV
  hrProtected: string[] // usuarios hr ausentes del CSV que NO se desactivan
  validationErrors: string[]
  errors: string[]
  people: PersonChange[] // diff por persona (create/update/reactivate; omite noop)
  relationChanges: RelationChange[]
}

function isNA(value: string | undefined | null): boolean {
  const v = (value ?? '').trim()
  return v === '' || v.toUpperCase() === 'N/A' || v.toUpperCase() === 'NA'
}

function cleanField(value: string | undefined): string | null {
  return isNA(value) ? null : (value ?? '').trim()
}

/**
 * Deriva los jefes directos de una fila: toma la columna de cadena más
 * específica que no sea N/A y separa por "/" (celdas multi-jefe). Excluye a la
 * propia persona por defensa (un export malo podría auto-referenciarla).
 */
export function deriveLeaderNames(record: Record<string, string>, selfName: string): string[] {
  for (const col of CHAIN_COLUMNS) {
    const raw = record[col]
    if (isNA(raw)) continue
    const names = raw
      .split('/')
      .map((n) => n.trim().toUpperCase())
      .filter((n) => n.length > 0 && n !== selfName.trim().toUpperCase())
    return Array.from(new Set(names))
  }
  return []
}

/** Parsea el CSV de RH. Devuelve TODAS las filas; el filtrado/validación aparte. */
export function parseOrgCsv(content: string): OrgRow[] {
  const records = parse(content, {
    // El export real trae encabezados con espacios colgantes ("GERENCIA ").
    columns: (header: string[]) => header.map((h) => h.trim()),
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[]

  return records.map((r) => {
    const name = (r['NOMBRE COMPLETO'] ?? '').trim()
    return {
      employeeId: (r['ID'] ?? '').trim(),
      name,
      estatus: (r['ESTATUS'] ?? '').trim().toUpperCase(),
      puesto: cleanField(r['PUESTO']),
      nivelPuesto: cleanField(r['NIVEL DE PUESTO']),
      subArea: cleanField(r['SUB AREA']),
      proyecto: cleanField(r['PROYECTO']),
      area: (r['AREA'] ?? '').trim(),
      email: (r['CORREO ORGANIZACIONAL'] ?? '').trim().toLowerCase(),
      leaderNames: deriveLeaderNames(r, name),
    }
  })
}

function isValidEmail(email: string): boolean {
  return email.includes('@')
}

/**
 * Valida la integridad del CSV ANTES de escribir. Devuelve lista de errores
 * (vacía = OK). Un CSV mal exportado podría inactivar a media empresa o crear
 * ciclos que rompan el árbol de cadencia.
 */
export function validateOrgCsv(rows: OrgRow[]): string[] {
  const errors: string[] = []
  if (rows.length === 0) {
    errors.push('CSV vacío o sin filas de datos.')
    return errors
  }
  // Encabezados: si ninguna fila trae ID, las columnas no coinciden.
  if (rows.every((r) => !r.employeeId)) {
    errors.push(
      'Columna "ID" no encontrada o vacía — ¿encabezados correctos? ' +
      '(ID, NOMBRE COMPLETO, ESTATUS, PUESTO, NIVEL DE PUESTO, AREA, SUB AREA, PROYECTO, ' +
      'cadena de mando, CORREO ORGANIZACIONAL)',
    )
    return errors
  }

  const active = rows.filter((r) => r.estatus === 'ACTIVO')

  const ids = new Set<string>()
  const dups = new Set<string>()
  for (const r of rows) {
    if (!r.employeeId) { errors.push(`Fila con ID vacío (nombre: ${r.name || '—'}).`); continue }
    if (ids.has(r.employeeId)) dups.add(r.employeeId)
    ids.add(r.employeeId)
  }
  if (dups.size > 0) errors.push(`IDs duplicados: ${[...dups].join(', ')}.`)

  // Nombres duplicados entre ACTIVOS: la cadena de mando referencia por NOMBRE,
  // así que un nombre repetido hace ambigua la resolución de jefes.
  const nameCount = new Map<string, number>()
  for (const r of active) {
    const key = r.name.toUpperCase()
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1)
  }
  const dupNames = [...nameCount.entries()].filter(([, c]) => c > 1).map(([n]) => n)
  if (dupNames.length > 0) {
    errors.push(`Nombres duplicados (ambiguos como jefe): ${dupNames.slice(0, 5).join('; ')}${dupNames.length > 5 ? '…' : ''}.`)
  }

  // Dominio: los correos presentes deben ser corporativos (el guard de dominio
  // de handle_new_user rechazaría el alta y el sync quedaría a medias).
  const badDomain = rows.filter((r) => isValidEmail(r.email) && !r.email.endsWith(EMAIL_DOMAIN))
  if (badDomain.length > 0) {
    errors.push(`${badDomain.length} correo(s) fuera de ${EMAIL_DOMAIN}: ${badDomain.slice(0, 5).map((r) => r.employeeId).join(', ')}${badDomain.length > 5 ? '…' : ''}.`)
  }

  // Todo jefe referenciado debe resolver a una fila ACTIVA del archivo.
  const byName = new Map(active.map((r) => [r.name.toUpperCase(), r]))
  const dangling = new Set<string>()
  for (const r of active) {
    for (const leader of r.leaderNames) {
      if (!byName.has(leader)) dangling.add(leader)
    }
  }
  if (dangling.size > 0) {
    errors.push(`Jefes referenciados que no están (activos) en el archivo: ${[...dangling].slice(0, 5).join('; ')}${dangling.size > 5 ? '…' : ''}.`)
  }

  // Ciclos de liderazgo (grafo multi-jefe): DFS con colores.
  const leadersOf = new Map(active.map((r) => [
    r.employeeId,
    r.leaderNames.map((n) => byName.get(n)?.employeeId).filter((x): x is string => !!x),
  ]))
  const color = new Map<string, 1 | 2>()
  const cyclic = new Set<string>()
  const visit = (id: string, stack: string[]): void => {
    color.set(id, 1)
    for (const leader of leadersOf.get(id) ?? []) {
      if (color.get(leader) === 1) { cyclic.add(leader); continue }
      if (!color.has(leader)) visit(leader, [...stack, id])
    }
    color.set(id, 2)
  }
  for (const r of active) if (!color.has(r.employeeId)) visit(r.employeeId, [])
  if (cyclic.size > 0) errors.push(`Ciclos de liderazgo detectados en: ${[...cyclic].slice(0, 10).join(', ')}.`)

  return errors
}

/**
 * Reconciliación de relaciones multi-líder (pura, testeable): dado el set de
 * líderes deseado y el actual, qué se cierra y qué se crea. Lo que está en
 * ambos se conserva intacto (no se "renueva" — preserva historial de 1:1s).
 */
export function diffLeaderSets(desired: Set<string>, current: Set<string>): { toClose: string[]; toCreate: string[] } {
  return {
    toClose: [...current].filter((id) => !desired.has(id)),
    toCreate: [...desired].filter((id) => !current.has(id)),
  }
}

interface ExistingUser {
  id: string
  email: string
  hr_employee_id: string | null
  role: string
  department_id: string | null
  is_active: boolean
  full_name: string
  puesto: string | null
  nivel_puesto: string | null
  sub_area: string | null
  proyecto: string | null
}

export async function syncOrg(
  admin: AdminClient,
  rows: OrgRow[],
  opts: { dryRun?: boolean } = {},
): Promise<SyncReport> {
  const dryRun = opts.dryRun ?? true
  const report: SyncReport = {
    dryRun,
    totalRows: rows.length,
    excluded: [],
    departmentsToCreate: [],
    departmentsExisting: 0,
    usersCreated: 0,
    usersUpdated: 0,
    usersReactivated: 0,
    relationsCreated: 0,
    relationsClosed: 0,
    roots: [],
    deactivated: [],
    hrProtected: [],
    validationErrors: [],
    errors: [],
    people: [],
    relationChanges: [],
  }

  // 0) Validación dura: si falla, no se escribe nada.
  report.validationErrors = validateOrgCsv(rows)
  if (report.validationErrors.length > 0) return report

  const valid = rows.filter((r) => {
    if (r.estatus !== 'ACTIVO') { report.excluded.push(`${r.employeeId} — ${r.name} (estatus ${r.estatus || '—'})`); return false }
    if (!isValidEmail(r.email)) { report.excluded.push(`${r.employeeId} — ${r.name} (sin correo)`); return false }
    return true
  })

  // Resolución nombre→fila y derivación de roles.
  const byName = new Map(valid.map((r) => [r.name.toUpperCase(), r]))
  const leaderEmpIds = new Set<string>()
  const leadersByEmp = new Map<string, string[]>() // employeeId → employeeIds de sus jefes
  for (const r of valid) {
    const leaderIds = r.leaderNames
      .map((n) => byName.get(n)?.employeeId)
      .filter((x): x is string => !!x)
    leadersByEmp.set(r.employeeId, leaderIds)
    for (const id of leaderIds) leaderEmpIds.add(id)
  }
  const roleFor = (row: OrgRow): Role =>
    row.area === HR_AREA ? 'hr' : leaderEmpIds.has(row.employeeId) ? 'leader' : 'collaborator'

  // ---- Leer estado actual (para el diff real) -------------------------------
  const { data: existingUsersRaw } = await admin
    .from('users')
    .select('id, email, hr_employee_id, role, department_id, is_active, full_name, puesto, nivel_puesto, sub_area, proyecto')
  const existingUsers = (existingUsersRaw ?? []) as ExistingUser[]
  const byEmp = new Map(existingUsers.filter((u) => u.hr_employee_id).map((u) => [u.hr_employee_id as string, u]))
  const byEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u]))

  const { data: deptRaw } = await admin.from('departments').select('id, name')
  const deptMap: Record<string, string> = {}
  for (const d of (deptRaw ?? []) as Array<{ id: string; name: string }>) deptMap[d.name] = d.id

  // ---- 1) Departamentos (áreas) ---------------------------------------------
  const areas = Array.from(new Set(valid.map((r) => r.area)))
  for (const name of areas) {
    if (deptMap[name]) { report.departmentsExisting++; continue }
    report.departmentsToCreate.push(name)
    if (!dryRun) {
      const { data, error } = await admin.from('departments').insert({ name }).select('id').single()
      if (error) { report.errors.push(`dept ${name}: ${error.message}`); continue }
      deptMap[name] = data.id
    }
  }

  // ---- 2) Usuarios: plan + ejecución ---------------------------------------
  const empToUserId: Record<string, string> = {}
  for (const row of valid) {
    try {
      const existing = byEmp.get(row.employeeId) ?? byEmail.get(row.email)
      const role = roleFor(row)
      const newDeptId = deptMap[row.area] ?? null
      const profile = {
        full_name: row.name,
        department_id: newDeptId,
        role,
        hr_employee_id: row.employeeId,
        is_active: true,
        puesto: row.puesto,
        nivel_puesto: row.nivelPuesto,
        sub_area: row.subArea,
        proyecto: row.proyecto,
      }

      if (existing) {
        const changes: string[] = []
        if (existing.role !== role) changes.push(`rol: ${existing.role}→${role}`)
        if (existing.department_id !== newDeptId) changes.push(`área: ${row.area}`)
        if (existing.full_name !== row.name) changes.push('nombre')
        if (!existing.hr_employee_id) changes.push('vincula employee_id')
        if (existing.puesto !== row.puesto) changes.push(`puesto: ${row.puesto ?? '—'}`)
        if (existing.nivel_puesto !== row.nivelPuesto) changes.push(`nivel: ${row.nivelPuesto ?? '—'}`)
        if (existing.sub_area !== row.subArea) changes.push(`subárea: ${row.subArea ?? '—'}`)
        if (existing.proyecto !== row.proyecto) changes.push(`proyecto: ${row.proyecto ?? '—'}`)
        const reactivate = !existing.is_active
        if (reactivate) { report.usersReactivated++; changes.push('reactiva') }
        else if (changes.length > 0) report.usersUpdated++

        if (changes.length > 0) {
          report.people.push({ employeeId: row.employeeId, name: row.name, action: reactivate ? 'reactivate' : 'update', role, changes })
        }
        empToUserId[row.employeeId] = existing.id
        if (!dryRun && changes.length > 0) {
          await admin.from('users').update(profile).eq('id', existing.id)
        }
      } else {
        report.usersCreated++
        report.people.push({ employeeId: row.employeeId, name: row.name, action: 'create', role, changes: [] })
        if (!dryRun) {
          const { data: created, error: authErr } = await admin.auth.admin.createUser({
            email: row.email, email_confirm: true, user_metadata: { full_name: row.name },
          })
          let userId = created?.user?.id ?? null
          if (authErr || !userId) {
            // Reconciliación: si el email ya existe (p.ej. login OAuth previo creó
            // la fila sin hr_employee_id), recuperar esa fila en vez de duplicar.
            const { data: byMail } = await admin.from('users').select('id').eq('email', row.email).maybeSingle()
            if (byMail) { userId = byMail.id }
            else { report.errors.push(`createUser ${row.email}: ${authErr?.message ?? 'sin user'}`); continue }
          }
          await admin.from('users').update(profile).eq('id', userId)
          empToUserId[row.employeeId] = userId
        }
      }
    } catch (err) {
      report.errors.push(`user ${row.employeeId}: ${err instanceof Error ? err.message : 'error'}`)
    }
  }

  // ---- 3) Relaciones líder↔colaborador (multi-líder) ------------------------
  // Relaciones activas actuales por colaborador (LISTA: soporta multi-líder).
  const { data: relRaw } = await admin
    .from('leadership_relations')
    .select('id, leader_id, collaborator_id')
    .is('ended_at', null)
  const activeRelsByCollab = new Map<string, Array<{ id: string; leaderId: string }>>()
  for (const r of relRaw ?? []) {
    const list = activeRelsByCollab.get(r.collaborator_id) ?? []
    list.push({ id: r.id, leaderId: r.leader_id })
    activeRelsByCollab.set(r.collaborator_id, list)
  }
  const userIdToEmp = new Map<string, string>()
  for (const [emp, uid] of Object.entries(empToUserId)) userIdToEmp.set(uid, emp)

  for (const row of valid) {
    const desiredEmpIds = leadersByEmp.get(row.employeeId) ?? []
    // Raíz (sin jefe en el CSV): se registra pero NO se salta la reconciliación —
    // si venía con líder en un corte anterior, esa relación debe cerrarse.
    if (desiredEmpIds.length === 0) report.roots.push(row.employeeId)

    const collaboratorId = empToUserId[row.employeeId]
    const currentRels = collaboratorId ? (activeRelsByCollab.get(collaboratorId) ?? []) : []
    const currentByLeaderId = new Map(currentRels.map((r) => [r.leaderId, r]))

    // Diff en términos de employeeIds (los usuarios nuevos aún no tienen UUID
    // en dry-run; el employeeId siempre existe).
    const currentEmpIds = new Set(
      currentRels.map((r) => userIdToEmp.get(r.leaderId)).filter((x): x is string => !!x),
    )
    const { toClose, toCreate } = diffLeaderSets(new Set(desiredEmpIds), currentEmpIds)
    // Relaciones activas con líderes FUERA del CSV (sin employeeId mapeado)
    // también se cierran: el CSV es la fuente de verdad.
    const staleRels = currentRels.filter((r) => !userIdToEmp.get(r.leaderId))

    if (toClose.length === 0 && toCreate.length === 0 && staleRels.length === 0) continue

    report.relationChanges.push({
      collaboratorEmployeeId: row.employeeId,
      collaboratorName: row.name,
      closes: [...toClose, ...staleRels.map(() => '(fuera del CSV)')],
      creates: toCreate,
    })
    report.relationsClosed += toClose.length + staleRels.length
    report.relationsCreated += toCreate.length

    if (!dryRun) {
      if (!collaboratorId) {
        report.errors.push(`relación ${row.employeeId}: colaborador no resuelto`)
        continue
      }
      const nowIso = new Date().toISOString()
      for (const empId of toClose) {
        const rel = [...currentByLeaderId.values()].find((r) => userIdToEmp.get(r.leaderId) === empId)
        if (rel) await admin.from('leadership_relations').update({ ended_at: nowIso }).eq('id', rel.id)
      }
      for (const rel of staleRels) {
        await admin.from('leadership_relations').update({ ended_at: nowIso }).eq('id', rel.id)
      }
      for (const empId of toCreate) {
        const leaderId = empToUserId[empId]
        if (!leaderId) { report.errors.push(`relación ${row.employeeId}→${empId}: líder no resuelto`); continue }
        const { error: insErr } = await admin.from('leadership_relations').insert({ leader_id: leaderId, collaborator_id: collaboratorId })
        if (insErr) report.errors.push(`relación ${row.employeeId}→${empId}: ${insErr.message}`)
      }
    }
  }

  // ---- 4) Bajas: usuarios con hr_employee_id ausentes del CSV → inactivar ---
  // y cerrar sus relaciones (como líder y como colaborador) para no dejar ramas
  // colgadas ni alarmas-fantasma. Los role='hr' se protegen (baja manual).
  const csvIds = new Set(valid.map((r) => r.employeeId))
  for (const u of existingUsers) {
    if (!u.hr_employee_id || csvIds.has(u.hr_employee_id) || !u.is_active) continue
    if (u.role === 'hr') { report.hrProtected.push(u.hr_employee_id); continue }
    report.deactivated.push(u.hr_employee_id)
    if (!dryRun) {
      await admin.from('users').update({ is_active: false }).eq('id', u.id)
      const nowIso = new Date().toISOString()
      await admin.from('leadership_relations').update({ ended_at: nowIso }).eq('collaborator_id', u.id).is('ended_at', null)
      await admin.from('leadership_relations').update({ ended_at: nowIso }).eq('leader_id', u.id).is('ended_at', null)
    }
  }

  return report
}
