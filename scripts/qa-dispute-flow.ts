/**
 * Flujo completo de disputa end-to-end vía UI real (Playwright):
 *
 *   1. Líder (Carolina) entra a una 1:1 → marca como "Reagendada"
 *   2. Colab (Pedro) entra a la misma 1:1 → marca como "Sin justificación"
 *   3. Server detecta motivos distintos → goToDispute=true →
 *      status='en_disputa' + notifyDispute al canal RH
 *   4. RH (Carolina con role temp = leader pero veremos /arq-humana via admin demo)
 *      abre /arquitectura-humana/disputas → ve el caso
 *
 * Capture: screenshots de cada paso en .qa-screenshots/dispute-flow/
 */
import { chromium, type Page } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const BASE = 'http://localhost:3000'
const OUT = '/home/arielcalderon/Escritorio/1_to_1/.qa-screenshots/dispute-flow'

const LEADER = { email: 'lider.tech@demo.com', password: 'Demo1234!' }
const COLAB = { email: 'dev3@demo.com', password: 'Demo1234!' }
const HR_ADMIN = { email: 'admin@b-drive.com', password: 'admin' }

const CAROLINA_ID = '380fb7e3-4583-47e3-b22f-afed90d578d0'
const PEDRO_ID = 'a181eb52-ed6c-4b27-9182-f9f035718f8d'

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20_000 }),
    page.click('button[type="submit"]'),
  ])
}

async function ensureFreshMeeting(): Promise<string> {
  // Crear o reusar una 1:1 entre Carolina y Pedro sin status finalizado
  const scheduledAt = new Date(Date.now() - 2 * 86400000).toISOString() // hace 2 días
  const { data } = await sb
    .from('one_on_ones')
    .insert({
      leader_id: CAROLINA_ID,
      collaborator_id: PEDRO_ID,
      scheduled_at: scheduledAt,
      duration_minutes: 30,
      modality: 'virtual',
      status: 'agendada',
      created_by: CAROLINA_ID,
    } as never)
    .select('id')
    .single()
  if (!data) throw new Error('No pude crear meeting')
  console.log(`✓ Meeting fresh: ${(data as { id: string }).id}`)
  return (data as { id: string }).id
}

async function markFromUI(page: Page, role: 'lider' | 'colaborador', meetingId: string, reasonValue: string) {
  await page.goto(`${BASE}/${role}/1to1/${meetingId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  // Acepta tanto "Marcar como no realizada" (primer marcado) como
  // "Marcar con otro motivo" (segundo participante → disputa)
  const trigger = page
    .getByRole('button', { name: /marcar como no realizada|marcar con otro motivo/i })
    .first()
  await trigger.click()
  await page.waitForTimeout(500)

  // Seleccionar motivo en el Select
  await page.locator('#non-realization-reason').click()
  await page.waitForTimeout(300)
  await page.getByRole('option', { name: new RegExp(reasonValue, 'i') }).click()
  await page.waitForTimeout(300)

  // Submit
  await page.getByRole('button', { name: /guardar|confirmar/i }).click()
  await page.waitForTimeout(2000)
}

async function main() {
  mkdirSync(OUT, { recursive: true })

  const meetingId = await ensureFreshMeeting()

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
  })

  try {
    // ============ PASO 1: Líder marca como "Reagendada" ============
    console.log('\n[1/3] Carolina (líder) marca como Reagendada')
    const ctxL = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const pageL = await ctxL.newPage()
    pageL.on('pageerror', (e) => console.error('  [pageerror]', e.message))

    await login(pageL, LEADER.email, LEADER.password)
    await markFromUI(pageL, 'lider', meetingId, 'Reagendada')
    await pageL.screenshot({ path: join(OUT, '1-lider-marcada.png'), fullPage: false })
    console.log('  ✓ screenshot 1-lider-marcada.png')
    await ctxL.close()

    // ============ PASO 2: Colab ve "Marcar con otro motivo" → disputa (UI real) ============
    console.log('\n[2/3] Pedro (colab) marca con motivo distinto → genera disputa via UI')
    const ctxC = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const pageC = await ctxC.newPage()
    pageC.on('pageerror', (e) => console.error('  [pageerror]', e.message))
    await login(pageC, COLAB.email, COLAB.password)
    await markFromUI(pageC, 'colaborador', meetingId, 'Sin justificación')
    await pageC.screenshot({ path: join(OUT, '2-colab-marcado-disputa.png'), fullPage: false })
    console.log('  ✓ screenshot 2-colab-marcado-disputa.png')
    await ctxC.close()

    // Pequeña espera para que la action complete + Slack post
    await new Promise((r) => setTimeout(r, 1500))

    // ============ PASO 3: HR ve la disputa en su vista ============
    console.log('\n[3/3] HR (admin) abre /arquitectura-humana/disputas')
    const ctxH = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const pageH = await ctxH.newPage()
    pageH.on('pageerror', (e) => console.error('  [pageerror]', e.message))

    await login(pageH, HR_ADMIN.email, HR_ADMIN.password)
    await pageH.goto(`${BASE}/arquitectura-humana/disputas?id=${meetingId}`, { waitUntil: 'networkidle' })
    await pageH.waitForTimeout(1000)
    await pageH.screenshot({ path: join(OUT, '3-hr-disputas-deep-link.png'), fullPage: true })
    console.log('  ✓ screenshot 3-hr-disputas-deep-link.png')
    await ctxH.close()

    // Verificar en DB que el meeting realmente entró en disputa
    const { data: meeting } = await sb
      .from('one_on_ones')
      .select('id, status, non_realization_reason')
      .eq('id', meetingId)
      .single()
    console.log('\n=== DB CHECK ===')
    console.log('Meeting final state:', meeting)
  } finally {
    await browser.close()
  }

  console.log('\n=== REVERT ===')
  console.log(`DELETE FROM one_on_ones WHERE id = '${meetingId}';`)
}

main().catch((e) => {
  console.error('FAIL:', e)
  process.exit(1)
})
