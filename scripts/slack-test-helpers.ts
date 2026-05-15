/**
 * Demo standalone de los 2 helpers Slack restantes (que no son disparados por
 * ningún cron actual): notifyDispute y notifyHRReport.
 *
 * Manda al SLACK_DEFAULT_CHANNEL con datos representativos. NO toca DB.
 */
import { config } from 'dotenv'
import { notifyDispute, notifyHRReport } from '../src/lib/slack/notify'

config({ path: '.env.local' })

async function main() {
  const channel = process.env.SLACK_DEFAULT_CHANNEL
  if (!channel) {
    console.error('Falta SLACK_DEFAULT_CHANNEL')
    process.exit(1)
  }

  console.log('1/2 → notifyDispute (canal RH)...')
  const d = await notifyDispute(
    channel,
    'Carolina Méndez',
    'Pedro Ramírez',
    '14 de mayo de 2026',
    '535418ad-350c-4167-9d44-c9750185aa6a',
  )
  console.log('   →', d)

  await new Promise((r) => setTimeout(r, 1000))

  console.log('2/2 → notifyHRReport (canal RH)...')
  const r = await notifyHRReport(
    channel,
    'Reporte semanal de cumplimiento',
    [
      'Semana del 8–14 may 2026:',
      '• 12 1:1s agendadas · 9 realizadas (75%)',
      '• 3 1:1s no realizadas: 2 reagendadas, 1 ausencia',
      '• 5 acuerdos cumplidos · 2 vencidos',
      '• Calidez promedio: 4.2/5',
      '',
      'Áreas con cumplimiento bajo (<50%): Diseño.',
      'Ver detalle en https://1to1.b-drive.com.mx/arquitectura-humana',
    ].join('\n'),
  )
  console.log('   →', r)
}

main().catch((e) => {
  console.error('FAIL:', e.message ?? e)
  process.exit(1)
})
