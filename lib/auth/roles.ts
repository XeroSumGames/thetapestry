// Centralised role-comparison helpers.
//
// Background
// ----------
// The DB normalises `profiles.role` to lowercase via the trg_normalize_role
// trigger (every insert/update), so the canonical form on disk is
// 'thriver' / 'survivor' / 'ghost'. Historically the codebase had a mix of
// case-sensitive `role === 'Thriver'` comparisons and defensive
// `role.toLowerCase() === 'thriver'` patterns scattered across 30+ files.
// Both broke in different ways:
//   - Capital-case comparisons silently never matched after the lowercase
//     migration, hiding features from Thrivers entirely (e.g. the recorder
//     toggle gated by `=== 'Thriver'` never showed up).
//   - Defensive toLowerCase()s worked but were error-prone (forgetting the
//     null-coalesce, calling on non-string types, etc.) and impossible to
//     audit.
//
// Rule going forward
// ------------------
//   1. NEVER compare role strings inline — always use isThriver / isSurvivor.
//   2. NEVER write a capital-case role literal — use THRIVER / SURVIVOR / GHOST.
//   3. The guardrail script `node scripts/check-role-literals.mjs` will flag
//      any raw `'Thriver'` / `'Survivor'` / `'Ghost'` literal in app code.
//
// All helpers accept a loose `unknown` input so they're safe on partially-
// loaded profile rows, RPC results with stringly-typed fields, etc.

export const THRIVER = 'thriver' as const
export const SURVIVOR = 'survivor' as const
export const GHOST = 'ghost' as const

export type Role = typeof THRIVER | typeof SURVIVOR | typeof GHOST

// Normalise any role-shaped input to a canonical lowercase Role | null.
// Returns null for empty / non-string / unknown-value inputs so callers
// can do a simple `=== THRIVER` check without worrying about casing.
export function normalizeRole(input: unknown): Role | null {
  if (typeof input !== 'string') return null
  const lower = input.toLowerCase().trim()
  if (lower === THRIVER || lower === SURVIVOR || lower === GHOST) return lower as Role
  return null
}

// Role probes — accept either a raw role string OR a profile-shaped object
// with a `.role` field. The latter form is what most callers actually have
// from `supabase.from('profiles').select(...)`.
type RoleHolder = { role?: unknown } | null | undefined

function pickRole(input: unknown | RoleHolder): unknown {
  if (input != null && typeof input === 'object' && 'role' in input) {
    return (input as { role?: unknown }).role
  }
  return input
}

export function isThriver(input: unknown | RoleHolder): boolean {
  return normalizeRole(pickRole(input)) === THRIVER
}

export function isSurvivor(input: unknown | RoleHolder): boolean {
  return normalizeRole(pickRole(input)) === SURVIVOR
}

export function isGhost(input: unknown | RoleHolder): boolean {
  return normalizeRole(pickRole(input)) === GHOST
}
