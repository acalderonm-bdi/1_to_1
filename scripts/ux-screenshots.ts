import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import path from 'path'

const BASE = process.env['BASE_URL'] ?? 'http://localhost:3000'
const EMAIL = process.env['UX_EMAIL'] ?? 'acalderonm@b-drive.com.mx'
const PASSWORD = process.env['UX_PASSWORD'] ?? 'elmata01'
const OUT = process.env['OUT_DIR'] ?? '/tmp/ux-shots'

const ROUTES: { path: string; name: string }[] = [
  { path: '/login', name: '01-login' },
  { path: '/arquitectura-humana', name: '10-hr-home' },
  { path: '/arquitectura-humana/estructura', name: '11-hr-estructura' },
  { path: '/arquitectura-humana/mapa-calor', name: '12-hr-mapa-calor' },
  { path: '/arquitectura-humana/cadencias', name: '13-hr-cadencias' },
  { path: '/arquitectura-humana/usuarios', name: '14-hr-usuarios' },
  { path: '/arquitectura-humana/reportes', name: '15-hr-reportes' },
  { path: '/arquitectura-humana/disputas', name: '16-hr-disputas' },
  { path: '/arquitectura-humana/configuracion', name: '17-hr-config' },
  { path: '/lider', name: '20-lider-home' },
  { path: '/lider/equipo', name: '21-lider-equipo' },
  { path: '/lider/insights', name: '22-lider-insights' },
  { path: '/lider/configuracion', name: '23-lider-config' },
  { path: '/colaborador', name: '30-colab-home' },
  { path: '/colaborador/acuerdos', name: '31-colab-acuerdos' },
  { path: '/colaborador/1to1/nueva', name: '32-colab-1to1-nueva' },
  { path: '/colaborador/configuracion', name: '33-colab-config' },
]

async function main() {
  await mkdir(OUT, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await ctx.newPage()

  // Login
  console.log('→ Login…')
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(OUT, '00-login-pre.png'), fullPage: true })
  await page.fill('#email', EMAIL)
  await page.fill('#password', PASSWORD)
  await Promise.all([
    page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ])
  await page.waitForLoadState('networkidle').catch(() => null)
  console.log(`  logueado, en: ${page.url()}`)

  for (const r of ROUTES) {
    const url = `${BASE}${r.path}`
    process.stdout.write(`→ ${r.name.padEnd(28)} `)
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 })
      // Espera a que termine cualquier animación de fade-in
      await page.waitForTimeout(600)
      const file = path.join(OUT, `${r.name}.png`)
      await page.screenshot({ path: file, fullPage: true })
      console.log('OK')
    } catch (e: unknown) {
      console.log(`FAIL: ${(e as Error).message.split('\n')[0]}`)
    }
  }

  await browser.close()
  console.log(`\nCapturas en ${OUT}`)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
