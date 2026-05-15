// Next.js instrumentation hook.
// Delegates to the appropriate Sentry config file depending on runtime.
// Each sentry.*.config.ts is itself a no-op when NEXT_PUBLIC_SENTRY_DSN is not set,
// so this file is safe to keep enabled in environments without Sentry configured.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Re-export Sentry's request error capture hook so Next.js can call it
// for nested React Server Component errors. Falls back to a no-op when
// Sentry is not initialized.
export { captureRequestError as onRequestError } from '@sentry/nextjs'
