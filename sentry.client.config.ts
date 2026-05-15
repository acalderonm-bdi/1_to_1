// Sentry client-side instrumentation.
// Only initializes when NEXT_PUBLIC_SENTRY_DSN is set; otherwise this file is a no-op
// so the app keeps working in dev/local without a Sentry project configured.

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Moderate sample rate: 100% in dev for visibility, 10% in prod to control volume.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session Replay disabled by default; can be enabled later via env if needed.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Keep noise low: don't send default PII.
    sendDefaultPii: false,
  })
}
