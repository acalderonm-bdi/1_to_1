'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/google/calendar'
import { notifyDispute } from '@/lib/slack/notify'
import { getOrgSetting } from '@/lib/org-settings'
import type { ActionResult, OneOnOne } from '@/types/domain'

const scheduleSchema = z.object({
  collaboratorId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(120).default(30),
  modality: z.enum(['virtual', 'presencial']),
  location: z.string().optional(),
  meetLink: z.string().url().optional(),
})

export async function scheduleOneOnOne(
  input: z.infer<typeof scheduleSchema>
): Promise<ActionResult<OneOnOne>> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user

  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = scheduleSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos' }
  }

  // Defense: solo líder o HR pueden agendar.
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()
  if (profile?.role !== 'leader' && profile?.role !== 'hr') {
    return { success: false, error: 'Solo líderes pueden agendar 1:1s' }
  }

  const { collaboratorId, scheduledAt, durationMinutes, modality, location, meetLink } = parsed.data

  const { data, error } = await supabase
    .from('one_on_ones')
    .insert({
      leader_id: user.id,
      collaborator_id: collaboratorId,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      modality,
      location: location ?? null,
      meet_link: meetLink ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  const accessToken = session?.provider_token
  if (accessToken && data) {
    const { data: people } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', [user.id, collaboratorId])
      .returns<Array<{ id: string; full_name: string; email: string }>>()

    const leader = people?.find(p => p.id === user.id)
    const collaborator = people?.find(p => p.id === collaboratorId)
    const attendees = [leader?.email, collaborator?.email].filter((e): e is string => !!e)
    const endIso = new Date(new Date(scheduledAt).getTime() + durationMinutes * 60_000).toISOString()
    const summary = `1:1 ${leader?.full_name ?? ''} ↔ ${collaborator?.full_name ?? ''}`.trim()
    const description = modality === 'virtual'
      ? 'Reunión 1:1 virtual. Meet link generado automáticamente.'
      : `Reunión 1:1 presencial.${location ? `\nUbicación: ${location}` : ''}`

    const cal = await createCalendarEvent({
      summary, description,
      startIso: scheduledAt, endIso,
      attendeeEmails: attendees,
      modality, accessToken,
    })

    if (cal.success) {
      await supabase
        .from('one_on_ones')
        .update({
          google_calendar_event_id: cal.eventId ?? null,
          meet_link: cal.meetLink ?? meetLink ?? null,
        })
        .eq('id', data.id)
      if (cal.meetLink) data.meet_link = cal.meetLink
      if (cal.eventId) data.google_calendar_event_id = cal.eventId
    } else {
      console.warn('[scheduleOneOnOne] Calendar event no creado:', cal.error)
    }
  }

  revalidatePath('/colaborador')
  revalidatePath('/lider')

  return { success: true, data }
}

const cancelSchema = z.object({
  oneOnOneId: z.string().uuid(),
  reason: z.enum(['reagendada', 'cancelada_cargas', 'ausencia', 'sin_justificacion']),
})

export async function cancelOneOnOne(
  input: z.infer<typeof cancelSchema>
): Promise<ActionResult> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = cancelSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  // Leer el evento de Calendar antes de marcar la 1:1
  const { data: meeting } = await supabase
    .from('one_on_ones')
    .select('google_calendar_event_id')
    .eq('id', parsed.data.oneOnOneId)
    .single<{ google_calendar_event_id: string | null }>()

  const { error } = await supabase
    .from('one_on_ones')
    .update({
      status: 'no_realizada',
      non_realization_reason: parsed.data.reason,
    })
    .eq('id', parsed.data.oneOnOneId)
    .or(`leader_id.eq.${user.id},collaborator_id.eq.${user.id}`)

  if (error) return { success: false, error: error.message }

  // Borrar evento de Google Calendar si existe (no rompe la cancelación si falla).
  if (meeting?.google_calendar_event_id && session.provider_token) {
    const del = await deleteCalendarEvent(meeting.google_calendar_event_id, session.provider_token)
    if (!del.success) console.warn('[cancelOneOnOne] Calendar delete falló:', del.error)
  }

  revalidatePath('/colaborador')
  revalidatePath('/lider')

  return { success: true }
}

// ---------------------------------------------------------------------------
// F2 — Justificación de sesiones (markNonRealization)
// ---------------------------------------------------------------------------
// Las nuevas columnas `non_realization_note`, `non_realization_marked_by` y
// `non_realization_marked_at` ya existen en el schema local (migración 7b),
// pero el tipo `Database` generado por `pnpm db:types` apunta al schema remoto
// que aún no las refleja. Por eso los payloads que las usan se castean con
// `as never` (ver `src/types/database.augmentation.ts`).
const markNonRealizationSchema = z.object({
  oneOnOneId: z.string().uuid(),
  reason: z.enum([
    'reagendada',
    'cancelada_cargas',
    'ausencia',
    'emergencia',
    'vacaciones',
    'sin_justificacion',
  ]),
  note: z.string().max(500).optional(),
})

export async function markNonRealization(
  input: z.infer<typeof markNonRealizationSchema>
): Promise<ActionResult<{ status: 'no_realizada' | 'en_disputa' }>> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = markNonRealizationSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const { data: meeting, error: fetchErr } = await supabase
    .from('one_on_ones')
    .select('id, leader_id, collaborator_id, status, non_realization_reason, scheduled_at')
    .eq('id', parsed.data.oneOnOneId)
    .single()

  if (fetchErr || !meeting) return { success: false, error: 'Reunión no encontrada' }

  // Soft-warning: si la sesión ya excedió el plazo configurable
  // (`non_realization_max_days`, default 7) desde su `scheduled_at`, lo
  // logueamos pero permitimos la operación. La política dura está pendiente de
  // decisión de producto — ver Pack 2 spec.
  const scheduledAtRaw = (meeting as { scheduled_at: string | null }).scheduled_at
  if (scheduledAtRaw) {
    const scheduledAt = new Date(scheduledAtRaw)
    if (!isNaN(scheduledAt.getTime())) {
      const maxDays = await getOrgSetting('non_realization_max_days')
      const daysSince = (Date.now() - scheduledAt.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince > maxDays) {
        console.warn(
          `[markNonRealization] one_on_one=${parsed.data.oneOnOneId} marcada fuera del plazo (` +
            `${daysSince.toFixed(1)}d > ${maxDays}d configurados). Se permite igualmente.`,
        )
      }
    }
  }

  const isParticipant = user.id === meeting.leader_id || user.id === meeting.collaborator_id
  if (!isParticipant) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single<{ role: string }>()
    if (profile?.role !== 'hr') return { success: false, error: 'Sin permisos' }
  }

  const previousReason = (meeting as { non_realization_reason: string | null }).non_realization_reason
  const newReason = parsed.data.reason
  const goToDispute = Boolean(previousReason && previousReason !== newReason)

  // Cast: type augmentation aún no propagada al tipo Database generado.
  const updatePayload = {
    status: goToDispute ? 'en_disputa' : 'no_realizada',
    non_realization_reason: newReason,
    non_realization_note: parsed.data.note ?? null,
    non_realization_marked_by: user.id,
    non_realization_marked_at: new Date().toISOString(),
  } as never

  const { error: updateErr } = await supabase
    .from('one_on_ones')
    .update(updatePayload)
    .eq('id', parsed.data.oneOnOneId)

  if (updateErr) return { success: false, error: updateErr.message }

  // Audit log (best-effort): el schema de audit_logs usa user_id/action/resource_type/resource_id/metadata.
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: goToDispute ? 'meeting_marked_disputed' : 'meeting_marked_not_realized',
    resource_type: 'one_on_one',
    resource_id: parsed.data.oneOnOneId,
    metadata: { reason: newReason, has_note: Boolean(parsed.data.note) },
  })

  // Slack a canal RH cuando se genera disputa. Best-effort: el helper ya hace
  // skip si falta SLACK_BOT_TOKEN, y acá guardamos contra falla de la API.
  const slackChannel = process.env.SLACK_DEFAULT_CHANNEL
  if (goToDispute && slackChannel) {
    const { data: people } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', [meeting.leader_id, meeting.collaborator_id])
      .returns<Array<{ id: string; full_name: string }>>()
    const leader = people?.find((p) => p.id === meeting.leader_id)
    const collab = people?.find((p) => p.id === meeting.collaborator_id)
    const meetingDate = scheduledAtRaw
      ? new Date(scheduledAtRaw).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'fecha desconocida'
    const slackRes = await notifyDispute(
      slackChannel,
      leader?.full_name ?? 'Líder',
      collab?.full_name ?? 'Colaborador',
      meetingDate,
      parsed.data.oneOnOneId,
    )
    if (!slackRes.sent && !slackRes.skipped) {
      console.warn('[markNonRealization] Slack notifyDispute falló:', slackRes.error)
    }
  }

  revalidatePath(`/colaborador/1to1/${parsed.data.oneOnOneId}`)
  revalidatePath(`/lider/1to1/${parsed.data.oneOnOneId}`)

  return { success: true, data: { status: goToDispute ? 'en_disputa' : 'no_realizada' } }
}

// ---------------------------------------------------------------------------
// F4 — Histórico al cambio de líder (dismissTransferBanner)
// ---------------------------------------------------------------------------
// La columna `transfer_banner_dismissed_at` (migración 8) existe en el schema
// local pero el tipo `Database` generado por `pnpm db:types` apunta al schema
// remoto que aún no la refleja. Por eso el payload se castea con `as never`
// (ver `src/types/database.augmentation.ts`).
const dismissTransferBannerSchema = z.object({
  leadershipRelationId: z.string().uuid(),
})

export async function dismissTransferBanner(
  input: z.infer<typeof dismissTransferBannerSchema>
): Promise<ActionResult<undefined>> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = dismissTransferBannerSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  // Cast: `transfer_banner_dismissed_at` aún no está en los tipos Database
  // generados. La operación es idempotente — un dismiss repetido sólo
  // reescribe el timestamp.
  const updatePayload = { transfer_banner_dismissed_at: new Date().toISOString() } as never

  const { error } = await supabase
    .from('leadership_relations')
    .update(updatePayload)
    .eq('id', parsed.data.leadershipRelationId)
    .eq('leader_id', user.id)

  if (error) return { success: false, error: error.message }

  // Revalidate dynamic route: el banner vive en /lider/colaborador/[id].
  // `revalidatePath('/lider', 'layout')` invalida todas las páginas bajo /lider.
  revalidatePath('/lider', 'layout')
  return { success: true }
}
