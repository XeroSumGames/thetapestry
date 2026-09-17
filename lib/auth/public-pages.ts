// Guest-visibility and shell-layout rules for the app, extracted from
// components/LayoutShell.tsx so they can be unit-tested.
//
// This is the LOGIN GATE. isPublicPath decides whether an unauthenticated
// visitor sees a page or gets redirected to /login, so a mistake here either
// locks out guests or leaks authenticated surfaces. It lived inline in a client
// component, where it could not be tested at all; the accompanying
// tests/lib/public-pages.test.ts asserts the property that matters over every
// real route in the app.
//
// THE /v2 RULES ARE DERIVED, NOT DUPLICATED. The /v2 frame
// (tasks/plan-one-frame-new-pages-2026-09-15.md) mounts the same pages under a
// prefix, so its guest rules must match the old ones exactly. Deriving them
// buys two things: the lists cannot drift as pages are added, and the safety
// argument is checkable by inspection - every derived entry begins with '/v2',
// which cannot equal or prefix-match a pathname that does not, so no existing
// path's verdict can change.
//
// THE TRAP TO NOT REINTRODUCE: '/v2' must never be added to PUBLIC_PREFIXES.
// A prefix entry matches every subpath, so a bare '/v2' prefix would make the
// entire new frame guest-visible, /v2/moderate and /v2/logging included. The
// prefixes are derived one-for-one from the OLD prefix list instead, which is
// why only /v2/rules and its subpaths are public. There is a test for this.

/** Pages an unauthenticated visitor (a "ghost") may view. */
export const PUBLIC_PAGES = ['/', '/map', '/dashboard', '/stories', '/campaigns', '/characters', '/creating-a-character', '/characters/new', '/characters/quick', '/characters/random', '/campfire', '/press', '/quick-reference']

/**
 * Path prefixes a ghost may view, matching the path AND any subpath. Used for
 * the SRD rules viewer, where every section gets its own subroute.
 */
export const PUBLIC_PREFIXES = ['/rules']

/** Address prefix for the new frame's pages. */
export const V2_PREFIX = '/v2'

/** PUBLIC_PAGES plus its /v2 twins. '/' maps to '/v2', not '/v2/'. */
export const PUBLIC_PAGES_ALL = [
  ...PUBLIC_PAGES,
  ...PUBLIC_PAGES.map(p => (p === '/' ? V2_PREFIX : V2_PREFIX + p)),
]

/** PUBLIC_PREFIXES plus its /v2 twins. Never contains a bare '/v2'. */
export const PUBLIC_PREFIXES_ALL = [...PUBLIC_PREFIXES, ...PUBLIC_PREFIXES.map(p => V2_PREFIX + p)]

/**
 * Whether a ghost may view this path.
 *
 * NOTE on '/v2/' with a trailing slash: it is NOT public, because
 * PUBLIC_PAGES_ALL holds '/v2' exactly. A guest hitting '/v2/' is redirected to
 * login. That is the safe direction and Next normalises the trailing slash
 * before routing, so it is left as-is rather than special-cased. It is
 * deliberately asymmetric with isV2Path, which DOES match '/v2/'.
 */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PAGES_ALL.some(p => pathname === p)
    || PUBLIC_PREFIXES_ALL.some(p => pathname === p || pathname.startsWith(p + '/'))
    // Retained from the original inline predicate. Redundant, since '/map' is
    // in PUBLIC_PAGES, but kept so this function is a faithful move.
    || pathname === '/map'
}

/**
 * Pages that draw their own chrome and skip the old sidebar. The ($|\/)
 * anchoring matters: a bare /^\/v2/ would also match '/v20' and '/v2foo'.
 */
export const V2_PATTERN = /^\/v2($|\/)/

/** Whether this path belongs to the new frame. */
export function isV2Path(pathname: string): boolean {
  return V2_PATTERN.test(pathname)
}
