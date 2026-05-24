import type { Page, Request, Response, ConsoleMessage } from '@playwright/test'

// Phase 6 drove prod console.log|warn to 0 and routed diagnostics through
// trace() into the recorder buffer. This collector LOCKS that in: it records
// every console error, uncaught page error, and failed/non-2xx network request
// on a page, so a spec can assert the page stayed clean.
//
// ALLOWLISTS exist for genuinely-external noise we do not own (third-party
// widgets, beacons). They default near-empty and should only grow with a
// one-line reason - never to paper over an app regression.

// Console-error message substrings to ignore (third-party only).
const CONSOLE_ALLOW: { match: string; why: string }[] = [
  // Turnstile occasionally logs a benign retry on slow challenge solves.
  { match: 'challenges.cloudflare.com', why: 'Cloudflare Turnstile widget (login bot-check), not our code' },
]

// Network failures are only ASSERTED for in-scope origins (our host + Supabase).
// Third-party failures are still recorded for visibility but never fail a test.
function inScope(url: string, baseURL?: string): boolean {
  try {
    const host = new URL(url).host
    const baseHost = baseURL ? new URL(baseURL).host : ''
    return (!!baseHost && host === baseHost) || host.includes('supabase')
  } catch {
    return false
  }
}

// In-scope network URL substrings to ignore (expected non-2xx that is not a bug).
const NETWORK_ALLOW: { match: string; why: string }[] = [
  { match: '/favicon', why: 'favicon variants 404 harmlessly on some routes' },
  // Sentry tunnel can 429 under burst; not an app failure.
  { match: '/monitoring', why: 'Sentry tunnel route (rate-limited bursts are benign)' },
]

export interface PageProblems {
  consoleErrors: string[]
  pageErrors: string[]
  networkFailures: string[]
  /** Out-of-scope (third-party) failures - recorded, never asserted. */
  externalFailures: string[]
}

export function watchPage(page: Page, baseURL?: string): PageProblems {
  const p: PageProblems = { consoleErrors: [], pageErrors: [], networkFailures: [], externalFailures: [] }

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (CONSOLE_ALLOW.some(a => text.includes(a.match))) return
    const loc = msg.location()
    p.consoleErrors.push(`console.error: ${text}${loc?.url ? `  @ ${loc.url}:${loc.lineNumber}` : ''}`)
  })

  page.on('pageerror', (err: Error) => {
    p.pageErrors.push(`uncaught: ${err.message}`)
  })

  const recordFailure = (url: string, label: string) => {
    if (NETWORK_ALLOW.some(a => url.includes(a.match))) return
    if (inScope(url, baseURL)) p.networkFailures.push(`${label}: ${url}`)
    else p.externalFailures.push(`${label}: ${url}`)
  }

  page.on('requestfailed', (req: Request) => {
    const f = req.failure()
    // Aborted requests (navigation cancels, prefetch races) are not failures.
    if (f?.errorText === 'net::ERR_ABORTED') return
    recordFailure(req.url(), `requestfailed (${f?.errorText ?? 'unknown'})`)
  })

  page.on('response', (res: Response) => {
    const s = res.status()
    if (s >= 400) recordFailure(res.url(), `HTTP ${s}`)
  })

  return p
}

// Build a readable assertion message; empty string means clean.
export function describeProblems(route: string, p: PageProblems): string {
  const lines: string[] = []
  if (p.consoleErrors.length) lines.push(`  Console errors (${p.consoleErrors.length}):`, ...p.consoleErrors.map(s => '    - ' + s))
  if (p.pageErrors.length) lines.push(`  Uncaught page errors (${p.pageErrors.length}):`, ...p.pageErrors.map(s => '    - ' + s))
  if (p.networkFailures.length) lines.push(`  In-scope network failures (${p.networkFailures.length}):`, ...p.networkFailures.map(s => '    - ' + s))
  if (!lines.length) return ''
  return `${route} was not clean:\n${lines.join('\n')}` +
    (p.externalFailures.length ? `\n  (third-party, not asserted: ${p.externalFailures.length})` : '')
}
