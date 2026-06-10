'use server'

import * as XLSX from 'xlsx'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireHR } from '@/lib/auth-guards'
import type { ActionResult } from '@/types/domain'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncPreview = {
  toCreate: Array<{
    hr_id: string
    full_name: string
    email: string
    area: string
    role: 'leader' | 'collaborator'
  }>
  toUpdate: Array<{
    id: string
    hr_id: string
    full_name: string
    email: string
    changes: string[]
  }>
  toDeactivate: Array<{
    id: string
    email: string
    full_name: string
  }>
  departmentsToCreate: string[]
  leadershipChanges: Array<{
    collaborator_email: string
    old_leader: string | null
    new_leader: string
  }>
  errors: string[]
}

// Raw row as read from Excel
interface HrRow {
  hr_id: string          // e.g. '0006'
  full_name: string
  email: string
  area: string
  leader_hr_id: string | null  // e.g. '1070'
}

// ---------------------------------------------------------------------------
// Excel parser
// ---------------------------------------------------------------------------

function parseExcel(buffer: ArrayBuffer): { rows: HrRow[]; errors: string[] } {
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

// ---------------------------------------------------------------------------
// previewExcelSync
// ---------------------------------------------------------------------------

export async function previewExcelSync(
  formData: FormData,
): Promise<ActionResult<SyncPreview>> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return { success: false, error: 'No se recibió archivo.' }
  }

  const buffer = await file.arrayBuffer()
  const { rows, errors } = parseExcel(buffer)

  if (errors.length > 0 && rows.length === 0) {
    return { success: false, error: errors.join(' | ') }
  }

  const admin = createAdminClient()

  // Fetch all current non-rh users
  const { data: dbUsers, error: usersErr } = await admin
    .from('users')
    .select('id, email, full_name, role, department_id, hr_employee_id, is_active')
  if (usersErr) return { success: false, error: usersErr.message }

  // Fetch all departments
  const { data: dbDepts, error: deptsErr } = await admin
    .from('departments')
    .select('id, name')
  if (deptsErr) return { success: false, error: deptsErr.message }

  // Fetch active leadership relations
  const { data: dbRelations, error: relErr } = await admin
    .from('leadership_relations')
    .select('collaborator_id, leader_id')
    .is('ended_at', null)
  if (relErr) return { success: false, error: relErr.message }

  // Build lookup maps
  const deptByName = new Map<string, string>() // name -> id
  for (const d of dbDepts ?? []) {
    deptByName.set(d.name.toLowerCase(), d.id)
  }

  const userByEmail = new Map<string, typeof dbUsers extends Array<infer U> ? U : never>()
  const userByHrId = new Map<string, typeof dbUsers extends Array<infer U> ? U : never>()
  for (const u of dbUsers ?? []) {
    userByEmail.set(u.email.toLowerCase(), u)
    if (u.hr_employee_id) userByHrId.set(u.hr_employee_id, u)
  }

  // Which hr_ids are leaders?
  const leaderHrIds = new Set<string>()
  for (const row of rows) {
    if (row.leader_hr_id) leaderHrIds.add(row.leader_hr_id)
  }

  // hr_id -> row
  const hrRowById = new Map<string, HrRow>()
  for (const row of rows) hrRowById.set(row.hr_id, row)

  const preview: SyncPreview = {
    toCreate: [],
    toUpdate: [],
    toDeactivate: [],
    departmentsToCreate: [],
    leadershipChanges: [],
    errors: [...errors],
  }

  // Departments to create
  const areasInExcel = new Set(rows.map((r) => r.area))
  for (const area of areasInExcel) {
    if (area && !deptByName.has(area.toLowerCase())) {
      preview.departmentsToCreate.push(area)
    }
  }

  // relMap: collaborator_id -> leader_id
  const relMap = new Map<string, string>()
  for (const rel of dbRelations ?? []) {
    relMap.set(rel.collaborator_id, rel.leader_id)
  }

  // Process Excel rows
  for (const row of rows) {
    const role: 'leader' | 'collaborator' = leaderHrIds.has(row.hr_id) ? 'leader' : 'collaborator'
    const existingByHrId = userByHrId.get(row.hr_id)
    const existingByEmail = userByEmail.get(row.email)
    const existing = existingByHrId ?? existingByEmail

    if (!existing) {
      // New user
      preview.toCreate.push({
        hr_id: row.hr_id,
        full_name: row.full_name,
        email: row.email,
        area: row.area,
        role,
      })
    } else {
      // Existing – check for changes
      const changes: string[] = []
      if (existing.full_name !== row.full_name) {
        changes.push(`nombre: "${existing.full_name}" → "${row.full_name}"`)
      }
      if (existing.email.toLowerCase() !== row.email) {
        changes.push(`email: "${existing.email}" → "${row.email}"`)
      }
      // Department
      const deptId = deptByName.get(row.area.toLowerCase())
      if (deptId && existing.department_id !== deptId) {
        changes.push(`área: cambio a "${row.area}"`)
      }
      // Role (skip rh)
      if (existing.role !== 'hr' && existing.role !== role) {
        changes.push(`rol: "${existing.role}" → "${role}"`)
      }
      if (!existing.is_active) {
        changes.push('reactivar usuario')
      }
      if (!existing.hr_employee_id) {
        changes.push('asignar hr_employee_id')
      }

      if (changes.length > 0) {
        preview.toUpdate.push({
          id: existing.id,
          hr_id: row.hr_id,
          full_name: row.full_name,
          email: row.email,
          changes,
        })
      }

      // Leadership changes
      if (row.leader_hr_id) {
        const leaderRow = hrRowById.get(row.leader_hr_id)
        if (leaderRow) {
          const leaderDbUser = userByHrId.get(row.leader_hr_id) ?? userByEmail.get(leaderRow.email)
          if (leaderDbUser) {
            const currentLeaderId = relMap.get(existing.id)
            if (currentLeaderId !== leaderDbUser.id) {
              const currentLeaderUser = currentLeaderId
                ? (dbUsers ?? []).find((u) => u.id === currentLeaderId)
                : null
              preview.leadershipChanges.push({
                collaborator_email: row.email,
                old_leader: currentLeaderUser?.email ?? null,
                new_leader: leaderRow.email,
              })
            }
          }
        }
      }
    }
  }

  // Users to deactivate: active non-rh users not in Excel
  const excelEmails = new Set(rows.map((r) => r.email))
  const excelHrIds = new Set(rows.map((r) => r.hr_id))
  for (const u of dbUsers ?? []) {
    if (u.role === 'hr' || !u.is_active) continue
    const inExcel =
      excelEmails.has(u.email.toLowerCase()) ||
      (u.hr_employee_id !== null && excelHrIds.has(u.hr_employee_id))
    if (!inExcel) {
      preview.toDeactivate.push({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
      })
    }
  }

  return { success: true, data: preview }
}

// ---------------------------------------------------------------------------
// applyExcelSync
// ---------------------------------------------------------------------------

export async function applyExcelSync(
  formData: FormData,
): Promise<ActionResult<{ created: number; updated: number; deactivated: number }>> {
  const guard = await requireHR()
  if (!guard.ok) return { success: false, error: guard.error }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return { success: false, error: 'No se recibió archivo.' }
  }

  const buffer = await file.arrayBuffer()
  const { rows, errors: parseErrors } = parseExcel(buffer)

  if (parseErrors.length > 0 && rows.length === 0) {
    return { success: false, error: parseErrors.join(' | ') }
  }

  const admin = createAdminClient()

  // Fetch current state
  const [usersRes, deptsRes, relationsRes] = await Promise.all([
    admin.from('users').select('id, email, full_name, role, department_id, hr_employee_id, is_active'),
    admin.from('departments').select('id, name'),
    admin.from('leadership_relations').select('collaborator_id, leader_id').is('ended_at', null),
  ])

  if (usersRes.error) return { success: false, error: usersRes.error.message }
  if (deptsRes.error) return { success: false, error: deptsRes.error.message }
  if (relationsRes.error) return { success: false, error: relationsRes.error.message }

  const dbUsers = usersRes.data ?? []
  const dbDepts = deptsRes.data ?? []
  const dbRelations = relationsRes.data ?? []

  // Build maps
  const deptByName = new Map<string, string>()
  for (const d of dbDepts) deptByName.set(d.name.toLowerCase(), d.id)

  const userByEmail = new Map<string, (typeof dbUsers)[0]>()
  const userByHrId = new Map<string, (typeof dbUsers)[0]>()
  for (const u of dbUsers) {
    userByEmail.set(u.email.toLowerCase(), u)
    if (u.hr_employee_id) userByHrId.set(u.hr_employee_id, u)
  }

  const relMap = new Map<string, string>()
  for (const rel of dbRelations) relMap.set(rel.collaborator_id, rel.leader_id)

  // Which hr_ids are leaders?
  const leaderHrIds = new Set<string>()
  for (const row of rows) {
    if (row.leader_hr_id) leaderHrIds.add(row.leader_hr_id)
  }

  let created = 0
  let updated = 0
  let deactivated = 0

  // 1. Upsert departments
  const areasInExcel = [...new Set(rows.map((r) => r.area).filter(Boolean))]
  for (const area of areasInExcel) {
    if (!deptByName.has(area.toLowerCase())) {
      const { data: newDept, error: deptErr } = await admin
        .from('departments')
        .insert({ name: area })
        .select('id, name')
        .single()
      if (deptErr) {
        // May race-insert; try fetching
        const { data: existing } = await admin
          .from('departments')
          .select('id, name')
          .eq('name', area)
          .single()
        if (existing) deptByName.set(existing.name.toLowerCase(), existing.id)
      } else if (newDept) {
        deptByName.set(newDept.name.toLowerCase(), newDept.id)
      }
    }
  }

  // 2. Upsert users – first pass (create/update without leadership)
  // We need all users in DB before we can resolve leader UUIDs
  for (const row of rows) {
    const role: 'leader' | 'collaborator' = leaderHrIds.has(row.hr_id) ? 'leader' : 'collaborator'
    const deptId = deptByName.get(row.area.toLowerCase()) ?? null
    const existing = userByHrId.get(row.hr_id) ?? userByEmail.get(row.email)

    if (!existing) {
      // Create via admin auth (creates auth user + sets metadata)
      // Since these employees may not have accounts yet, we create DB-only rows
      // The UUID will be generated by Supabase; we use upsert on email
      const { data: newUser, error: insErr } = await admin
        .from('users')
        .insert({
          id: crypto.randomUUID(),
          email: row.email,
          full_name: row.full_name,
          role,
          department_id: deptId,
          is_active: true,
          hr_employee_id: row.hr_id,
        })
        .select('id, email')
        .single()

      if (insErr) {
        // Conflict on email — try update
        const { data: conflictUser } = await admin
          .from('users')
          .select('id, email, hr_employee_id')
          .eq('email', row.email)
          .single()
        if (conflictUser) {
          await admin
            .from('users')
            .update({
              full_name: row.full_name,
              role: conflictUser.hr_employee_id ? undefined : role,
              department_id: deptId,
              is_active: true,
              hr_employee_id: row.hr_id,
            })
            .eq('id', conflictUser.id)
          userByHrId.set(row.hr_id, { ...conflictUser, full_name: row.full_name, role, department_id: deptId, is_active: true, hr_employee_id: row.hr_id })
          updated++
        }
      } else if (newUser) {
        userByHrId.set(row.hr_id, { id: newUser.id, email: newUser.email, full_name: row.full_name, role, department_id: deptId, is_active: true, hr_employee_id: row.hr_id })
        userByEmail.set(row.email, { id: newUser.id, email: newUser.email, full_name: row.full_name, role, department_id: deptId, is_active: true, hr_employee_id: row.hr_id })
        created++
      }
    } else {
      // Update
      const updates: Record<string, unknown> = {
        full_name: row.full_name,
        email: row.email,
        is_active: true,
        hr_employee_id: row.hr_id,
      }
      if (deptId) updates.department_id = deptId
      if (existing.role !== 'hr') updates.role = role

      const { error: updErr } = await admin
        .from('users')
        .update(updates)
        .eq('id', existing.id)

      if (!updErr) {
        // Refresh maps
        const refreshed = { ...existing, ...updates }
        userByHrId.set(row.hr_id, refreshed as typeof existing)
        userByEmail.set(row.email, refreshed as typeof existing)
        updated++
      }
    }
  }

  // 3. Update leadership relations
  for (const row of rows) {
    if (!row.leader_hr_id) continue

    const collaboratorUser = userByHrId.get(row.hr_id) ?? userByEmail.get(row.email)
    const leaderUser = userByHrId.get(row.leader_hr_id)

    if (!collaboratorUser || !leaderUser) continue
    if (collaboratorUser.id === leaderUser.id) continue

    const currentLeaderId = relMap.get(collaboratorUser.id)
    if (currentLeaderId === leaderUser.id) continue // no change

    // Close current active relation
    if (currentLeaderId) {
      await admin
        .from('leadership_relations')
        .update({ ended_at: new Date().toISOString() })
        .eq('collaborator_id', collaboratorUser.id)
        .is('ended_at', null)
    }

    // Create new relation
    await admin.from('leadership_relations').insert({
      collaborator_id: collaboratorUser.id,
      leader_id: leaderUser.id,
    })

    relMap.set(collaboratorUser.id, leaderUser.id)
  }

  // 4. Deactivate users not in Excel
  const excelEmails = new Set(rows.map((r) => r.email))
  const excelHrIds = new Set(rows.map((r) => r.hr_id))
  const toDeactivateIds: string[] = []

  for (const u of dbUsers) {
    if (u.role === 'hr' || !u.is_active) continue
    const inExcel =
      excelEmails.has(u.email.toLowerCase()) ||
      (u.hr_employee_id !== null && excelHrIds.has(u.hr_employee_id))
    if (!inExcel) toDeactivateIds.push(u.id)
  }

  if (toDeactivateIds.length > 0) {
    const { error: deactErr } = await admin
      .from('users')
      .update({ is_active: false })
      .in('id', toDeactivateIds)
    if (!deactErr) deactivated = toDeactivateIds.length
  }

  // 5. Audit log
  await admin.from('audit_logs').insert({
    user_id: guard.user.id,
    action: 'hr_excel_sync',
    resource_type: 'users',
    metadata: { created, updated, deactivated, parse_errors: parseErrors.length },
  })

  return { success: true, data: { created, updated, deactivated } }
}
