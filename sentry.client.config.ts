import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions in production for performance monitoring
  tracesSampleRate: 0.1,

  // Only enable Sentry when DSN is configured
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Route error reporting through tunnelRoute to bypass ad-blockers
  tunnel: '/monitoring',
})
