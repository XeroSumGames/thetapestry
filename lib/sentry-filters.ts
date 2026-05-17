// Sentry event filters — drop known-benign noise BEFORE it hits the
// Sentry ingest quota. Free tier is 5,000 events/month; a single noisy
// pattern (ResizeObserver loop, AbortError on user navigation, browser
// extension errors) can burn through the entire monthly budget in a day.
// These filters preserve diagnostic value while extending the free-tier
// runway.
//
// Shared by all three Sentry configs (client / server / edge). Applied
// AFTER the PII-scrubbing pass in each config's beforeSend hook —
// returns the event to ship it, or null to drop it silently.

import type { ErrorEvent } from '@sentry/nextjs'

// Error messages that carry zero diagnostic value. Patterns matched
// case-insensitively against `event.exception.values[0].value` and
// `event.message`. Keep this list conservative — every entry is a
// signal we're agreeing to never see.
const BENIGN_MESSAGES: RegExp[] = [
  // Browser quirks
  /^ResizeObserver loop /i,
  /^Non-Error promise rejection captured/i,
  // Aborted fetches when the user navigates away mid-request
  /^AbortError\b/i,
  /The user aborted a request/i,
  /The operation was aborted/i,
  /signal is aborted without reason/i,
  // Network-layer noise on navigation
  /^Load failed$/i,                       // Safari fetch-on-navigation
  /NetworkError when attempting to fetch resource/i,
  /^Failed to fetch$/i,                   // Chrome fetch-on-navigation (exact match only — real fetch failures have a cause appended)
  // Server-side socket churn
  /ECONNRESET/,
  /Client network socket disconnected/,
]

// Source-file URLs that indicate "not our code, not our problem."
// Mostly browser extensions injecting into the page. We never want to
// pay quota for these.
const BENIGN_SOURCES: RegExp[] = [
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
  /^safari-extension:\/\//,
  /^safari-web-extension:\/\//,
  /^webkit-masked-url:\/\//,
]

export function dropBenignEvent(event: ErrorEvent): ErrorEvent | null {
  // Drop by message text.
  const exception = event.exception?.values?.[0]
  const msg = exception?.value ?? (typeof event.message === 'string' ? event.message : '')
  if (msg && BENIGN_MESSAGES.some(p => p.test(msg))) return null

  // Drop by top stackframe source URL (browser extensions etc).
  // `frames` is bottom-up by Sentry convention — the last entry is
  // the innermost frame, which is where the actual code lives.
  const frames = exception?.stacktrace?.frames
  if (Array.isArray(frames) && frames.length > 0) {
    const innermost = frames[frames.length - 1]
    const filename = innermost?.filename ?? ''
    if (filename && BENIGN_SOURCES.some(p => p.test(filename))) return null
  }

  return event
}
