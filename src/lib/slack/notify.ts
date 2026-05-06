import { getSlackClient } from './client'

interface SlackResult {
  sent: boolean
  skipped?: boolean
  error?: string
}

export async function notifyMissedMeeting(
  slackUserId: string,
  leaderName: string,
  collaboratorName: string,
  daysSince: number
): Promise<SlackResult> {
  const client = getSlackClient()
  if (!client) return { sent: false, skipped: true }

  try {
    await client.chat.postMessage({
      channel: slackUserId,
      text: `⚠️ Hola ${leaderName}, han pasado ${daysSince} días desde la última 1:1 con ${collaboratorName}. ¿Puedes agendarla pronto?`,
    })
    return { sent: true }
  } catch (err) {
    return { sent: false, error: String(err) }
  }
}

export async function notifyHRReport(
  channel: string,
  title: string,
  content: string
): Promise<SlackResult> {
  const client = getSlackClient()
  if (!client) return { sent: false, skipped: true }

  try {
    await client.chat.postMessage({
      channel,
      text: `📊 *${title}*\n\n${content}`,
    })
    return { sent: true }
  } catch (err) {
    return { sent: false, error: String(err) }
  }
}

export async function notifyDispute(
  hrSlackChannel: string,
  leaderName: string,
  collaboratorName: string,
  meetingDate: string,
  oneOnOneId: string
): Promise<SlackResult> {
  const client = getSlackClient()
  if (!client) return { sent: false, skipped: true }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  try {
    await client.chat.postMessage({
      channel: hrSlackChannel,
      text: `🚨 *Disputa en VoBo*\nLa 1:1 del ${meetingDate} entre ${leaderName} y ${collaboratorName} tiene estados contradictorios.\n<${appUrl}/arquitectura-humana/disputas|Ver disputa>`,
    })
    return { sent: true }
  } catch (err) {
    return { sent: false, error: String(err) }
  }
}
