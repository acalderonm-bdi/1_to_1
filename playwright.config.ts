import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config para E2E del proyecto 1to1.
 *
 * Notas importantes (Ubuntu 26.04):
 *   - Los binarios de Chromium que distribuye Playwright 1.60 todavía no soportan
 *     Ubuntu 26.04 de forma nativa (ver `scripts/screenshot.ts:8`). Para los tests
 *     locales usamos el Chrome del sistema (`/usr/bin/google-chrome`) vía
 *     `channel: 'chrome'` + `launchOptions.executablePath`. En CI, donde Playwright
 *     puede instalar sus propios browsers con `playwright install --with-deps`,
 *     la misma config funciona porque `channel: 'chrome'` también acepta
 *     Chrome estable preinstalado por la action.
 *
 *   - `webServer.reuseExistingServer: true` evita que Playwright levante un
 *     segundo `next dev` si ya hay uno corriendo en :3000 (típico en dev local).
 *     Si no hay nada en :3000, Playwright lo arranca automáticamente.
 */

const PORT = 3000
const baseURL = `http://localhost:${PORT}`

const useSystemChrome = !process.env.CI

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(useSystemChrome
          ? { launchOptions: { executablePath: '/usr/bin/google-chrome' } }
          : { channel: 'chrome' }),
      },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
