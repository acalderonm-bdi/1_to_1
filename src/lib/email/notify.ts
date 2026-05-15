import { getEmailClient } from './client'

interface EmailResult {
  sent: boolean
  skipped?: boolean
  error?: string
}

/**
 * Escapa caracteres HTML peligrosos. Necesario antes de interpolar texto de DB
 * (rule.name, full_name, etc.) en el `html` que se pasa a notifyByEmail —
 * sin esto, un nombre con `<script>` o `<a href="javascript:…">` pasaría al
 * cliente de email y podría ejecutar (clients legacy) o usarse para phishing.
 *
 * Uso: `notifyByEmail({ html: '<p>Hola ' + escapeHtml(user.name) + '</p>' })`
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

interface NotifyByEmailInput {
  /** Emails de destinatarios. Resend acepta múltiples direcciones por envío. */
  to: string[]
  subject: string
  /** HTML del cuerpo (sin <html>/<body>/<head> wrapper — el helper lo agrega). */
  html: string
  /** Fallback texto plano opcional. Recomendado para mejor entregabilidad. */
  text?: string
  /**
   * Rol del destinatario primario para construir el link "Configurar
   * notificaciones" del footer. Default: 'collaborator'.
   */
  recipientRole?: 'collaborator' | 'leader' | 'hr'
}

/**
 * Envuelve el HTML del usuario en un template mínimo con header (logo "1to1" coral)
 * y footer ("Enviado por 1to1 · B-Drive · Configurar notificaciones").
 *
 * El template usa estilos inline para máxima compatibilidad con Gmail/Outlook.
 */
function configurationPathFor(role: 'collaborator' | 'leader' | 'hr'): string {
  if (role === 'leader') return '/lider/configuracion'
  if (role === 'hr') return '/arquitectura-humana/configuracion'
  return '/colaborador/configuracion'
}

function wrapHtml(inner: string, role: 'collaborator' | 'leader' | 'hr' = 'collaborator'): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const configureUrl = `${appUrl}${configurationPathFor(role)}`
  return `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
    <div style="text-align: center; padding: 16px 0; border-bottom: 2px solid #ED6134;">
      <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 32px; font-weight: 600; color: #ED6134;">1to1</span>
    </div>
    <div style="padding: 24px 0;">${inner}</div>
    <div style="border-top: 1px solid #ddd; padding-top: 16px; font-size: 12px; color: #666; text-align: center;">
      Enviado por 1to1 · B-Drive · <a href="${configureUrl}" style="color: #ED6134; text-decoration: none;">Configurar notificaciones</a>
    </div>
  </body>
</html>`
}

/**
 * Envía email vía Resend.
 *
 * Comportamiento:
 * - Si `RESEND_API_KEY` no está seteada (getEmailClient() === null) o `EMAIL_FROM`
 *   no está configurada, retorna `{ sent: false, skipped: true }` silenciosamente
 *   (útil para dev local y CI sin credenciales reales).
 * - Si Resend retorna error (HTTP o validación), retorna `{ sent: false, error }`
 *   sin throwear, para que el caller pueda registrar el fallo en
 *   `notification_dispatches.failed_reason` sin romper el cron.
 *
 * @param input destinatarios + asunto + HTML del cuerpo (se envuelve en template)
 * @returns `EmailResult` con flags `sent` / `skipped` / `error`
 */
export async function notifyByEmail(input: NotifyByEmailInput): Promise<EmailResult> {
  const client = getEmailClient()
  if (!client) return { sent: false, skipped: true }

  const from = process.env.EMAIL_FROM
  if (!from) return { sent: false, skipped: true }

  try {
    const result = await client.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: wrapHtml(input.html, input.recipientRole ?? 'collaborator'),
      text: input.text,
    })
    if (result.error) {
      return { sent: false, error: result.error.message }
    }
    return { sent: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { sent: false, error: message }
  }
}
