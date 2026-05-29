/**
 * CLI del org-sync. Por defecto corre en DRY-RUN (no escribe).
 *
 *   pnpm org-sync "<ruta-csv>"                      # dry-run
 *   pnpm org-sync "<ruta-csv>" --apply --confirm=<ref>   # escribe
 *
 * Salvaguarda: como `.env.local` puede apuntar a PRODUCCIÓN, `--apply` exige
 * `--confirm=<ref>` donde <ref> es el project-ref del Supabase destino (visible
 * en NEXT_PUBLIC_SUPABASE_URL). Si no coincide, aborta e imprime el ref correcto.
 */
import { readFileSync } from 'node:fs'
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { parseOrgCsv, syncOrg } from '../src/lib/sync/org-sync'
import type { Database } from '../src/types/database.types'

loadEnv({ path: '.env.local' })

function projectRef(url: string): string {
  const m = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)
  return m?.[1] ?? '?'
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const confirmArg = args.find((a) => a.startsWith('--confirm='))?.split('=')[1]
  const csvPath = args.find((a) => !a.startsWith('--'))

  if (!csvPath) {
    console.error('Uso: pnpm org-sync "<ruta-csv>" [--apply --confirm=<ref>]')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
  }
  const ref = projectRef(url)

  if (apply && confirmArg !== ref) {
    console.error(
      `\n⛔ Para APLICAR contra el proyecto "${ref}" debes confirmar el destino:\n` +
      `   pnpm org-sync "${csvPath}" --apply --confirm=${ref}\n` +
      `   (revisa que ${ref} sea STAGING y no producción antes de confirmar.)\n`,
    )
    process.exit(1)
  }

  const content = readFileSync(csvPath, 'utf-8')
  const rows = parseOrgCsv(content)

  console.log(`\n=== Org-sync ${apply ? '(APLICAR ✍)' : '(DRY-RUN 🔍)'} ===`)
  console.log(`CSV:      ${csvPath} — ${rows.length} filas`)
  console.log(`Supabase: ${ref} (${url})\n`)

  const report = await syncOrg(admin(url, key), rows, { dryRun: !apply })
  console.log(JSON.stringify(report, null, 2))

  if (report.errors.length > 0) {
    console.error(`\n${report.errors.length} error(es). Revisa arriba.`)
    process.exit(1)
  }
  console.log(`\n${apply ? '✓ Aplicado.' : 'Dry-run: no se escribió nada. Usa --apply --confirm=<ref> para escribir.'}\n`)
}

function admin(url: string, key: string) {
  return createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
