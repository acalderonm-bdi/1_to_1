/**
 * Script standalone para sync HR desde Excel.
 * Uso: node scripts/sync-hr-excel.mjs /path/to/file.xlsx
 */
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { randomUUID } from 'crypto'

const SUPABASE_URL = 'https://mlmpjeneeckfdyqavwgj.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sbXBqZW5lZWNrZmR5cWF2d2dqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA4MzgyNiwiZXhwIjoyMDkzNjU5ODI2fQ.pIfzuH_K9bS07G7hYMqep0Nz1jAKlWKPDPVkTfDrLDg'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
})

const excelPath = process.argv[2] || '/home/admin/telegram_files/Base activos y líderes 18.05.2026.xlsx'

console.log(`\nLeyendo Excel: ${excelPath}\n`)
const buf = readFileSync(excelPath)
const wb = XLSX.read(buf, { type: 'buffer' })
const ws = wb.Sheets['PERSONAL ACTIVO']
const rawData = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false })

// Parse rows
const rows = []
for (const r of rawData) {
  const keys = Object.keys(r)
  const find = (cands) => keys.find(k => cands.some(c => k.toUpperCase().replace(/[ÁÉÍÓÚ]/g, m => ({Á:'A',É:'E',Í:'I',Ó:'O',Ú:'U'}[m]??m)).includes(c)))
  const colId = find(['ID'])
  const colNombre = find(['NOMBRE'])
  const colArea = find(['AREA'])
  const colCorreo = find(['CORREO'])
  const colLider = find(['LIDER'])
  if (!colId) break
  const rawId = String(r[colId] ?? '').trim()
  const hr_id = rawId.replace(/\.0$/, '').padStart(4, '0')
  const rawLider = r[colLider]
  let leader_hr_id = null
  if (rawLider !== null && rawLider !== '' && rawLider !== undefined) {
    leader_hr_id = String(Math.round(parseFloat(String(rawLider)))).padStart(4, '0')
  }
  rows.push({
    hr_id,
    full_name: String(r[colNombre] ?? '').trim(),
    email: String(r[colCorreo] ?? '').trim().toLowerCase(),
    area: String(r[colArea] ?? '').trim(),
    leader_hr_id,
  })
}
console.log(`Filas leídas: ${rows.length}`)

// Determine roles: anyone who appears as a leader_hr_id is a 'leader'
const leaderIds = new Set(rows.map(r => r.leader_hr_id).filter(Boolean))
for (const r of rows) {
  r.role = leaderIds.has(r.hr_id) ? 'leader' : 'collaborator'
}
console.log(`Líderes: ${[...leaderIds].length}, Colaboradores: ${rows.filter(r=>r.role==='collaborator').length}\n`)

// 1. Upsert departments
const areas = [...new Set(rows.map(r => r.area).filter(Boolean))]
console.log(`Sincronizando ${areas.length} departamentos...`)
const deptMap = {} // area name -> uuid
for (const name of areas) {
  const { data, error } = await admin.from('departments').upsert({ name }, { onConflict: 'name' }).select('id, name').single()
  if (error) { console.error('  Dept error:', name, error.message); continue }
  deptMap[name] = data.id
}
console.log(`  OK: ${Object.keys(deptMap).length} departamentos\n`)

// 2. Get existing users by hr_employee_id or email
const { data: existingUsers } = await admin.from('users').select('id, email, hr_employee_id, role, full_name, department_id, is_active')
const byHrId = {}
const byEmail = {}
for (const u of (existingUsers || [])) {
  if (u.hr_employee_id) byHrId[u.hr_employee_id] = u
  if (u.email) byEmail[u.email] = u
}

// 3. Upsert users
console.log(`Sincronizando ${rows.length} usuarios...`)
let created = 0, updated = 0, skipped = 0
const hrIdToDbId = {} // hr_id -> uuid

for (const row of rows) {
  const dept_id = deptMap[row.area] ?? null
  const existing = byHrId[row.hr_id] ?? byEmail[row.email]

  if (existing) {
    // Update
    const { error } = await admin.from('users').update({
      full_name: row.full_name,
      email: row.email,
      hr_employee_id: row.hr_id,
      role: existing.role === 'hr' ? 'hr' : row.role, // never downgrade hr
      department_id: dept_id,
      is_active: true,
    }).eq('id', existing.id)
    if (error) { console.error('  Update error:', row.email, error.message); skipped++; continue }
    hrIdToDbId[row.hr_id] = existing.id
    updated++
  } else {
    // Create auth user first
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: row.email,
      email_confirm: true,
      user_metadata: { full_name: row.full_name },
    })
    if (authErr) {
      // Maybe auth user exists already — try to find by email in auth
      console.error('  Auth create error:', row.email, authErr.message)
      skipped++
      continue
    }
    const newId = authData.user.id
    // public.users trigger may have created it already
    const { data: existing2 } = await admin.from('users').select('id').eq('id', newId).single()
    if (existing2) {
      await admin.from('users').update({
        full_name: row.full_name,
        hr_employee_id: row.hr_id,
        role: row.role,
        department_id: dept_id,
        is_active: true,
      }).eq('id', newId)
    } else {
      await admin.from('users').insert({
        id: newId,
        email: row.email,
        full_name: row.full_name,
        hr_employee_id: row.hr_id,
        role: row.role,
        department_id: dept_id,
        is_active: true,
      })
    }
    hrIdToDbId[row.hr_id] = newId
    created++
  }
}
console.log(`  Creados: ${created}, Actualizados: ${updated}, Errores: ${skipped}\n`)

// Rebuild maps after upsert
const { data: allUsers } = await admin.from('users').select('id, email, hr_employee_id')
const finalByHrId = {}
const finalByEmail = {}
for (const u of (allUsers || [])) {
  if (u.hr_employee_id) finalByHrId[u.hr_employee_id] = u.id
  if (u.email) finalByEmail[u.email] = u.id
}

// 4. Upsert leadership_relations
console.log('Sincronizando relaciones líder-colaborador...')
let relCreated = 0, relSkipped = 0
for (const row of rows) {
  if (!row.leader_hr_id) continue
  const collabId = finalByHrId[row.hr_id] ?? finalByEmail[row.email]
  const leaderId = finalByHrId[row.leader_hr_id]
  if (!collabId || !leaderId) { relSkipped++; continue }

  // Check if relation already exists
  const { data: existRel } = await admin.from('leadership_relations')
    .select('id').eq('collaborator_id', collabId).eq('leader_id', leaderId).maybeSingle()
  if (existRel) continue

  const { error } = await admin.from('leadership_relations').insert({
    collaborator_id: collabId,
    leader_id: leaderId,
  })
  if (error) { relSkipped++; continue }
  relCreated++
}
console.log(`  Relaciones creadas: ${relCreated}, Omitidas: ${relSkipped}\n`)

// 5. Final count
const { count: totalUsers } = await admin.from('users').select('*', { count: 'exact', head: true })
const { count: totalDepts } = await admin.from('departments').select('*', { count: 'exact', head: true })
const { count: totalRels } = await admin.from('leadership_relations').select('*', { count: 'exact', head: true })

console.log('=== SYNC COMPLETO ===')
console.log(`Usuarios en DB: ${totalUsers}`)
console.log(`Departamentos: ${totalDepts}`)
console.log(`Relaciones líder-colaborador: ${totalRels}`)
