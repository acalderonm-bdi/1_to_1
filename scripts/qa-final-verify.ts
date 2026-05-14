/**
 * Verificación final QA — captura screenshots de los 2 fixes restantes:
 *   - C.4: banner antes/después de dismiss + refresh
 *   - EXTRA-2: stats con exactamente 1 pendiente (singular)
 *
 * Asume que ya corriste `qa-seed-test-data.ts` y dejó:
 *   - Banner activo para Pedro (transferredCount > 0, dismissed_at=null)
 *   - 1 pendiente en una meeting transferida (no cuenta para EXTRA-2)
 *
 * Este script:
 *   1. Toma screenshot pre-dismiss
 *   2. Hace click en cerrar (×) del banner
 *   3. Refresca la página
 *   4. Toma screenshot post-refresh → si banner desapareció = C.4 OK
 *
 * Para EXTRA-2 hace un INSERT extra: agrega un pendiente en una meeting
 * que SIGA siendo de Carolina, luego refresca y captura.
 */
import { chromium, type Page } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { join } from 'node:path'

config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const BASE = 'http://localhost:3000'
const OUT = '/home/arielcalderon/Escritorio/1_to_1/.qa-screenshots'

const CAROLINA = '380fb7e3-4583-47e3-b22f-afed90d578d0'
const PEDRO = 'a181eb52-ed6c-4b27-9182-f9f035718f8d'
const TRANSFERRED_MEETING = '013cafdb-935c-45e9-8182-e7b5043c1c4d'

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', 'lider.tech@demo.com')
  await page.fill('input[type="password"]', 'Demo1234!')
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ])
}

async function main() {
  // --- 1. Agregar UN pendiente en otra meeting de Carolina (para EXTRA-2)
  console.log('[seed] Buscando otra meeting de Carolina↔Pedro (no transferida)...')
  const { data: meetings } = await sb
    .from('one_on_ones')
    .select('id, leader_id, scheduled_at')
    .eq('leader_id', CAROLINA)
    .eq('collaborator_id', PEDRO)
    .neq('id', TRANSFERRED_MEETING)
    .order('scheduled_at', { ascending: false })
    .limit(1)
  const targetMeeting = meetings?.[0]?.id
  if (!targetMeeting) {
    console.error('[seed] No hay otra meeting de Carolina')
    process.exit(1)
  }
  console.log(`[seed] Meeting target: ${targetMeeting}`)

  // Verificar si ya tiene un acuerdo pendiente (de seed previo)
  const { data: existing } = await sb
    .from('agreements')
    .select('id, status')
    .eq('responsible_id', PEDRO)
    .eq('one_on_one_id', targetMeeting)
    .eq('status', 'pendiente')

  let createdAgreementId: string | null = null
  if (!existing || existing.length === 0) {
    const { data: ins, error } = await sb
      .from('agreements')
      .insert({
        one_on_one_id: targetMeeting,
        responsible_id: PEDRO,
        description: '[QA-SEED-EXTRA2] Único pendiente para test singular',
        status: 'pendiente',
      })
      .select('id')
      .single()
    if (error) {
      console.error(`[seed] ERROR creando agreement: ${error.message}`)
      process.exit(1)
    }
    createdAgreementId = ins!.id
    console.log(`[seed] Creé agreement ${createdAgreementId} en ${targetMeeting}`)
  } else {
    console.log(`[seed] Ya hay ${existing.length} pendiente(s), no creo otro`)
  }

  // --- 2. Browser
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
  })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error(`  [pageerror] ${e.message}`))

  try {
    await login(page)
    await page.goto(`${BASE}/lider/colaborador/${PEDRO}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)

    // === C.4 PRE ===
    const beforePath = join(OUT, 'C4-banner-before.png')
    await page.screenshot({ path: beforePath, fullPage: false })
    console.log(`  ✓ ${beforePath}`)

    // === Dismiss banner ===
    // El TransferBanner debería tener un botón ×. Buscar por aria-label o estructura.
    // El TransferBanner tiene aria-label="Cerrar este aviso"
    const dismissBtn = page.getByRole('button', { name: 'Cerrar este aviso' })
    const hasBtn = (await dismissBtn.count()) > 0
    if (!hasBtn) {
      console.error('  ✗ No encontré botón dismiss en el banner')
    } else {
      await dismissBtn.click()
      console.log('  → click dismiss')
      await page.waitForTimeout(1500)
      const midPath = join(OUT, 'C4-banner-after-click.png')
      await page.screenshot({ path: midPath, fullPage: false })
      console.log(`  ✓ ${midPath}`)

      // === C.4 POST REFRESH ===
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(800)
      const afterPath = join(OUT, 'C4-banner-after-refresh.png')
      await page.screenshot({ path: afterPath, fullPage: false })
      console.log(`  ✓ ${afterPath}`)

      // Validar en DB que dismissed_at quedó seteado
      const { data: rel } = await sb
        .from('leadership_relations')
        .select('transfer_banner_dismissed_at')
        .eq('leader_id', CAROLINA)
        .eq('collaborator_id', PEDRO)
        .is('ended_at', null)
        .single()
      console.log(`  DB check: dismissed_at = ${(rel as any)?.transfer_banner_dismissed_at}`)
    }

    // === EXTRA-2 ===
    // Re-cargar para que se vea el nuevo pendiente (después del dismiss el banner desapareció)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    const extra2Path = join(OUT, 'EXTRA2-singular-1-pendiente.png')
    await page.screenshot({ path: extra2Path, fullPage: true })
    console.log(`  ✓ ${extra2Path}`)
  } finally {
    await browser.close()
  }

  console.log('\n=== Done ===')
  console.log('Para revertir el seed:')
  console.log(`  UPDATE one_on_ones SET leader_id='${CAROLINA}' WHERE id='${TRANSFERRED_MEETING}';`)
  if (createdAgreementId) {
    console.log(`  DELETE FROM agreements WHERE id='${createdAgreementId}';`)
  }
  console.log(`  DELETE FROM agreements WHERE description LIKE '[QA-SEED%';`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
