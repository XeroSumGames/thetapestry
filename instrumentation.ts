// Next.js instrumentation hook — runs once per worker on cold start.
// We use it solely to pick the right Sentry config for the current
// runtime (Node or Edge). The actual SDK init happens inside each
// sentry.*.config.ts file.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Catch unhandled errors thrown inside React server components +
// route handlers so Sentry sees them too. Sentry's SDK provides
// the helper.
export { captureRequestError as onRequestError } from '@sentry/nextjs'
