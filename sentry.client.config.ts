// Sentry — browser-side error capture. Loaded by Next.js automatically
// because the file lives at project root with this exact name.
// See sentry.server.config.ts + sentry.edge.config.ts for the other
// runtimes; all three share the same DSN env var.
//
// DSN comes from NEXT_PUBLIC_SENTRY_DSN. When not set (local dev or
// pre-account-creation), Sentry initializes as a no-op — no errors
// thrown, no network traffic. Safe to ship without setting the env var.

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    // Sample rate. 1.0 = capture 100% of errors. We're at low volume
    // during beta — turn this down to 0.2-0.5 once daily errors
    // exceed the free-tier 5K/mo budget.
    tracesSampleRate: 0,            // performance traces off (cost saver)
    replaysOnErrorSampleRate: 0,    // session replay off (cost saver)
    replaysSessionSampleRate: 0,
    // Tag every event with the Tapestry environment so dashboards
    // can split prod / preview / dev cleanly.
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    // Don't send events for known-noisy errors. ResizeObserver and
    // failed-to-fetch on third-party scripts dominate Next.js noise.
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Failed to fetch',
      'NetworkError when attempting to fetch resource',
      'Load failed',
    ],
  })
}
