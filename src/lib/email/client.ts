import { Resend } from 'resend'

let _client: Resend | null = null

export function getEmailClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_client) {
    _client = new Resend(process.env.RESEND_API_KEY)
  }
  return _client
}

export function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'no-reply@sistema-1to1.com'
}
