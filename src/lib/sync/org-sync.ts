/**
 * Org-sync: importa el directorio de personal de B-Drive (CSV de RH) al sistema.
 *
 * Idempotente: matchea por `employee_id` (ID corporativo) y, como fallback, por
 * email. Crea departamentos, usuarios (Supabase Auth + public.users vía trigger
 * handle_new_user) y relaciones líder↔colaborador. Reusa el patrón de
 * scripts/seed.ts y de assignLeader (cerrar relación activa + insertar nueva).
 *
 * Reglas (decisiones acordadas):
 * - Filas sin email válido (N/A) se EXCLUYEN.
 * - Rol: 'hr' si área = Arquitectura Humana; si no, 'leader' si tiene reportes;
 *   si no, 'collaborator'. (El acceso real es por relación; el rol solo define
 *   landing + poderes RH.)
 * - Dueños (OWNER_EMPLOYEE_IDS): quedan raíz, sin relación como colaborador.
 * - Login sin password: los usuarios entran por Google SSO @b-drive.com.mx.
 *
 * `dryRun: true` no escribe nada; calcula y devuelve el SyncReport.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'

export const HR_AREA = 'ARQUITECTURA HUMANA Y TRANSFORMACION DEL TALENTO'
export const OWNER_EMPLOYEE_IDS = new Set(['0543', '1095'])

export interface OrgRow {
  employeeId: string
  name: string
  area: string
  email: string
  leaderEmployeeId: string
}

export interface SyncReport {
  dryRun: boolean
  totalRows: number
  excluded: string[]        // employeeIds sin email válido
  departmentsCreated: number
  departmentsExisting: number
  usersCreated: number
  usersUpdated: number
  relationsCreated: number  // en dryRun: aproximado (no-dueños válidos)
  relationsClosed: number
  ownersRoot: string[]
  deactivated: number
  errors: string[]
}

type Role = 'collaborator' | 'leader' | 'hr'

/** Parsea el CSV de RH. Devuelve TODAS las filas; el filtrado se hace en syncOrg. */
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

export async function syncOrg(
  admin: SupabaseClient,
  rows: OrgRow[],
  opts: { dryRun?: boolean } = {},
): Promise<SyncReport> {
  const dryRun = opts.dryRun ?? true
  const report: SyncReport = {
    dryRun,
    totalRows: rows.length,
    excluded: [],
    departmentsCreated: 0,
    departmentsExisting: 0,
    usersCreated: 0,
    usersUpdated: 0,
    relationsCreated: 0,
    relationsClosed: 0,
    ownersRoot: [],
    deactivated: 0,
    errors: [],
  }

  const valid = rows.filter((r) => {
    if (!isValidEmail(r.email)) {
      report.excluded.push(r.employeeId)
      return false
    }
    return true
  })

  // Quién lidera a alguien → rol 'leader' (salvo RH, que gana).
  const leaderIds = new Set(valid.map((r) => r.leaderEmployeeId))
  const roleFor = (row: OrgRow): Role =>
    row.area === HR_AREA ? 'hr' : leaderIds.has(row.employeeId) ? 'leader' : 'collaborator'

  // 1) Departamentos (upsert por nombre).
  const areas = Array.from(new Set(valid.map((r) => r.area)))
  const deptMap: Record<string, string> = {}
  for (const name of areas) {
    const { data: existing } = await admin
      .from('departments')
      .select('id')
      .eq('name', name)
      .maybeSingle()
    if (existing) {
      deptMap[name] = (existing as { id: string }).id
      report.departmentsExisting++
    } else if (dryRun) {
      report.departmentsCreated++
    } else {
      const { data, error } = await admin.from('departments').insert({ name }).select('id').single()
      if (error) { report.errors.push(`dept ${name}: ${error.message}`); continue }
      deptMap[name] = (data as { id: string }).id
      report.departmentsCreated++
    }
  }

  // 2) Usuarios (match por employee_id → email; crear o actualizar).
  const empToUserId: Record<string, string> = {}
  for (const row of valid) {
    try {
      let userId: string | null = null

      const { data: byEmp } = await admin
        .from('users').select('id').eq('employee_id', row.employeeId).maybeSingle()
      if (byEmp) userId = (byEmp as { id: string }).id
      if (!userId) {
        const { data: byMail } = await admin
          .from('users').select('id').eq('email', row.email).maybeSingle()
        if (byMail) userId = (byMail as { id: string }).id
      }

      if (userId) {
        report.usersUpdated++
        if (!dryRun) {
          await admin.from('users').update({
            full_name: row.name,
            department_id: deptMap[row.area] ?? null,
            role: roleFor(row),
            employee_id: row.employeeId,
            is_active: true,
          }).eq('id', userId)
        }
      } else {
        report.usersCreated++
        if (!dryRun) {
          // Sin password: el usuario entra por Google SSO. El trigger
          // handle_new_user crea public.users con full_name de user_metadata.
          const { data: created, error: authErr } = await admin.auth.admin.createUser({
            email: row.email,
            email_confirm: true,
            user_metadata: { full_name: row.name },
          })
          if (authErr || !created.user) {
            report.errors.push(`createUser ${row.email}: ${authErr?.message ?? 'sin user'}`)
            continue
          }
          userId = created.user.id
          await admin.from('users').update({
            full_name: row.name,
            department_id: deptMap[row.area] ?? null,
            role: roleFor(row),
            employee_id: row.employeeId,
            is_active: true,
          }).eq('id', userId)
        }
      }

      if (userId) empToUserId[row.employeeId] = userId
    } catch (err) {
      report.errors.push(`user ${row.employeeId}: ${err instanceof Error ? err.message : 'error'}`)
    }
  }

  // 3) Relaciones líder↔colaborador (los dueños quedan raíz).
  for (const row of valid) {
    if (OWNER_EMPLOYEE_IDS.has(row.employeeId)) {
      report.ownersRoot.push(row.employeeId)
      continue
    }
    if (dryRun) {
      // Aproximación: cada no-dueño válido tendría una relación activa.
      report.relationsCreated++
      continue
    }
    const collaboratorId = empToUserId[row.employeeId]
    const leaderId = empToUserId[row.leaderEmployeeId]
    if (!collaboratorId || !leaderId) {
      report.errors.push(`relación ${row.employeeId}→${row.leaderEmployeeId}: usuario no resuelto`)
      continue
    }

    const { data: active } = await admin
      .from('leadership_relations')
      .select('id, leader_id')
      .eq('collaborator_id', collaboratorId)
      .is('ended_at', null)
      .maybeSingle()

    const current = active as { id: string; leader_id: string } | null
    if (current && current.leader_id === leaderId) continue // sin cambios

    if (current) {
      await admin.from('leadership_relations')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', current.id)
      report.relationsClosed++
    }
    const { error: insErr } = await admin
      .from('leadership_relations')
      .insert({ leader_id: leaderId, collaborator_id: collaboratorId })
    if (insErr) report.errors.push(`relación ${row.employeeId}: ${insErr.message}`)
    else report.relationsCreated++
  }

  // 4) Bajas: usuarios con employee_id que ya no están en el CSV → inactivar.
  const csvIds = new Set(valid.map((r) => r.employeeId))
  const { data: known } = await admin
    .from('users')
    .select('id, employee_id')
    .not('employee_id', 'is', null)
  for (const u of (known ?? []) as Array<{ id: string; employee_id: string }>) {
    if (!csvIds.has(u.employee_id)) {
      report.deactivated++
      if (!dryRun) {
        await admin.from('users').update({ is_active: false }).eq('id', u.id)
      }
    }
  }

  return report
}
