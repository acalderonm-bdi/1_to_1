/**
 * Demo end-to-end: dispara TODAS las notificaciones que existen en 1to1
 * hacia Ariel (acalderonm@b-drive.com.mx) como si fueran reales.
 *
 * Acciones:
 *   1. Seed data realista (overdue meeting, agreement vencido, agreement por
 *      vencer, dispute fresh, notification_rule activa).
 *   2. Dispara cada cron + cada helper Slack.
 *   3. Imprime links de cada notificación + valida que la ruta exista.
 *   4. Imprime SQL inverso al final para revertir.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { notifyMissedMeeting, notifyDispute, notifyHRReport, notifySlackGeneric } from '../src/lib/slack/notify'
import { notifyByEmail } from '../src/lib/email/notify'

config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const ARIEL_ID = '37d45ceb-706c-497a-a735-83e4de4dd88a'
const ARIEL_EMAIL = 'acalderonm@b-drive.com.mx'
const ARIEL_SLACK = 'U0B40FX3UMP'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET ?? ''
const SLACK_CHANNEL = process.env.SLACK_DEFAULT_CHANNEL ?? ''

interface SeedResult {
  collabId: string
  meetingOverdueId: string
  meetingDisputedId: string
  agreementVencidoId: string
  agreementPorVencerId: string
  ruleId: string
}

async function seed(): Promise<SeedResult> {
  console.log('\n=== SEED ESCENARIO ===\n')

  // 1. Encontrar colab de Ariel
  const { data: rel } = await sb
    .from('leadership_relations')
    .select('collaborator_id, users!leadership_relations_collaborator_id_fkey(full_name)')
    .eq('leader_id', ARIEL_ID)
    .is('ended_at', null)
    .limit(1)
    .single()
  if (!rel) throw new Error('Ariel sin colab')
  const collabId = (rel as { collaborator_id: string }).collaborator_id
  const collabName = (rel as { users: { full_name: string } | { full_name: string }[] }).users
  const collabFullName = Array.isArray(collabName) ? collabName[0].full_name : collabName.full_name
  console.log(`Colab: ${collabFullName} (${collabId})`)

  // 2. Asegurar 1:1 vencida (cadence > 14d): envejecer todas las realizadas
  const past35 = new Date()
  past35.setDate(past35.getDate() - 35)
  await sb
    .from('one_on_ones')
    .update({ scheduled_at: past35.toISOString() } as never)
    .eq('leader_id', ARIEL_ID)
    .eq('collaborator_id', collabId)
    .eq('status', 'realizada')

  const { data: meetingOverdue } = await sb
    .from('one_on_ones')
    .select('id')
    .eq('leader_id', ARIEL_ID)
    .eq('collaborator_id', collabId)
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .single()
  const meetingOverdueId = (meetingOverdue as { id: string }).id
  console.log(`Meeting overdue: ${meetingOverdueId}`)

  // 3. Crear 1:1 con status='en_disputa' fresh (con motivos distintos)
  const past3 = new Date()
  past3.setDate(past3.getDate() - 3)
  const { data: ins } = await sb
    .from('one_on_ones')
    .insert({
      leader_id: ARIEL_ID,
      collaborator_id: collabId,
      scheduled_at: past3.toISOString(),
      duration_minutes: 30,
      modality: 'virtual',
      status: 'en_disputa',
      non_realization_reason: 'cancelada_cargas',
      created_by: ARIEL_ID,
    } as never)
    .select('id')
    .single()
  const meetingDisputedId = (ins as { id: string }).id
  console.log(`Meeting en disputa creada: ${meetingDisputedId}`)

  // 4. Crear acuerdos: 1 vencido y 1 por vencer, con responsible=Ariel
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const { data: agrV } = await sb
    .from('agreements')
    .insert({
      one_on_one_id: meetingOverdueId,
      responsible_id: ARIEL_ID,
      description: '[QA-NOTIF] Acuerdo vencido ayer',
      status: 'pendiente',
      due_date: yesterdayStr,
    } as never)
    .select('id')
    .single()
  const agreementVencidoId = (agrV as { id: string }).id
  console.log(`Acuerdo vencido: ${agreementVencidoId}`)

  const { data: agrPV } = await sb
    .from('agreements')
    .insert({
      one_on_one_id: meetingOverdueId,
      responsible_id: ARIEL_ID,
      description: '[QA-NOTIF] Acuerdo por vencer mañana',
      status: 'pendiente',
      due_date: tomorrowStr,
    } as never)
    .select('id')
    .single()
  const agreementPorVencerId = (agrPV as { id: string }).id
  console.log(`Acuerdo por vencer: ${agreementPorVencerId}`)

  // 5. Notification rule activa con audience=leader y canales [in_app, slack, email]
  // Para que check-thresholds tire dispatches reales hacia Ariel
  const { data: existingRule } = await sb
    .from('notification_rules')
    .select('id')
    .eq('name', '[QA-NOTIF] Acuerdos vencidos a líderes')
    .maybeSingle()

  let ruleId: string
  if (existingRule) {
    ruleId = (existingRule as { id: string }).id
    await sb
      .from('notification_rules')
      .update({ enabled: true, channels: ['in_app', 'slack', 'email'], audience: ['leader'] } as never)
      .eq('id', ruleId)
    console.log(`Rule existente reactivada: ${ruleId}`)
  } else {
    const { data: newRule } = await sb
      .from('notification_rules')
      .insert({
        name: '[QA-NOTIF] Acuerdos vencidos a líderes',
        trigger_type: 'acuerdo_vencido',
        channels: ['in_app', 'slack', 'email'],
        audience: ['leader'],
        enabled: true,
        threshold: null,
      } as never)
      .select('id')
      .single()
    ruleId = (newRule as { id: string }).id
    console.log(`Rule creada: ${ruleId}`)
  }

  // 6. Limpiar notification_dispatches del día para evitar cooldown
  await sb
    .from('notification_dispatches')
    .delete()
    .eq('rule_id', ruleId)
    .eq('recipient_id', ARIEL_ID)

  return {
    collabId,
    meetingOverdueId,
    meetingDisputedId,
    agreementVencidoId,
    agreementPorVencerId,
    ruleId,
  }
}

async function triggerCron(path: string): Promise<unknown> {
  const url = `http://localhost:3000${path}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  })
  return res.json()
}

async function validateLink(path: string): Promise<{ ok: boolean; status: number }> {
  // Sin auth — un 200 o 307 (redirect a login) significa "ruta existe"; 404 significa rota.
  const res = await fetch(`http://localhost:3000${path}`, { redirect: 'manual' })
  return { ok: res.status < 400, status: res.status }
}

async function main() {
  if (!CRON_SECRET) {
    console.error('Falta CRON_SECRET')
    process.exit(1)
  }
  if (!SLACK_CHANNEL) {
    console.error('Falta SLACK_DEFAULT_CHANNEL')
    process.exit(1)
  }

  const data = await seed()

  console.log('\n=== DISPARANDO NOTIFICACIONES ===\n')

  // --- 1. check-cadence: DM a Ariel "te falta 1:1 con X"
  console.log('1) /api/cron/check-cadence (Slack DM cadencia vencida)')
  console.log('  →', await triggerCron('/api/cron/check-cadence'))

  // --- 2. notify-due-agreements: in-app "tu acuerdo vence mañana"
  console.log('\n2) /api/cron/notify-due-agreements (in-app acuerdo por vencer)')
  console.log('  →', await triggerCron('/api/cron/notify-due-agreements'))

  // --- 3. check-thresholds: in_app + email + slack via rule "acuerdo_vencido"
  console.log('\n3) /api/cron/check-thresholds (in_app + email + slack vía rule)')
  console.log('  →', await triggerCron('/api/cron/check-thresholds'))

  // --- 4. notifyDispute manual (simulando markNonRealization con goToDispute=true)
  console.log('\n4) notifyDispute (canal RH)')
  const meetingDate = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  const dispRes = await notifyDispute(
    SLACK_CHANNEL,
    'Ariel Calderon',
    'Colab Demo',
    meetingDate,
    data.meetingDisputedId,
  )
  console.log('  →', dispRes)

  // --- 5. notifyHRReport (canal RH)
  console.log('\n5) notifyHRReport (canal RH — reporte semanal demo)')
  const repRes = await notifyHRReport(
    SLACK_CHANNEL,
    'Reporte semanal demo',
    [
      'Semana del 8–14 may 2026:',
      '• 5 1:1s realizadas · 2 no realizadas (sin justificación)',
      '• 3 acuerdos cumplidos · 1 vencido',
      `• Disputa nueva: <${APP_URL}/arquitectura-humana/disputas|Ver>`,
    ].join('\n'),
  )
  console.log('  →', repRes)

  // --- 6. notifySlackGeneric con link (DM a Ariel — recordatorio próximo 1:1)
  console.log('\n6) notifySlackGeneric (DM con link)')
  const genRes = await notifySlackGeneric(
    ARIEL_SLACK,
    'Recordatorio: 1:1 mañana',
    'Tu próxima 1:1 está agendada para mañana 10:00. Prepará tu agenda.',
    '/lider/equipo',
  )
  console.log('  →', genRes)

  // --- 7. notifyByEmail (si Resend está, sino skipped)
  console.log('\n7) notifyByEmail (test directo del helper)')
  const emailRes = await notifyByEmail({
    to: [ARIEL_EMAIL],
    subject: '[1to1] Test de email branded',
    html: '<p>Hola Ariel, este es un test del helper de email.</p><p><a href="' + APP_URL + '/lider" style="background:#ED6134;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Ir al dashboard</a></p>',
    recipientRole: 'leader',
  })
  console.log('  →', emailRes)

  console.log('\n=== VALIDACIÓN DE LINKS ===\n')
  const links = [
    '/lider',
    '/lider/equipo',
    `/lider/colaborador/${data.collabId}`,
    `/lider/1to1/${data.meetingOverdueId}`,
    `/lider/1to1/${data.meetingDisputedId}`,
    '/lider/configuracion',
    '/colaborador',
    '/colaborador/acuerdos',
    '/colaborador/1to1/nueva',
    `/colaborador/1to1/nueva?colab=${data.collabId}`,
    '/colaborador/configuracion',
    '/arquitectura-humana',
    '/arquitectura-humana/disputas',
    `/arquitectura-humana/disputas?id=${data.meetingDisputedId}`,
    '/arquitectura-humana/mapa-calor',
    '/arquitectura-humana/exportes',
    '/arquitectura-humana/configuracion',
  ]
  for (const link of links) {
    const r = await validateLink(link)
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.status} ${link}`)
  }

  console.log('\n=== REVERT SQL (para limpiar) ===')
  console.log(`DELETE FROM agreements WHERE id IN ('${data.agreementVencidoId}', '${data.agreementPorVencerId}');`)
  console.log(`DELETE FROM one_on_ones WHERE id = '${data.meetingDisputedId}';`)
  console.log(`DELETE FROM notification_rules WHERE id = '${data.ruleId}';`)
  console.log(`DELETE FROM notification_dispatches WHERE recipient_id = '${ARIEL_ID}';`)
}

main().catch((e) => {
  console.error('FAIL:', e)
  process.exit(1)
})
