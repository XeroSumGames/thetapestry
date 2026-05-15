#!/usr/bin/env node
// Guardrail: forbid capital-case role literals AND inline lowercase role
// comparisons in app code.
//
// Catches:
//   1. Capital-case literals: 'Thriver' / 'Survivor' / 'Ghost' as quoted
//      strings. The DB normalises role to lowercase, so any inline comparison
//      against the capital-case form silently never matches post-migration.
//   2. Inline lowercase comparisons via .toLowerCase():
//        .role?.toLowerCase() === 'thriver'
//        .role.toLowerCase() === 'thriver'
//        .role?.toLowerCase() !== 'thriver'  (negated form)
//        (or any of the three role values, with ==/===/!=/!==)
//   2b. Wrapped String(...).toLowerCase() shape:
//        String(profile.role).toLowerCase() === 'thriver'
//   3. Direct bare lowercase comparisons:
//        .role === 'thriver'   .role !== 'survivor'   .role === 'ghost'
//        .role == 'thriver'    etc.
//      (where .role is the profile role field, not a community labor role)
//
// Fix: use isThriver() / isSurvivor() / isGhost() from lib/auth/roles.ts for
// reads; use THRIVER / SURVIVOR / GHOST constants for writes.
//
// Allow-list:
//   - lib/auth/roles.ts itself (defines the constants + helpers).
//   - app/logging/page.tsx — the Ghost/Survivor labels there are UI
//     display strings inside Leaflet popup HTML, not DB comparisons.
//   - lib/community-logic.ts — uses .role for community labor roles
//     (gatherer / maintainer / safety / assigned / unassigned), not profile roles.
//   - Any line that contains the token `role-literal-allow` (in any
//     comment form, JSX or JS) is excused.

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SCAN_DIRS = ['app', 'components', 'lib', 'scripts']
const SKIP_PATHS = new Set([
  path.join('lib', 'auth', 'roles.ts'),
  // Leaflet popup HTML — Ghost/Survivor are UI labels, not DB comparisons.
  path.join('app', 'logging', 'page.tsx'),
  // Community labor roles (gatherer/maintainer/safety/assigned/unassigned).
  path.join('lib', 'community-logic.ts'),
])

// Pattern 1: capital-case quoted literals 'Thriver' / "Thriver" etc.
const CAPITAL_ROLE = /['"](Thriver|Survivor|Ghost)['"]/g

// Pattern 2: .role?.toLowerCase() or .role.toLowerCase() followed (anywhere
// on the same line) by ==, ===, != or !== and a quoted role string.
const TOLOWER_CMP = /\.role\??\.toLowerCase\(\)\s*[!=]={1,2}\s*['"][^'"]*['"]/g

// Pattern 2b: String(...).toLowerCase() comparison — catches the wrapped
// shape used when .role might be null/non-string. Same operator set.
const STRING_TOLOWER_CMP = /String\([^)]*\)\.toLowerCase\(\)\s*[!=]={1,2}\s*['"](?:thriver|survivor|ghost)['"]/g

// Pattern 3: .role === 'thriver' / .role !== 'survivor' / etc.
// (direct bare comparison — only the three profile role strings).
// Requires ==, ===, !=, or !==.
const BARE_ROLE_CMP = /\.role\s*[!=]={1,2}\s*['"](?:thriver|survivor|ghost)['"]/g

const offenders = []
let scanned = 0

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    const rel = path.relative(ROOT, full)
    if (SKIP_PATHS.has(rel)) continue
    if (entry.isDirectory()) { walk(full); continue }
    if (!/\.(t|j)sx?$/.test(entry.name)) continue
    scanned++
    const src = fs.readFileSync(full, 'utf8')
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes('role-literal-allow')) continue

      for (const [pattern, kind] of [
        [CAPITAL_ROLE, 'capital-case role literal'],
        [TOLOWER_CMP, 'inline .toLowerCase() role comparison'],
        [STRING_TOLOWER_CMP, 'inline String(...).toLowerCase() role comparison'],
        [BARE_ROLE_CMP, 'inline .role === literal comparison'],
      ]) {
        pattern.lastIndex = 0
        const matches = [...line.matchAll(pattern)]
        for (const m of matches) {
          offenders.push({ file: rel, line: i + 1, kind, match: m[0], snippet: line.trim() })
        }
      }
    }
  }
}

for (const d of SCAN_DIRS) {
  const abs = path.join(ROOT, d)
  if (fs.existsSync(abs)) walk(abs)
}

if (offenders.length === 0) {
  console.log(`OK — scanned ${scanned} files, no role literal or inline comparison found.`)
  process.exit(0)
}

console.error(`Found ${offenders.length} role literal / inline comparison${offenders.length === 1 ? '' : 's'} in ${scanned} scanned files:\n`)
for (const o of offenders) {
  console.error(`  ${o.file}:${o.line}  [${o.kind}]  ${o.match}`)
  console.error(`     ${o.snippet}`)
}
console.error(`\nFix: use isThriver()/isSurvivor()/isGhost() from lib/auth/roles.ts for comparisons,`)
console.error(`or THRIVER/SURVIVOR/GHOST constants for writes.`)
console.error(`Add \`// role-literal-allow\` on a UI-only line to suppress.`)
process.exit(1)
