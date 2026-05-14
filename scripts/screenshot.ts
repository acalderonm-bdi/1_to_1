/**
 * Screenshot util — usa Playwright headless con el Chrome del sistema
 * para capturar páginas del dev server local (autenticadas o no).
 *
 * Por qué Chrome del sistema y no chromium-de-playwright: Ubuntu 26.04 todavía
 * no está soportado por los binarios de Playwright 1.60, pero el protocolo
 * CDP funciona idéntico con el Chrome del sistema (`/usr/bin/google-chrome`).
 *
 * Uso:
 *   pnpm screenshot <ruta> [opciones]
 *
 * Ejemplos:
 *   pnpm screenshot /lider                                # admin demo, 1440x900
 *   pnpm screenshot /lider/1to1/abc123 --viewport=1440x900
 *   pnpm screenshot /colaborador --user=ariel --out=colab.png
 *   pnpm screenshot /lider --viewport=375x812 --out=mobile.png
 *
 * Opciones:
 *   --viewport=WxH   Resolución (default 1440x900)
 *   --user=preset    Test user preset: admin | acalderon | ariel | demo:<email>:<pass>
 *                    (default admin)
 *   --out=name.png   Nombre del archivo (default screenshot-<timestamp>.png).
 *                    Se guarda en /tmp/screenshots/.
 *   --full           Screenshot de toda la página (no solo viewport)
 *   --no-login       Saltar login (para /login u otras públicas)
 *
 * Setup previo:
 *   - pnpm dev corriendo en localhost:3000
 *   - Google Chrome instalado en /usr/bin/google-chrome
 */

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

interface Args {
  route: string
  viewport: { width: number; height: number }
  user: { email: string; password: string } | null
  out: string
  full: boolean
}

const USERS: Record<string, { email: string; password: string }> = {
  admin: { email: 'admin@b-drive.com', password: 'admin' },
  ariel: { email: 'ariel@demo.com', password: 'demo' },
  // acalderonm uses Google SSO (sin password) — no podemos auto-loguearlo
  demolider: { email: 'lider.tech@demo.com', password: 'Demo1234!' },
  demoColab: { email: 'dev1@demo.com', password: 'Demo1234!' },
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const route = argv.find((a) => !a.startsWith('--')) ?? '/'

  const viewportArg = argv.find((a) => a.startsWith('--viewport='))?.split('=')[1] ?? '1440x900'
  const [w, h] = viewportArg.split('x').map(Number)
  const viewport = { width: w || 1440, height: h || 900 }

  const userArg = argv.find((a) => a.startsWith('--user='))?.split('=')[1] ?? 'admin'
  let user: Args['user'] = null
  if (argv.includes('--no-login')) {
    user = null
  } else if (userArg.startsWith('demo:')) {
    const [, email, password] = userArg.split(':')
    user = { email, password }
  } else if (USERS[userArg]) {
    user = USERS[userArg]
  } else {
    console.warn(`[screenshot] User preset "${userArg}" not found, defaulting to admin`)
    user = USERS.admin
  }

  const outArg = argv.find((a) => a.startsWith('--out='))?.split('=')[1]
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const out = outArg ?? `screenshot-${stamp}.png`
  const full = argv.includes('--full')

  return { route, viewport, user, out, full }
}

async function main() {
  const args = parseArgs()
  const outDir = '/tmp/screenshots'
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, args.out.endsWith('.png') ? args.out : `${args.out}.png`)

  console.log(`[screenshot] Launching Chrome (system binary)`)
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
  })

  const context = await browser.newContext({ viewport: args.viewport })
  const page = await context.newPage()

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error(`  [browser error] ${msg.text()}`)
  })

  const baseUrl = 'http://localhost:3000'

  try {
    if (args.user) {
      console.log(`[screenshot] Logging in as ${args.user.email}`)
      await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })

      // El form de login tiene tabs (Email / Google). Email es default.
      await page.fill('input[type="email"]', args.user.email)
      await page.fill('input[type="password"]', args.user.password)
      await Promise.all([
        page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15000 }),
        page.click('button[type="submit"]'),
      ])
    }

    console.log(`[screenshot] Navigating to ${args.route}`)
    await page.goto(`${baseUrl}${args.route}`, { waitUntil: 'networkidle', timeout: 30000 })

    // Pequeña espera para animaciones / hydration tardía
    await page.waitForTimeout(500)

    console.log(`[screenshot] Capturing → ${outPath}`)
    await page.screenshot({ path: outPath, fullPage: args.full })
    console.log(`[screenshot] ✓ Saved ${outPath}`)
  } catch (err) {
    console.error('[screenshot] Failed:', err instanceof Error ? err.message : err)
    try {
      const errPath = outPath.replace('.png', '-error.png')
      await page.screenshot({ path: errPath, fullPage: true })
      console.error(`[screenshot] State at failure saved to ${errPath}`)
    } catch {
      // ignore
    }
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main()
