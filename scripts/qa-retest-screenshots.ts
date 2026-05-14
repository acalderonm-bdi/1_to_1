/**
 * QA retest — captura screenshots de los 4 fixes recientes.
 *
 *   A.1  Login wordmark (light + dark)
 *   C.4  Banner transfer persiste tras dismiss + refresh
 *   EXTRA-2  Pluralización "N pendientes" en stats colab
 *   REGRESIÓN-1  /lider/1to1/[id] con no_realizada no crashea
 *
 * Salida: .qa-screenshots/*.png
 */
import { chromium, type Browser, type Page } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = 'http://localhost:3000'
const OUT_DIR = '/home/arielcalderon/Escritorio/1_to_1/.qa-screenshots'
const LIDER = { email: 'lider.tech@demo.com', password: 'Demo1234!' }

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ])
}

async function shotA1Login(browser: Browser) {
  // Light + dark del login (público).
  for (const theme of ['light', 'dark'] as const) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: theme,
    })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    if (theme === 'dark') {
      // Forzar dark si la app guarda preferencia en localStorage
      await page.evaluate(() => {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      })
      await page.waitForTimeout(300)
    }
    const out = join(OUT_DIR, `A1-login-${theme}.png`)
    await page.screenshot({ path: out, fullPage: false })
    console.log(`  ✓ ${out}`)
    await ctx.close()
  }
}

async function shotExtra2AndRegression1(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error(`  [pageerror] ${e.message}`))

  await login(page, LIDER.email, LIDER.password)

  // Vista equipo → primera colab card
  await page.goto(`${BASE}/lider/equipo`, { waitUntil: 'networkidle' })
  const collabHref = await page.$$eval(
    'a[href*="/lider/colaborador/"]',
    (els) => els[0]?.getAttribute('href') ?? '',
  )
  if (!collabHref) {
    console.error('  ✗ No collab links in /lider/equipo')
    await ctx.close()
    return
  }

  // EXTRA-2: pluralización en stats del colab
  await page.goto(`${BASE}${collabHref}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const extra2 = join(OUT_DIR, 'EXTRA2-stats-pluralizacion.png')
  await page.screenshot({ path: extra2, fullPage: true })
  console.log(`  ✓ ${extra2}`)

  // C.4: si hay banner transfer, lo cerramos y refrescamos
  const dismissBtn = page.locator('[aria-label*="ismiss" i], button:has-text("Entendido"), button:has-text("Cerrar")').first()
  const hasBanner = (await dismissBtn.count()) > 0
  if (hasBanner) {
    const before = join(OUT_DIR, 'C4-banner-before.png')
    await page.screenshot({ path: before, fullPage: false })
    console.log(`  ✓ ${before}`)
    await dismissBtn.click().catch(() => {})
    await page.waitForTimeout(800)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const after = join(OUT_DIR, 'C4-banner-after-refresh.png')
    await page.screenshot({ path: after, fullPage: false })
    console.log(`  ✓ ${after}`)
  } else {
    console.log('  ⓘ C.4: no transfer banner visible para este líder (sin transfer pendiente)')
  }

  // REGRESIÓN-1: buscar una 1:1 no_realizada en el historial
  const noRealizadaHrefs = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/1to1/"]')) as HTMLAnchorElement[]
    const out: string[] = []
    for (const a of links) {
      const container = a.closest('article, li, div, tr') ?? a
      const text = (container.textContent ?? '').toLowerCase()
      if (text.includes('no realizada') || text.includes('no-realizada')) {
        const href = a.getAttribute('href')
        if (href && !out.includes(href)) out.push(href)
      }
    }
    return out
  })

  if (noRealizadaHrefs[0]) {
    await page.goto(`${BASE}${noRealizadaHrefs[0]}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    const reg = join(OUT_DIR, 'REGRESION1-1to1-no-realizada.png')
    await page.screenshot({ path: reg, fullPage: true })
    console.log(`  ✓ ${reg} (href=${noRealizadaHrefs[0]})`)
  } else {
    console.log('  ⓘ REGRESIÓN-1: no encontré 1:1 no_realizada en historial visible — el fix está en código pero no hay data para visual')
  }

  await ctx.close()
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  console.log('[qa-retest] Launching Chrome')
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
  })
  try {
    console.log('[A.1] Login wordmark (light + dark)')
    await shotA1Login(browser)
    console.log('[EXTRA-2 + C.4 + REGRESIÓN-1] Líder flow')
    await shotExtra2AndRegression1(browser)
  } finally {
    await browser.close()
  }
  console.log(`\n[qa-retest] Done → ${OUT_DIR}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
