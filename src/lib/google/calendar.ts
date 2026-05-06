interface CalendarEventInput {
  summary: string
  description?: string
  startIso: string
  endIso: string
  attendeeEmails: string[]
  modality: 'virtual' | 'presencial'
  accessToken: string
}

interface CalendarEventOutput {
  success: boolean
  eventId?: string
  meetLink?: string
  error?: string
}

export async function createCalendarEvent(
  input: CalendarEventInput
): Promise<CalendarEventOutput> {
  try {
    const body: Record<string, unknown> = {
      summary: input.summary,
      description: input.description ?? '',
      start: { dateTime: input.startIso, timeZone: 'America/Mexico_City' },
      end: { dateTime: input.endIso, timeZone: 'America/Mexico_City' },
      attendees: input.attendeeEmails.map(email => ({ email })),
    }

    if (input.modality === 'virtual') {
      body['conferenceData'] = {
        createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } },
      }
    }

    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      return { success: false, error: err }
    }

    const data = await res.json() as {
      id: string
      conferenceData?: { entryPoints?: Array<{ uri: string; entryPointType: string }> }
    }

    const meetLink = data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri

    return { success: true, eventId: data.id, meetLink }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function updateCalendarEvent(
  eventId: string,
  updates: Partial<CalendarEventInput> & { accessToken: string }
): Promise<CalendarEventOutput> {
  try {
    const body: Record<string, unknown> = {}
    if (updates.summary) body['summary'] = updates.summary
    if (updates.startIso) body['start'] = { dateTime: updates.startIso, timeZone: 'America/Mexico_City' }
    if (updates.endIso) body['end'] = { dateTime: updates.endIso, timeZone: 'America/Mexico_City' }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${updates.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      return { success: false, error: err }
    }

    return { success: true, eventId }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function deleteCalendarEvent(
  eventId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!res.ok && res.status !== 404) {
      const err = await res.text()
      return { success: false, error: err }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
