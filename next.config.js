/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  experimental: {
    // Required in Next.js 14.2.x for the root-level `instrumentation.ts` hook
    // to be picked up. No-op in newer versions.
    instrumentationHook: true,
  },
}

// Sentry wrap: only applied when SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT are set
// (typically only in CI/production). Local dev builds without Sentry env vars get the
// raw nextConfig untouched, so builds stay green without a Sentry project configured.
const hasSentryBuildEnv =
  !!process.env.SENTRY_AUTH_TOKEN &&
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT

if (hasSentryBuildEnv) {
  // Lazy require so projects without @sentry/nextjs installed (or with the wrap disabled)
  // never pay the cost of loading the plugin.
  const { withSentryConfig } = require('@sentry/nextjs')

  module.exports = withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,

    // Keep build output quiet in CI unless we explicitly opt in to verbose mode.
    silent: !process.env.CI,

    // Source maps upload stays OFF until the real Sentry project is wired up.
    // Flip these on once the project exists and you want symbolicated stack traces.
    sourcemaps: {
      disable: true,
    },

    // No tunnel route, no automatic Vercel cron monitors — intentional, can be revisited.
    automaticVercelMonitors: false,

    // Don't fail the build if Sentry CLI hits a transient error.
    errorHandler: (err) => {
      // eslint-disable-next-line no-console
      console.warn('[sentry] build plugin warning:', err.message)
    },
  })
} else {
  module.exports = nextConfig
}
