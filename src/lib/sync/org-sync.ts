/**
 * Org-sync: importa el directorio de personal de B-Drive (CSV de RH) al sistema.
 *
 * Patrón plan→ejecutar: primero lee el estado actual y CALCULA el diff por
 * persona (esto es lo que devuelve el dry-run, para que RH apruebe con datos
 * reales); luego, en modo apply, ejecuta el plan. Idempotente por `employee_id`
 * (fallback email).
 *
 * Reglas (decisiones acordadas):
 * - Filas sin email válido (N/A) se EXCLUYEN.
 * - Rol: 'hr' si área = Arquitectura Humana; si no, 'leader' si tiene reportes;
 *   si no, 'collaborator'. (El acceso real es por relación; el rol solo define
 *   landing + poderes RH.)
 * - Dueños (OWNER_EMPLOYEE_IDS): quedan raíz, sin relación como colaborador.
 * - Login sin password: los usuarios entran por Google SSO @b-drive.com.mx.
 *
 * Transaccionalidad (H3.5): la creación de usuarios usa la Admin API de Auth,
 * que NO participa en una transacción SQL, así que no hay un rollback atómico.
 * En su lugar el proceso es IDEMPOTENTE y re-ejecutable: si falla a mitad, basta
 * re-correr — los usuarios ya creados se detectan (match por employee_id/email)
 * y se actualizan, y las relaciones se reconcilian por colaborador. El orden
 * (departamentos → usuarios → relaciones → bajas) garantiza que un corte deja
 * datos consistentes-hacia-adelante (a lo sumo usuarios sin relación, que la
 * siguiente corrida completa).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import type { Database } from '@/types/database.types'

type AdminClient = SupabaseClient<Database>

export const HR_AREA = 'ARQUITECTURA HUMANA Y TRANSFORMACION DEL TALENTO'
export const OWNER_EMPLOYEE_IDS = new Set(['0543', '1095'])
export const EMAIL_DOMAIN = '@b-drive.com.mx'

export interface OrgRow {
  employeeId: string
  name: string
  area: string
  email: string
  leaderEmployeeId: string
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
  fromLeaderEmployeeId: string | null
  toLeaderEmployeeId: string
}

export interface SyncReport {
  dryRun: boolean
  totalRows: number
  excluded: string[] // employeeIds sin email válido
  departmentsToCreate: string[]
  departmentsExisting: number
  usersCreated: number
  usersUpdated: number
  usersReactivated: number
  relationsCreated: number
  relationsClosed: number
  ownersRoot: string[]
  deactivated: string[] // employeeIds que ya no están en el CSV
  validationErrors: string[]
  errors: string[]
  people: PersonChange[] // diff por persona (create/update/reactivate; omite noop)
  relationChanges: RelationChange[]
}

/** Parsea el CSV de RH. Devuelve TODAS las filas; el filtrado/validación aparte. */
export function parseOrgCsv(content: string): OrgRow[] {
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[]

  return records.map((r) => ({
    employeeId: (r['ID'] ?? '').trim(),
    name: (r['NOMBRE'] ?? '').trim(),
    area: (r['AREA'] ?? '').trim(),
    email: (r['CORREO ELECTRONICO EMPRESARIAL'] ?? '').trim(),
    leaderEmployeeId: (r['LIDER INMEDIATO ID'] ?? '').trim(),
  }))
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
    errors.push('Columna "ID" no encontrada o vacía — ¿encabezados correctos? (ID, NOMBRE, AREA, CORREO ELECTRONICO EMPRESARIAL, LIDER INMEDIATO ID)')
    return errors
  }

  const ids = new Set<string>()
  const dups = new Set<string>()
  for (const r of rows) {
    if (!r.employeeId) { errors.push(`Fila con ID vacío (nombre: ${r.name || '—'}).`); continue }
    if (ids.has(r.employeeId)) dups.add(r.employeeId)
    ids.add(r.employeeId)
  }
  if (dups.size > 0) errors.push(`IDs duplicados: ${[...dups].join(', ')}.`)

  // Dominio: los correos presentes (no N/A) deben ser corporativos.
  const badDomain = rows.filter((r) => isValidEmail(r.email) && !r.email.toLowerCase().endsWith(EMAIL_DOMAIN))
  if (badDomain.length > 0) {
    errors.push(`${badDomain.length} correo(s) fuera de ${EMAIL_DOMAIN}: ${badDomain.slice(0, 5).map((r) => r.employeeId).join(', ')}${badDomain.length > 5 ? '…' : ''}.`)
  }

  // Líder referenciado debe existir en el archivo.
  const dangling = new Set<string>()
  for (const r of rows) {
    if (r.leaderEmployeeId && !ids.has(r.leaderEmployeeId)) dangling.add(r.leaderEmployeeId)
  }
  if (dangling.size > 0) errors.push(`Líderes referenciados que no están en el archivo: ${[...dangling].join(', ')}.`)

  // Ciclos entre no-dueños (los dueños son raíz por diseño).
  const leaderOf = new Map(rows.map((r) => [r.employeeId, r.leaderEmployeeId]))
  const cyclic = new Set<string>()
  for (const r of rows) {
    const seen = new Set<string>()
    let cur: string | undefined = r.employeeId
    while (cur && !OWNER_EMPLOYEE_IDS.has(cur)) {
      if (seen.has(cur)) { cyclic.add(cur); break }
      seen.add(cur)
      cur = leaderOf.get(cur)
      if (!cur) break
    }
  }
  if (cyclic.size > 0) errors.push(`Ciclos de liderazgo (no-dueños) detectados en: ${[...cyclic].slice(0, 10).join(', ')}.`)

  return errors
}

interface ExistingUser {
  id: string
  email: string
  employee_id: string | null
  role: string
  department_id: string | null
  is_active: boolean
  full_name: string
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
    ownersRoot: [],
    deactivated: [],
    validationErrors: [],
    errors: [],
    people: [],
    relationChanges: [],
  }

  // 0) Validación dura: si falla, no se escribe nada.
  report.validationErrors = validateOrgCsv(rows)
  if (report.validationErrors.length > 0) return report

  const valid = rows.filter((r) => {
    if (!isValidEmail(r.email)) { report.excluded.push(r.employeeId); return false }
    return true
  })

  const leaderIds = new Set(valid.map((r) => r.leaderEmployeeId))
  const roleFor = (row: OrgRow): Role =>
    row.area === HR_AREA ? 'hr' : leaderIds.has(row.employeeId) ? 'leader' : 'collaborator'

  // ---- Leer estado actual (para el diff real) -------------------------------
  const { data: existingUsersRaw } = await admin
    .from('users')
    .select('id, email, employee_id, role, department_id, is_active, full_name')
  const existingUsers = (existingUsersRaw ?? []) as ExistingUser[]
  const byEmp = new Map(existingUsers.filter((u) => u.employee_id).map((u) => [u.employee_id as string, u]))
  const byEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u]))

  const { data: deptRaw } = await admin.from('departments').select('id, name')
  const deptMap: Record<string, string> = {}
  for (const d of (deptRaw ?? []) as Array<{ id: string; name: string }>) deptMap[d.name] = d.id

  // ---- 1) Departamentos -----------------------------------------------------
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
      const existing = byEmp.get(row.employeeId) ?? byEmail.get(row.email.toLowerCase())
      const role = roleFor(row)
      const newDeptId = deptMap[row.area] ?? null

      if (existing) {
        const changes: string[] = []
        if (existing.role !== role) changes.push(`rol: ${existing.role}→${role}`)
        if (existing.department_id !== newDeptId) changes.push(`área: ${row.area}`)
        if (existing.full_name !== row.name) changes.push('nombre')
        if (!existing.employee_id) changes.push('vincula employee_id')
        const reactivate = !existing.is_active
        if (reactivate) { report.usersReactivated++; changes.push('reactiva') }
        else if (changes.length > 0) report.usersUpdated++

        if (changes.length > 0) {
          report.people.push({ employeeId: row.employeeId, name: row.name, action: reactivate ? 'reactivate' : 'update', role, changes })
        }
        empToUserId[row.employeeId] = existing.id
        if (!dryRun && (changes.length > 0)) {
          await admin.from('users').update({
            full_name: row.name, department_id: newDeptId, role, employee_id: row.employeeId, is_active: true,
          }).eq('id', existing.id)
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
            // Reconciliación (H3.3): si el email ya existe (p.ej. login OAuth previo
            // creó la fila sin employee_id), recuperar esa fila y actualizarla en
            // vez de duplicar/fallar.
            const { data: byMail } = await admin.from('users').select('id').eq('email', row.email).maybeSingle()
            if (byMail) { userId = byMail.id }
            else { report.errors.push(`createUser ${row.email}: ${authErr?.message ?? 'sin user'}`); continue }
          }
          await admin.from('users').update({
            full_name: row.name, department_id: newDeptId, role, employee_id: row.employeeId, is_active: true,
          }).eq('id', userId)
          empToUserId[row.employeeId] = userId
        }
      }
    } catch (err) {
      report.errors.push(`user ${row.employeeId}: ${err instanceof Error ? err.message : 'error'}`)
    }
  }

  // ---- 3) Relaciones líder↔colaborador (dueños = raíz) ----------------------
  // Mapa de relaciones activas existentes por colaborador (para el diff).
  const { data: relRaw } = await admin
    .from('leadership_relations')
    .select('id, leader_id, collaborator_id')
    .is('ended_at', null)
  const activeRelByCollab = new Map(
    (relRaw ?? []).map((r) => [r.collaborator_id, { id: r.id, leaderId: r.leader_id }]),
  )
  // userId → employeeId (para describir cambios en términos de IDs corporativos).
  const userIdToEmp = new Map<string, string>()
  for (const [emp, uid] of Object.entries(empToUserId)) userIdToEmp.set(uid, emp)

  for (const row of valid) {
    if (OWNER_EMPLOYEE_IDS.has(row.employeeId)) { report.ownersRoot.push(row.employeeId); continue }

    const collaboratorId = empToUserId[row.employeeId]
    const leaderId = empToUserId[row.leaderEmployeeId]
    const current = collaboratorId ? activeRelByCollab.get(collaboratorId) : undefined

    // En dry-run, los usuarios nuevos no tienen id todavía: si no hay relación
    // activa conocida, es una alta de relación.
    if (current && leaderId && current.leaderId === leaderId) continue // sin cambios

    report.relationChanges.push({
      collaboratorEmployeeId: row.employeeId,
      fromLeaderEmployeeId: current ? (userIdToEmp.get(current.leaderId) ?? null) : null,
      toLeaderEmployeeId: row.leaderEmployeeId,
    })

    if (!dryRun) {
      if (!collaboratorId || !leaderId) {
        report.errors.push(`relación ${row.employeeId}→${row.leaderEmployeeId}: usuario no resuelto`)
        continue
      }
      if (current) {
        await admin.from('leadership_relations').update({ ended_at: new Date().toISOString() }).eq('id', current.id)
        report.relationsClosed++
      }
      const { error: insErr } = await admin.from('leadership_relations').insert({ leader_id: leaderId, collaborator_id: collaboratorId })
      if (insErr) report.errors.push(`relación ${row.employeeId}: ${insErr.message}`)
      else report.relationsCreated++
    } else {
      if (current) report.relationsClosed++
      report.relationsCreated++
    }
  }

  // ---- 4) Bajas: usuarios con employee_id ausentes del CSV → inactivar ------
  // y cerrar sus relaciones (como líder y como colaborador) para no dejar ramas
  // colgadas ni alarmas-fantasma (H3.4).
  const csvIds = new Set(valid.map((r) => r.employeeId))
  for (const u of existingUsers) {
    if (!u.employee_id || csvIds.has(u.employee_id)) continue
    report.deactivated.push(u.employee_id)
    if (!dryRun) {
      await admin.from('users').update({ is_active: false }).eq('id', u.id)
      const nowIso = new Date().toISOString()
      await admin.from('leadership_relations').update({ ended_at: nowIso }).eq('collaborator_id', u.id).is('ended_at', null)
      await admin.from('leadership_relations').update({ ended_at: nowIso }).eq('leader_id', u.id).is('ended_at', null)
    }
  }

  return report
}
