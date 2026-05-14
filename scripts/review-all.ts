/**
 * review-all — captura screenshots de todas las rutas críticas con el
 * usuario apropiado, para auditoría visual end-to-end.
 *
 * Output: /tmp/screenshots/review/<role>__<route>.png
 */

import { chromium, type Page, type Browser } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3000'
const OUT_DIR = '/tmp/screenshots/review'

const USERS = {
  admin: { email: 'admin@b-drive.com', password: 'admin' },
  demolider: { email: 'lider.tech@demo.com', password: 'Demo1234!' },
  demoColab: { email: 'dev1@demo.com', password: 'Demo1234!' },
}

// Rutas estáticas — no requieren ID
const STATIC_ROUTES: Array<{ role: keyof typeof USERS; route: string; label: string }> = [
  { role: 'admin', route: '/arquitectura-humana', label: 'ah-dashboard' },
  { role: 'admin', route: '/arquitectura-humana/mapa-calor', label: 'ah-mapa-calor' },
  { role: 'admin', route: '/arquitectura-humana/disputas', label: 'ah-disputas' },
  { role: 'admin', route: '/arquitectura-humana/cadencias', label: 'ah-cadencias' },
  { role: 'admin', route: '/arquitectura-humana/usuarios', label: 'ah-usuarios' },
  { role: 'admin', route: '/arquitectura-humana/estructura', label: 'ah-estructura' },
  { role: 'admin', route: '/arquitectura-humana/configuracion', label: 'ah-configuracion' },
  { role: 'admin', route: '/arquitectura-humana/reportes', label: 'ah-reportes' },

  { role: 'demolider', route: '/lider', label: 'lider-dashboard' },
  { role: 'demolider', route: '/lider/equipo', label: 'lider-equipo' },
  { role: 'demolider', route: '/lider/configuracion', label: 'lider-configuracion' },

  { role: 'demoColab', route: '/colaborador', label: 'colab-dashboard' },
  { role: 'demoColab', route: '/colaborador/historial', label: 'colab-historial' },
  { role: 'demoColab', route: '/colaborador/acuerdos', label: 'colab-acuerdos' },
  { role: 'demoColab', route: '/colaborador/configuracion', label: 'colab-configuracion' },
  { role: 'demoColab', route: '/colaborador/1to1/nueva', label: 'colab-1to1-nueva' },
]

async function login(page: Page, role: keyof typeof USERS) {
  const user = USERS[role]
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', user.email)
  await page.fill('input[type="password"]', user.password)
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ])
}

async function findFirstMeeting(page: Page, role: keyof typeof USERS): Promise<string | null> {
  const baseRoute = role === 'demolider' ? '/lider' : '/colaborador'
  await page.goto(`${BASE}${baseRoute}`, { waitUntil: 'networkidle' })
  const hrefs = await page.$$eval(
    'a[href*="/1to1/"]',
    (els: Element[]) =>
      els
        .map((e) => e.getAttribute('href') ?? '')
        .filter((h) => /\/1to1\/[0-9a-f-]{36}/.test(h)),
  )
  const match = hrefs[0]?.match(/\/1to1\/([0-9a-f-]{36})/)
  return match?.[1] ?? null
}

async function findFirstCollabUnderLeader(page: Page): Promise<string | null> {
  await page.goto(`${BASE}/lider/equipo`, { waitUntil: 'networkidle' })
  const hrefs = await page.$$eval(
    'a[href*="/lider/colaborador/"]',
    (els: Element[]) =>
      els
        .map((e) => e.getAttribute('href') ?? '')
        .filter((h) => /\/lider\/colaborador\/[0-9a-f-]{36}/.test(h)),
  )
  const match = hrefs[0]?.match(/\/lider\/colaborador\/([0-9a-f-]{36})/)
  return match?.[1] ?? null
}

async function findFirstUserForAH(page: Page): Promise<string | null> {
  await page.goto(`${BASE}/arquitectura-humana/usuarios`, { waitUntil: 'networkidle' })
  const hrefs = await page.$$eval(
    'a[href*="/arquitectura-humana/usuarios/"]',
    (els: Element[]) =>
      els
        .map((e) => e.getAttribute('href') ?? '')
        .filter((h) => /\/arquitectura-humana\/usuarios\/[0-9a-f-]{36}/.test(h)),
  )
  const match = hrefs[0]?.match(/\/arquitectura-humana\/usuarios\/([0-9a-f-]{36})/)
  return match?.[1] ?? null
}

async function shot(page: Page, route: string, label: string, role: string) {
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(400)
    const path = `${OUT_DIR}/${role}__${label}.png`
    await page.screenshot({ path, fullPage: true })
    console.log(`✓ ${role} → ${route}`)
    return { ok: true, label, route, role }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`✗ ${role} → ${route}: ${msg.slice(0, 80)}`)
    try {
      await page.screenshot({ path: `${OUT_DIR}/${role}__${label}__ERROR.png`, fullPage: false })
    } catch {}
    return { ok: false, label, route, role, error: msg }
  }
}

async function runForRole(browser: Browser, role: keyof typeof USERS, routes: typeof STATIC_ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await login(page, role)

  const results: Array<Awaited<ReturnType<typeof shot>>> = []
  for (const r of routes.filter((x) => x.role === role)) {
    results.push(await shot(page, r.route, r.label, role))
  }

  // Rutas dinámicas adicionales
  if (role === 'demolider') {
    const meetingId = await findFirstMeeting(page, role)
    if (meetingId) {
      results.push(await shot(page, `/lider/1to1/${meetingId}`, 'lider-1to1-detail', role))
    }
    const collabId = await findFirstCollabUnderLeader(page)
    if (collabId) {
      results.push(await shot(page, `/lider/colaborador/${collabId}`, 'lider-colab-detail', role))
    }
  }

  if (role === 'demoColab') {
    const meetingId = await findFirstMeeting(page, role)
    if (meetingId) {
      results.push(await shot(page, `/colaborador/1to1/${meetingId}`, 'colab-1to1-detail', role))
    }
  }

  if (role === 'admin') {
    const userId = await findFirstUserForAH(page)
    if (userId) {
      results.push(await shot(page, `/arquitectura-humana/usuarios/${userId}`, 'ah-usuario-detail', role))
    }
  }

  await ctx.close()
  return results
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  console.log(`[review] Output: ${OUT_DIR}`)

  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true })
  const all: Array<Awaited<ReturnType<typeof shot>>> = []

  for (const role of ['admin', 'demolider', 'demoColab'] as const) {
    console.log(`\n[${role}] starting…`)
    const res = await runForRole(browser, role, STATIC_ROUTES)
    all.push(...res)
  }

  await browser.close()

  const ok = all.filter((r) => r.ok).length
  const fail = all.filter((r) => !r.ok).length
  console.log(`\n[review] done: ${ok} ok, ${fail} fail`)
  if (fail > 0) {
    console.log('\nFailures:')
    for (const r of all.filter((x) => !x.ok)) {
      console.log(`  ${r.role} ${r.route}: ${r.error?.slice(0, 100)}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
