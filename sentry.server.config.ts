// Sentry server-side (Node runtime) instrumentation.
// Only initializes when NEXT_PUBLIC_SENTRY_DSN is set; otherwise this file is a no-op.

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Moderate sample rate: 100% in dev for visibility, 10% in prod to control volume.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Keep noise low: don't send default PII (we manage what gets logged ourselves).
    sendDefaultPii: false,
  })
}
