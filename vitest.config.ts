import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'tests/e2e/**', 'tests-examples/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Limitamos la medición a las 3 server actions que tienen tests
      // unitarios. El resto de `src/lib/actions/**` se cubrirá en olas
      // siguientes; agregar archivos sin tests al `include` envenenaría la
      // cobertura agregada.
      include: [
        'src/lib/actions/agreements.ts',
        'src/lib/actions/one-on-ones.ts',
      ],
      thresholds: {
        'src/lib/actions/agreements.ts': {
          lines: 60,
          functions: 60,
          statements: 60,
          branches: 50,
        },
        'src/lib/actions/one-on-ones.ts': {
          // `one-on-ones.ts` exporta `scheduleOneOnOne` y `cancelOneOnOne`
          // que NO están en scope de esta ola (Pack 2 dedicado). Bajamos la
          // barra para las dos funciones cubiertas (`markNonRealization` y
          // `dismissTransferBanner`).
          lines: 40,
          functions: 40,
          statements: 40,
          branches: 40,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
