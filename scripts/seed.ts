import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { addDays, subDays, subWeeks, addHours } from 'date-fns'
import ws from 'ws'

config({ path: '.env.local' })

;(globalThis as unknown as { WebSocket: unknown }).WebSocket = ws

const DEMO_PASSWORD = 'Demo1234!'

const DEPARTMENTS = [
  'Tecnología',
  'Producto',
  'Diseño',
  'Arquitectura Humana',
  'Ventas',
  'Operaciones',
]

interface UserSeed {
  email: string
  name: string
  role: 'leader' | 'collaborator'
  dept: string
  leaderEmail?: string
}

const USERS: UserSeed[] = [
  { email: 'lider.tech@demo.com', name: 'Carolina Méndez', role: 'leader', dept: 'Tecnología' },
  { email: 'lider.producto@demo.com', name: 'Roberto Silva', role: 'leader', dept: 'Producto' },
  { email: 'lider.diseno@demo.com', name: 'Ana Patricia Ruiz', role: 'leader', dept: 'Diseño' },
  { email: 'dev1@demo.com', name: 'Luis Hernández', role: 'collaborator', dept: 'Tecnología', leaderEmail: 'lider.tech@demo.com' },
  { email: 'dev2@demo.com', name: 'María González', role: 'collaborator', dept: 'Tecnología', leaderEmail: 'lider.tech@demo.com' },
  { email: 'dev3@demo.com', name: 'Pedro Ramírez', role: 'collaborator', dept: 'Tecnología', leaderEmail: 'lider.tech@demo.com' },
  { email: 'pm1@demo.com', name: 'Sofía Vargas', role: 'collaborator', dept: 'Producto', leaderEmail: 'lider.producto@demo.com' },
  { email: 'pm2@demo.com', name: 'Diego Morales', role: 'collaborator', dept: 'Producto', leaderEmail: 'lider.producto@demo.com' },
  { email: 'designer1@demo.com', name: 'Valentina López', role: 'collaborator', dept: 'Diseño', leaderEmail: 'lider.diseno@demo.com' },
  { email: 'designer2@demo.com', name: 'Jorge Castillo', role: 'collaborator', dept: 'Diseño', leaderEmail: 'lider.diseno@demo.com' },
]

async function main() {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']

  if (!supabaseUrl || !serviceKey) throw new Error('Faltan variables de entorno')

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('   Creando departamentos...')
  const deptMap: Record<string, string> = {}
  for (const name of DEPARTMENTS) {
    const { data: existing } = await supabase.from('departments').select('id').eq('name', name).maybeSingle()
    if (existing) {
      deptMap[name] = existing.id
    } else {
      const { data, error } = await supabase.from('departments').insert({ name }).select('id').single()
      if (error) throw error
      deptMap[name] = data.id
    }
  }

  // Cadencia global 14 días
  const { data: existingCadence } = await supabase
    .from('cadence_configs')
    .select('id')
    .eq('scope_type', 'global')
    .maybeSingle()

  if (!existingCadence) {
    await supabase.from('cadence_configs').insert({
      scope_type: 'global',
      frequency_days: 14,
    })
  }

  console.log('   Creando usuarios demo...')
  const userMap: Record<string, string> = {}

  for (const u of USERS) {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', u.email)
      .maybeSingle()

    if (existing) {
      userMap[u.email] = existing.id
      continue
    }

    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.name },
    })
    if (authErr) throw authErr

    const userId = authUser.user!.id
    userMap[u.email] = userId

    await supabase.from('users').update({
      role: u.role,
      full_name: u.name,
      department_id: deptMap[u.dept],
    }).eq('id', userId)
  }

  console.log('   Creando relaciones líder-colaborador...')
  for (const u of USERS.filter(u => u.leaderEmail)) {
    const leaderId = userMap[u.leaderEmail!]
    const collabId = userMap[u.email]
    if (!leaderId || !collabId) continue

    const { data: existing } = await supabase
      .from('leadership_relations')
      .select('id')
      .eq('leader_id', leaderId)
      .eq('collaborator_id', collabId)
      .is('ended_at', null)
      .maybeSingle()

    if (!existing) {
      await supabase.from('leadership_relations').insert({
        leader_id: leaderId,
        collaborator_id: collabId,
      })
    }
  }

  console.log('   Creando 1:1s y acuerdos de ejemplo...')
  const collaborators = USERS.filter(u => u.leaderEmail)

  for (const collab of collaborators) {
    const leaderId = userMap[collab.leaderEmail!]
    const collabId = userMap[collab.email]
    if (!leaderId || !collabId) continue

    // 1:1 pasada hace 3 semanas — realizada con acuerdos
    const past3w = subWeeks(new Date(), 3)
    const { data: past3wMeeting } = await supabase.from('one_on_ones').insert({
      leader_id: leaderId,
      collaborator_id: collabId,
      scheduled_at: past3w.toISOString(),
      duration_minutes: 30,
      modality: 'virtual',
      meet_link: 'https://meet.google.com/demo-link',
      status: 'realizada',
      created_by: leaderId,
    }).select('id').single()

    if (past3wMeeting) {
      // Acuerdos de la 1:1 pasada
      const { data: agr1 } = await supabase.from('agreements').insert({
        one_on_one_id: past3wMeeting.id,
        description: 'Documentar el proceso de onboarding del área',
        responsible_id: collabId,
        due_date: subDays(new Date(), 7).toISOString().split('T')[0],
        status: 'cumplido',
        ai_generated: true,
        ai_confidence: 0.92,
      }).select('id').single()

      const { data: agr2 } = await supabase.from('agreements').insert({
        one_on_one_id: past3wMeeting.id,
        description: 'Revisar y actualizar las métricas del dashboard semanal',
        responsible_id: leaderId,
        due_date: subDays(new Date(), 5).toISOString().split('T')[0],
        status: 'parcial',
        ai_generated: true,
        ai_confidence: 0.87,
      }).select('id').single()

      if (agr1) {
        await supabase.from('agreement_followups').insert({
          agreement_id: agr1.id,
          reported_by_id: collabId,
          reported_status: 'cumplido',
          justification: 'Se completó la documentación y fue revisada por el equipo',
        })
      }

      if (agr2) {
        await supabase.from('agreement_followups').insert({
          agreement_id: agr2.id,
          reported_by_id: leaderId,
          reported_status: 'parcial',
          justification: 'Se actualizaron 3 de 5 métricas, pendiente completar las restantes',
        })
      }

      // VoBos de la 1:1 pasada
      await supabase.from('vobos').upsert([
        { one_on_one_id: past3wMeeting.id, user_id: leaderId, confirmed: true },
        { one_on_one_id: past3wMeeting.id, user_id: collabId, confirmed: true },
      ], { onConflict: 'one_on_one_id,user_id' })
    }

    // 1:1 pasada hace 1 semana — no realizada
    const past1w = subWeeks(new Date(), 1)
    const { data: past1wMeeting } = await supabase.from('one_on_ones').insert({
      leader_id: leaderId,
      collaborator_id: collabId,
      scheduled_at: past1w.toISOString(),
      duration_minutes: 30,
      modality: 'presencial',
      location: 'Sala de juntas A',
      status: 'no_realizada',
      non_realization_reason: 'cancelada_cargas',
      created_by: collabId,
    }).select('id').single()

    if (past1wMeeting) {
      await supabase.from('vobos').upsert([
        { one_on_one_id: past1wMeeting.id, user_id: leaderId, confirmed: false },
        { one_on_one_id: past1wMeeting.id, user_id: collabId, confirmed: false },
      ], { onConflict: 'one_on_one_id,user_id' })
    }

    // 1:1 agendada para la próxima semana
    const nextWeek = addDays(new Date(), 7)
    const nextMeetingTime = addHours(new Date(nextWeek.setHours(10, 0, 0, 0)), 0)
    await supabase.from('one_on_ones').insert({
      leader_id: leaderId,
      collaborator_id: collabId,
      scheduled_at: nextMeetingTime.toISOString(),
      duration_minutes: 45,
      modality: 'virtual',
      meet_link: 'https://meet.google.com/demo-next',
      status: 'agendada',
      created_by: leaderId,
    })
  }

  // Una 1:1 "en disputa" para el dashboard de RH
  const firstCollab = collaborators[0]
  if (firstCollab) {
    const leaderId = userMap[firstCollab.leaderEmail!]
    const collabId = userMap[firstCollab.email]
    if (leaderId && collabId) {
      const disputeDate = subDays(new Date(), 4)
      const { data: disputeMeeting } = await supabase.from('one_on_ones').insert({
        leader_id: leaderId,
        collaborator_id: collabId,
        scheduled_at: disputeDate.toISOString(),
        duration_minutes: 30,
        modality: 'virtual',
        status: 'en_disputa',
        created_by: leaderId,
      }).select('id').single()

      if (disputeMeeting) {
        await supabase.from('vobos').upsert([
          { one_on_one_id: disputeMeeting.id, user_id: leaderId, confirmed: true },
          { one_on_one_id: disputeMeeting.id, user_id: collabId, confirmed: false },
        ], { onConflict: 'one_on_one_id,user_id' })
      }
    }
  }

  // Reporte de IA de ejemplo para RH
  const techDeptId = deptMap['Tecnología']
  if (techDeptId) {
    await supabase.from('ai_reports').insert({
      scope_type: 'department',
      scope_id: techDeptId,
      title: 'Patrón detectado: acuerdos recurrentemente incumplidos',
      content: 'Se ha detectado que 2 de los colaboradores del área de Tecnología tienen acuerdos marcados como "parcial" en las últimas 3 sesiones consecutivas. Se recomienda revisar si la carga de trabajo está siendo realista en las estimaciones de los acuerdos. Líderes afectados: Carolina Méndez. Colaboradores involucrados: Luis Hernández, María González.',
      severity: 'warning',
      reviewed: false,
    })
  }

  console.log('   Seed completado exitosamente')
}

main().catch(err => {
  console.error('Error en seed:', err)
  process.exit(1)
})
