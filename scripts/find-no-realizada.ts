/**
 * Helper para encontrar una 1:1 con status='no_realizada' del líder demolider,
 * para validar que /lider/1to1/[id] ya no crashea (REGRESIÓN-1).
 */
import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  try {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', 'lider.tech@demo.com')
    await page.fill('input[type="password"]', 'Demo1234!')
    await Promise.all([
      page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 }),
      page.click('button[type="submit"]'),
    ])

    // Equipo → click un colab → buscar historial con "No realizada"
    await page.goto('http://localhost:3000/lider/equipo', { waitUntil: 'networkidle' })
    const collabHrefs = await page.$$eval(
      'a[href*="/lider/colaborador/"]',
      (els) => els.map((e) => e.getAttribute('href') ?? '').filter(Boolean),
    )
    if (!collabHrefs[0]) {
      console.log('NO_COLLABS')
      return
    }

    await page.goto(`http://localhost:3000${collabHrefs[0]}`, { waitUntil: 'networkidle' })

    // En el historial del colab, buscar 1:1s con badge "No realizada"
    const noRealizadaHrefs = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[class*="list-row"], a[href*="/1to1/"]'))
      const results: string[] = []
      for (const row of rows) {
        const text = row.textContent ?? ''
        if (text.toLowerCase().includes('no realizada')) {
          const link = row.tagName === 'A'
            ? (row as HTMLAnchorElement).getAttribute('href')
            : row.querySelector('a[href*="/1to1/"]')?.getAttribute('href')
          if (link) results.push(link)
        }
      }
      return results
    })

    console.log(JSON.stringify(noRealizadaHrefs.slice(0, 3)))
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
