/**
 * find-meeting — devuelve UUIDs de 1:1s visibles para un test user.
 * Útil para encadenar con screenshot.ts.
 *
 * Uso:
 *   pnpm tsx scripts/find-meeting.ts --user=demolider
 *   pnpm tsx scripts/find-meeting.ts --user=ariel --route=/colaborador
 *
 * Output: lista de objetos { id, label } en stdout (JSON).
 */

import { chromium } from 'playwright'

const USERS: Record<string, { email: string; password: string }> = {
  admin: { email: 'admin@b-drive.com', password: 'admin' },
  ariel: { email: 'ariel@demo.com', password: 'demo' },
  demolider: { email: 'lider.tech@demo.com', password: 'Demo1234!' },
  demoColab: { email: 'dev1@demo.com', password: 'Demo1234!' },
}

async function main() {
  const argv = process.argv.slice(2)
  const userKey = argv.find((a) => a.startsWith('--user='))?.split('=')[1] ?? 'demolider'
  const route = argv.find((a) => a.startsWith('--route='))?.split('=')[1] ?? '/lider'
  const user = USERS[userKey]
  if (!user) {
    console.error(`Unknown user preset: ${userKey}`)
    process.exit(1)
  }

  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  try {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', user.email)
    await page.fill('input[type="password"]', user.password)
    await Promise.all([
      page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 }),
      page.click('button[type="submit"]'),
    ])

    await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle' })

    const hrefs = await page.$$eval(
      'a[href*="/1to1/"]',
      (els: Element[]): Array<{ href: string; text: string }> =>
        els.map((e) => ({
          href: e.getAttribute('href') ?? '',
          text: (e.textContent ?? '').trim().slice(0, 100),
        })),
    )

    const unique = new Map<string, string>()
    for (const h of hrefs) {
      const match = h.href.match(/\/1to1\/([0-9a-f-]{36})/)
      if (match && !unique.has(match[1])) {
        unique.set(match[1], h.text || '(sin label)')
      }
    }

    const result = Array.from(unique.entries()).map(([id, label]) => ({ id, label }))
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
