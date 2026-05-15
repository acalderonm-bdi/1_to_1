/**
 * Test directo del helper notifyByEmail — manda un email de prueba a una dirección
 * hardcodeada (o la primera pasada como argumento) y loguea el resultado.
 *
 * Validación end-to-end de la integración Resend.
 *
 * Cómo usarlo:
 *   pnpm tsx scripts/email-test-notify.ts
 *   pnpm tsx scripts/email-test-notify.ts otro@ejemplo.com
 *
 * Requiere en `.env.local`:
 *   - RESEND_API_KEY=re_xxx
 *   - EMAIL_FROM="1to1 <noreply@dominio-verificado-en-resend.com>"
 *
 * Resultados esperados:
 *   - Sin RESEND_API_KEY o EMAIL_FROM:  { sent: false, skipped: true }
 *   - Con credenciales válidas:         { sent: true }
 *   - Con credenciales inválidas:       { sent: false, error: '...' }
 */
import { config } from 'dotenv'
import { notifyByEmail } from '../src/lib/email/notify'

config({ path: '.env.local' })

async function main() {
  const to = process.argv[2] ?? 'acalderonm@b-drive.com.mx'
  console.log(`Mandando email de test a ${to}...`)

  const result = await notifyByEmail({
    to: [to],
    subject: '[1to1] Test notifyByEmail',
    html: '<p>Hola, este es un test del helper <strong>notifyByEmail</strong>. Si lo recibís, la integración Resend está OK.</p>',
    text: 'Hola, este es un test del helper notifyByEmail. Si lo recibís, la integración Resend está OK.',
  })

  console.log('Resultado:', result)

  if (result.skipped) {
    console.log('(skipped — falta RESEND_API_KEY o EMAIL_FROM en .env.local)')
  }
}

main().catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e)
  console.error('FAIL:', message)
  process.exit(1)
})
