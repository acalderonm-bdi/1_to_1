import type { Block, KnownBlock } from '@slack/types'
import { getSlackClient } from './client'

interface SlackResult {
  sent: boolean
  skipped?: boolean
  error?: string
}

/**
 * Construye un link absoluto al app si se provee path relativo, o pasa-through
 * si ya es absoluto. Usado para deep-link en mensajes de Slack.
 */
function absoluteUrl(path: string): string {
  if (path.startsWith('http')) return path
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return `${appUrl}${path.startsWith('/') ? '' : '/'}${path}`
}

export async function notifyMissedMeeting(
  slackUserId: string,
  leaderName: string,
  collaboratorName: string,
  daysSince: number,
  collaboratorId?: string,
): Promise<SlackResult> {
  const client = getSlackClient()
  if (!client) return { sent: false, skipped: true }

  // Link accionable: el líder arma una nueva 1:1 con este colaborador.
  // Si no tenemos el id, fallback al equipo del líder.
  const link = collaboratorId
    ? absoluteUrl(`/lider/1to1/nueva?colab=${collaboratorId}`)
    : absoluteUrl('/lider/equipo')

  try {
    await client.chat.postMessage({
      channel: slackUserId,
      text: `Hola ${leaderName}, han pasado ${daysSince} días desde la última 1:1 con ${collaboratorName}.`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*1:1 pendiente con ${collaboratorName}*\nHan pasado *${daysSince} días* desde la última 1:1 con ${collaboratorName}. ¿Puedes agendarla pronto?`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Agendar 1:1' },
              url: link,
              style: 'primary',
            },
          ],
        },
      ],
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

  // Deep link a la disputa específica (el query ?id= lo lee la página de disputas
  // para auto-expandir el caso correspondiente).
  const link = absoluteUrl(`/arquitectura-humana/disputas?id=${oneOnOneId}`)

  try {
    await client.chat.postMessage({
      channel: hrSlackChannel,
      text: `Disputa en VoBo: 1:1 del ${meetingDate} entre ${leaderName} y ${collaboratorName}.`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Disputa en VoBo*\nLa 1:1 del *${meetingDate}* entre *${leaderName}* y *${collaboratorName}* tiene estados contradictorios.`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Ver disputa' },
              url: link,
              style: 'primary',
            },
          ],
        },
      ],
    })
    return { sent: true }
  } catch (err) {
    return { sent: false, error: String(err) }
  }
}

/**
 * Generic Slack DM helper. Posts a Block Kit message to the given user/channel.
 * Used by the notification dispatcher (cron/check-thresholds). Acepta `link`
 * opcional para deep-linking al recurso relacionado.
 */
export async function notifySlackGeneric(
  slackUserId: string,
  ruleName: string,
  message: string,
  link?: string,
): Promise<SlackResult> {
  const client = getSlackClient()
  if (!client) return { sent: false, skipped: true }

  const blocks: (KnownBlock | Block)[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*[${ruleName}]*\n${message}`,
      },
    },
  ]

  if (link) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Ver en 1to1' },
          url: absoluteUrl(link),
          style: 'primary',
        },
      ],
    })
  }

  try {
    await client.chat.postMessage({
      channel: slackUserId,
      // `text` is required as fallback for notifications/accessibility.
      text: `[${ruleName}] ${message}`,
      blocks,
    })
    return { sent: true }
  } catch (err) {
    return { sent: false, error: String(err) }
  }
}
