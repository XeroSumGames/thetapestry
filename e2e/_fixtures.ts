import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Disposable test data - the ONLY game/accounts the suite is allowed to touch
// (prod is the env; bright lines forbid touching real user content).
export const CAMPAIGN_ID = '35ed2133-498a-43d2-bbd6-21da05233af2' // THE ARENA

// The disposable accounts: GM + three players, all members of THE ARENA. The
// account role (thriver/survivor/ghost, from lib/auth/roles) is a SEPARATE axis
// from the campaign GM/player role - fill userId / accountRole in as confirmed.
export const ACCOUNTS = {
  gm:    { label: 'Xero (GM)',             email: 'xerosumgames@gmail.com',   userId: '5806fd27-fcac-4163-b8a8-61476150962c' },
  marv:  { label: 'Marv (player 1)',       email: 'tony_bushell@hotmail.com', userId: '02c22e46-acd0-44d5-b8ff-1b70e8d2fd00' },
  pesky: { label: 'Pesky Larue (player 2)' },
  percy: { label: 'Percy Bent (player 3)' },
} as const

export type AccountKey = keyof typeof ACCOUNTS

// Captured session state (gitignored - live credentials). One file per account,
// minted automatically by the `setup` project in e2e/auth.setup.ts.
//
// KEYED BY TARGET ORIGIN, and it must stay that way. Cookies are origin-scoped,
// so a localhost session and a prod session are NOT interchangeable - but
// auth.setup.ts REUSES any state file younger than FRESH_MS (50 min). With one
// shared path, running against localhost and then prod inside that window makes
// the second run silently reuse the first's session and execute LOGGED OUT: no
// error, no failed setup, just a suite quietly asserting guest behaviour and a
// pile of confusing failures. Both directions.
//
// Not hypothetical - measured 2026-09-16, the prod state files were 42 minutes
// old (inside the window) at the moment the /v2 work needed a localhost run.
// Splitting by host makes isFresh() meaningful PER ENVIRONMENT; the only cost is
// one extra login the first time each origin is used.
//
// The default MUST match playwright.config.ts's baseURL default, or a plain
// prod run would look like a different environment and re-mint every time.
const AUTH_ENV = (() => {
  const base = process.env.E2E_BASE_URL ?? 'https://thetapestry.distemperverse.com'
  try {
    return new URL(base).host.replace(/[^a-z0-9]+/gi, '_')
  } catch {
    return 'default'
  }
})()

const authFile = (key: string) => join(process.cwd(), 'e2e', '.auth', AUTH_ENV, `${key}.json`)

export const AUTH = {
  gm:    authFile('gm'),
  marv:  authFile('marv'),
  pesky: authFile('pesky'),
  percy: authFile('percy'),
} as const

export function hasAuth(role: AccountKey): boolean {
  return existsSync(AUTH[role])
}

// --- Credentials (for the auto-login setup project) -------------------------
// Source order: env (E2E_<KEY>_EMAIL / E2E_<KEY>_PASSWORD, or a shared
// E2E_PASSWORD) -> gitignored e2e/.auth/credentials.json. Known emails for
// gm/marv come from ACCOUNTS; a top-level "password" in the json applies to any
// key missing its own. NEVER commit real values - e2e/.auth/ is gitignored.
export function loadCredential(key: AccountKey): { email: string; password: string } | null {
  const up = key.toUpperCase()
  const envEmail = process.env[`E2E_${up}_EMAIL`] ?? (ACCOUNTS[key] as { email?: string }).email
  const envPw = process.env[`E2E_${up}_PASSWORD`] ?? process.env.E2E_PASSWORD
  if (envEmail && envPw) return { email: envEmail, password: envPw }
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), 'e2e', '.auth', 'credentials.json'), 'utf8'))
    const entry = raw?.[key] ?? {}
    const email = entry.email ?? (ACCOUNTS[key] as { email?: string }).email
    const password = entry.password ?? raw?.password
    if (email && password) return { email, password }
  } catch { /* no credentials file */ }
  return null
}

export function hasCredential(key: AccountKey): boolean {
  return loadCredential(key) !== null
}

// A spec can use the account if a session file already exists OR we have creds
// to mint one in the setup project (the file is created at run time, before
// the dependent tests run).
export function canAuth(key: AccountKey): boolean {
  return hasAuth(key) || hasCredential(key)
}

// The three player keys, for fan-out realtime tests (GM acts -> all players see).
export const PLAYER_KEYS = ['marv', 'pesky', 'percy'] as const

// --- Static route discovery -------------------------------------------------
// Auto-derive every static (no-param) route from app/**/page.tsx so the sweep
// covers new pages with zero maintenance. Dynamic [param] routes, popouts that
// need query params, auth flows, and destructive admin tools are excluded -
// those get dedicated specs with the right context.

const EXCLUDE_EXACT = new Set<string>([
  '/login', '/signup',
  // Popouts: render only with ?campaign=&scene=... query params. Covered by
  // dedicated popout/realtime specs, not the blind sweep.
  '/vehicle', '/gm-screen', '/gm-notes-popout', '/handout', '/reader-popout',
  '/scene-controls-popout', '/character-sheet', '/npc-sheet', '/campaign-sheet',
])

// Whole subtrees to skip. /tools/* includes reseed/migrate/rescale which MUTATE
// data on load - bright-line territory, never sweep them.
const EXCLUDE_PREFIX = ['/tools', '/join', '/stories/join', '/campaigns/new', '/stories/new']

function discoverStaticRoutes(): string[] {
  const appDir = join(process.cwd(), 'app')
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) { walk(full); continue }
      if (name !== 'page.tsx') continue
      const rel = dir.slice(appDir.length).replace(/\\/g, '/')
      const route = rel === '' ? '/' : rel
      if (route.includes('[')) continue // dynamic - needs a seeded id
      if (EXCLUDE_EXACT.has(route)) continue
      if (EXCLUDE_PREFIX.some(p => route === p || route.startsWith(p + '/'))) continue
      out.push(route)
    }
  }
  walk(appDir)
  return out.sort()
}

export const STATIC_ROUTES = discoverStaticRoutes()

// Dynamic routes resolved against the disposable campaign. Kept separate so a
// bad id surfaces as its own failing test, not a poisoned static sweep.
export const CAMPAIGN_ROUTES = [
  `/stories/${CAMPAIGN_ID}`,
  `/stories/${CAMPAIGN_ID}/table`,
  `/stories/${CAMPAIGN_ID}/sessions`,
  `/stories/${CAMPAIGN_ID}/snapshots`,
  `/stories/${CAMPAIGN_ID}/community`,
]
