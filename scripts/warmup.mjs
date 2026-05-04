#!/usr/bin/env node
// scripts/warmup.mjs
// Warms Vercel's edge cache for the high-traffic routes after a
// deploy. Vercel builds + caches each route on first hit; testers
// landing on a cold route can wait 3-10s for the first paint. Hitting
// every public route once primes the cache so the first real visitor
// sees a fast page.
//
// Run after a deploy:
//   node scripts/warmup.mjs
//
// Or in CI:
//   node scripts/warmup.mjs && echo "Cache primed"
//
// Times each request and prints a summary so cold-render outliers
// are obvious.

const BASE = process.env.WARMUP_BASE_URL || 'https://thetapestry.distemperverse.com'

// Public routes — anything an unauthenticated visitor might land on.
// Logged-in routes (/dashboard /characters /stories /communities)
// require auth and would 401 — Vercel still builds them, but we'd
// need a cookie. The auth-gated ones get warmed by the test users
// during their actual session.
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/welcome',
  '/firsttimers',
  '/privacy',
  '/terms',
  '/rules',
  '/rules/overview',
  '/rules/core-mechanics',
  '/rules/communities',
  '/rumors',
  '/campfire',
  '/map',
]

async function hit(path) {
  const url = `${BASE}${path}`
  const start = Date.now()
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TapestryWarmup/1.0' } })
    const ms = Date.now() - start
    const status = res.status
    const tag = ms > 3000 ? '🐌 SLOW' : ms > 1500 ? '⚠ warm' : '✓ fast'
    console.log(`${String(ms).padStart(5)}ms  ${status}  ${tag}  ${path}`)
    return { path, ms, status }
  } catch (err) {
    const ms = Date.now() - start
    console.log(`${String(ms).padStart(5)}ms  ERR        ${path}  ${err.message}`)
    return { path, ms, status: 0, error: err.message }
  }
}

async function main() {
  console.log(`Warming ${PUBLIC_ROUTES.length} routes on ${BASE}…\n`)
  const results = []
  // Sequential so we don't burst-hit Vercel and trigger any rate-limit.
  for (const route of PUBLIC_ROUTES) {
    results.push(await hit(route))
  }
  const ok = results.filter(r => r.status >= 200 && r.status < 400).length
  const slow = results.filter(r => r.ms > 3000).length
  const failed = results.filter(r => r.status === 0 || r.status >= 400)
  console.log(`\n${ok}/${results.length} OK  ·  ${slow} slow (>3s)`)
  if (failed.length > 0) {
    console.log(`Failed:`)
    for (const f of failed) console.log(`  ${f.path}  status=${f.status}  ${f.error ?? ''}`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Warmup failed:', err)
  process.exit(1)
})
