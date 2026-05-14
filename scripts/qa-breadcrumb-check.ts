/**
 * Verifica que el breadcrumb del header coincida con el ítem activo del sidebar
 * en varias rutas. Captura screenshots como evidencia.
 */
import { chromium, type Page } from 'playwright'
import { join } from 'node:path'

const BASE = 'http://localhost:3000'
const OUT = '/home/arielcalderon/Escritorio/1_to_1/.qa-screenshots'

const ADMIN = { email: 'admin@b-drive.com', password: 'admin' }

const ROUTES = [
  { name: 'rh-usuarios', path: '/arquitectura-humana/usuarios', expected: 'Usuarios' },
  { name: 'rh-mapa-calor', path: '/arquitectura-humana/mapa-calor', expected: 'Mapa de calor' },
  { name: 'rh-disputas', path: '/arquitectura-humana/disputas', expected: 'Disputas' },
  { name: 'rh-cadencias', path: '/arquitectura-humana/cadencias', expected: 'Cadencias' },
  { name: 'rh-params', path: '/arquitectura-humana/parametros', expected: 'Parámetros' },
  { name: 'rh-dash', path: '/arquitectura-humana', expected: 'Panel general' },
]

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ])
}

async function main() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
  })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error(`  [pageerror] ${e.message}`))

  try {
    await login(page, ADMIN.email, ADMIN.password)

    // Primera carga: server render
    await page.goto(`${BASE}${ROUTES[0].path}`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(500)

    // Resto: navegar via click en el sidebar (client-side navigation)
    for (const r of ROUTES) {
      const link = page.locator(`.sidebar__link[href="${r.path}"]`).first()
      await link.click()
      // Esperar URL change + react re-render
      await page.waitForURL(`${BASE}${r.path}`, { timeout: 10000 })
      await page.waitForTimeout(400)

      const breadcrumb = await page
        .locator('.app-header__breadcrumb-current')
        .first()
        .innerText()
        .catch(() => '<none>')
      const sidebarActive = await page
        .locator('.sidebar__link[data-active="true"]')
        .first()
        .innerText()
        .catch(() => '<none>')
      const ok = breadcrumb.trim() === r.expected && sidebarActive.trim() === r.expected
      console.log(
        `${ok ? '✓' : '✗'} ${r.path}: breadcrumb="${breadcrumb}" sidebar="${sidebarActive.trim()}" expected="${r.expected}"`,
      )
      const outPath = join(OUT, `breadcrumb-${r.name}.png`)
      await page.screenshot({ path: outPath, fullPage: false })
    }
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
