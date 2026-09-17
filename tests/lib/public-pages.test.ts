import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  isPublicPath,
  isV2Path,
  PUBLIC_PAGES,
  PUBLIC_PREFIXES,
  PUBLIC_PAGES_ALL,
  PUBLIC_PREFIXES_ALL,
  V2_PREFIX,
} from '../../lib/auth/public-pages'

// This is the login gate, so the tests are built around ONE property: adding
// the /v2 rules must not change the verdict for any path that already existed.
// The corpus is generated from the real route tree rather than hand-listed, so
// a newly added page cannot silently change guest visibility without failing
// here. Case list contributed by the hub's independent verification of
// ff39745b, which implemented both predicates and diffed them over 133 routes.

/** The predicate as it was BEFORE /v2 existed, rebuilt from the base lists. */
function isPublicPathBeforeV2(pathname: string): boolean {
  return PUBLIC_PAGES.some(p => pathname === p)
    || PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
    || pathname === '/map'
}

/** Every real route in app/, with groups stripped and params normalised. */
function realRoutes(): string[] {
  const appDir = join(process.cwd(), 'app')
  if (!existsSync(appDir)) return []
  const out: string[] = []
  const walk = (dir: string, segs: string[]) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const name = entry.name
        if (name.startsWith('_') || name === 'api') continue
        // Route groups like (marketing) do not appear in the URL.
        const next = name.startsWith('(') && name.endsWith(')') ? segs
          // [id] and [...slug] become a placeholder segment.
          : [...segs, name.startsWith('[') ? 'SEG' : name]
        walk(join(dir, name), next)
      } else if (entry.name === 'page.tsx' || entry.name === 'page.ts') {
        out.push('/' + segs.join('/'))
      }
    }
  }
  walk(appDir, [])
  // app/page.tsx yields '/' rather than ''
  return [...new Set(out.map(r => (r === '/' ? '/' : r.replace(/\/$/, '')) || '/'))]
}

describe('isPublicPath: the /v2 rules changed nothing that already existed', () => {
  const routes = realRoutes()

  it('found a real route corpus to test against', () => {
    // Guards against the walk silently returning [] and every property below
    // passing vacuously.
    expect(routes.length).toBeGreaterThan(100)
    expect(routes).toContain('/')
    expect(routes).toContain('/dashboard')
  })

  it('gives every pre-existing route exactly its old verdict', () => {
    const changed = routes
      .filter(r => !r.startsWith(V2_PREFIX))
      .filter(r => isPublicPath(r) !== isPublicPathBeforeV2(r))
    expect(changed).toEqual([])
  })
})

describe('isPublicPath: guest-visible paths', () => {
  for (const p of ['/', '/v2', '/dashboard', '/v2/dashboard', '/rules', '/v2/rules', '/rules/combat/stress', '/v2/rules/combat']) {
    it(`${p} is public`, () => expect(isPublicPath(p)).toBe(true))
  }
})

describe('isPublicPath: paths that must stay behind the login gate', () => {
  // The /v2 twins are the load-bearing half. If '/v2' ever leaks into
  // PUBLIC_PREFIXES, every one of these flips to public.
  for (const p of [
    '/moderate', '/v2/moderate',
    '/logging', '/v2/logging',
    '/tools/token-creator', '/v2/tools/token-creator',
    '/gm-screen', '/v2/gm-screen',
    '/stories/abc/table', '/v2/stories/abc/table',
  ]) {
    it(`${p} is NOT public`, () => expect(isPublicPath(p)).toBe(false))
  }

  it('never carries a bare /v2 in the prefix list, which would expose the whole frame', () => {
    // POSITIVE FIRST. Both assertions below are negative, and a negative
    // assertion is satisfied by an EMPTY list - `[].every(...)` is true and
    // `[]` contains nothing - so on their own they would be green on exactly
    // the breakage they exist to catch. Anchoring on real membership first is
    // what makes the guard capable of failing.
    // (E2E hit the same shape in a Playwright guard using not.toContainText as
    // a stand-in for "we are signed in"; it passed while logged out.)
    expect(PUBLIC_PREFIXES_ALL).toContain('/rules')
    expect(PUBLIC_PREFIXES_ALL).toContain('/v2/rules')
    expect(PUBLIC_PREFIXES_ALL).not.toContain(V2_PREFIX)
    expect(PUBLIC_PREFIXES_ALL.every(p => p !== '/v2' && p !== '/v2/')).toBe(true)
  })
})

describe('isV2Path anchoring', () => {
  for (const p of ['/v2', '/v2/', '/v2/dashboard']) {
    it(`${p} is a /v2 path`, () => expect(isV2Path(p)).toBe(true))
  }
  // A bare /^\/v2/ would match all three of these. The ($|\/) is what stops it.
  for (const p of ['/v20', '/v2foo', '/av2']) {
    it(`${p} is NOT a /v2 path`, () => expect(isV2Path(p)).toBe(false))
  }
})

describe('the derived lists are a strict superset of the originals', () => {
  it('keeps every original page and adds only /v2 entries', () => {
    for (const p of PUBLIC_PAGES) expect(PUBLIC_PAGES_ALL).toContain(p)
    const added = PUBLIC_PAGES_ALL.filter(p => !PUBLIC_PAGES.includes(p))
    expect(added.every(p => p.startsWith(V2_PREFIX))).toBe(true)
    expect(added).toHaveLength(PUBLIC_PAGES.length)
  })

  it('maps the root to /v2 rather than /v2/', () => {
    expect(PUBLIC_PAGES_ALL).toContain('/v2')
    expect(PUBLIC_PAGES_ALL).not.toContain('/v2/')
  })

  it('documents the trailing-slash asymmetry: /v2/ is not public, but IS a /v2 path', () => {
    // Deliberate. Next normalises the trailing slash before routing, and
    // redirecting to login is the safe direction, so it is not special-cased.
    expect(isPublicPath('/v2/')).toBe(false)
    expect(isV2Path('/v2/')).toBe(true)
  })
})
