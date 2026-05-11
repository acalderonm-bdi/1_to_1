'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/google/calendar'
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
