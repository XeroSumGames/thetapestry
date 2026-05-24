import { readdirSync, statSync, existsSync } from 'node:fs'
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
// produced by `node e2e/capture-auth.mjs <key>`  (gm | marv | pesky | percy).
export const AUTH = {
  gm:    join(process.cwd(), 'e2e', '.auth', 'gm.json'),
  marv:  join(process.cwd(), 'e2e', '.auth', 'marv.json'),
  pesky: join(process.cwd(), 'e2e', '.auth', 'pesky.json'),
  percy: join(process.cwd(), 'e2e', '.auth', 'percy.json'),
} as const

export function hasAuth(role: AccountKey): boolean {
  return existsSync(AUTH[role])
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
