/**
 * Seed: garantiza que existe al menos un scheduled_report con
 * next_run_at en el pasado, para que el cron send-scheduled-reports
 * lo procese inmediatamente y dispare notifyHRReport.
 *
 * Después podés disparar el cron con:
 *   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/send-scheduled-reports
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

async function main() {
  const past = new Date()
  past.setMinutes(past.getMinutes() - 5)

  // Hay alguno existente? — lo seteamos a "vencido"
  const { data: existing } = await sb
    .from('scheduled_reports' as never)
    .select('id, name, enabled, next_run_at')
    .limit(1)

  if (existing && existing.length > 0) {
    const r = (existing as any[])[0]
    console.log(`Tengo scheduled_report existente: ${r.name} (enabled=${r.enabled})`)
    const { error } = await sb
      .from('scheduled_reports' as never)
      .update({ enabled: true, next_run_at: past.toISOString() } as never)
      .eq('id', r.id)
    if (error) {
      console.error('Error actualizando:', error.message)
    } else {
      console.log(`  → enabled=true, next_run_at=${past.toISOString()}`)
    }
  } else {
    console.log('No existe scheduled_report → insertando uno de prueba...')
    const { error } = await sb.from('scheduled_reports' as never).insert({
      name: '[TEST] Cumplimiento semanal',
      report_type: 'cumplimiento_mensual',
      recipients: ['acalderonm@b-drive.com.mx'],
      schedule_cron: '0 9 * * 1',
      enabled: true,
      next_run_at: past.toISOString(),
    } as never)
    if (error) console.error('Error insertando:', error.message)
    else console.log('  → insertado')
  }

  console.log('\nDispará el cron:')
  console.log(`  curl -H "Authorization: Bearer ${process.env.CRON_SECRET}" http://localhost:3000/api/cron/send-scheduled-reports`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
