import { test, expect } from '@playwright/test'

/**
 * Golden path: líder revisa su equipo y abre el perfil de un colaborador.
 *
 * Flujo:
 *   1. Login con lider.tech@demo.com / Demo1234!
 *   2. Navega a /lider/equipo y verifica que hay al menos 1 colaborador
 *   3. Click en el primer colaborador → /lider/colaborador/[id]
 *   4. Verifica que la página renderiza: header con nombre, KPIs, sección de acuerdos
 *   5. Verifica que la URL coincide con el patrón esperado
 *
 * Selectores: usamos roles + nombres + data-testid donde aplica para evitar
 * frágiles selectores de texto. El nombre del colaborador (texto) sí se mira
 * para encadenar pasos pero no se hardcodea ningún nombre concreto.
 */

const LEADER_EMAIL = 'lider.tech@demo.com'
const LEADER_PASSWORD = 'Demo1234!'

test.describe('golden path: líder → equipo → colaborador', () => {
  test('login y navegación al perfil de un colaborador', async ({ page }) => {
    // 1. Login.
    await page.goto('/login')
    await page.getByLabel('Correo electrónico').fill(LEADER_EMAIL)
    await page.getByLabel('Contraseña').fill(LEADER_PASSWORD)

    await Promise.all([
      page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15_000 }),
      page.getByRole('button', { name: /iniciar sesión/i }).click(),
    ])

    // El home del líder es /lider.
    await expect(page).toHaveURL(/\/lider(\/|$)/)

    // 2. Ir a /lider/equipo.
    await page.goto('/lider/equipo')
    await expect(page).toHaveURL(/\/lider\/equipo$/)
    await expect(page.getByRole('heading', { name: /mi equipo/i })).toBeVisible()

    // Debe haber al menos 1 link a colaborador.
    const collabLinks = page.locator('a[href^="/lider/colaborador/"]')
    await expect(collabLinks.first()).toBeVisible()
    const count = await collabLinks.count()
    expect(count).toBeGreaterThan(0)

    // 3. Click en el primer colaborador.
    const firstLink = collabLinks.first()
    const href = await firstLink.getAttribute('href')
    expect(href).toMatch(/^\/lider\/colaborador\/[0-9a-f-]{36}$/)

    await Promise.all([
      page.waitForURL(/\/lider\/colaborador\/[0-9a-f-]{36}$/, { timeout: 15_000 }),
      firstLink.click(),
    ])

    // 4. Verificar que la página renderiza.
    //    Header → h1 con el nombre del colaborador.
    await expect(page.locator('h1').first()).toBeVisible()

    //    KPIs → al menos uno de los labels esperados.
    await expect(page.getByText(/cumplimiento de cadencia/i)).toBeVisible()
    await expect(page.getByText(/total 1:1s/i).first()).toBeVisible()
    await expect(page.getByText(/acuerdos pendientes/i).first()).toBeVisible()

    //    Sección de acuerdos.
    await expect(page.getByRole('heading', { name: /compromisos/i })).toBeVisible()

    // 5. URL final coincide con el patrón esperado.
    await expect(page).toHaveURL(/\/lider\/colaborador\/[0-9a-f-]{36}$/)
  })
})
