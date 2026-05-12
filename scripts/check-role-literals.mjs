#!/usr/bin/env node
// Guardrail: forbid capital-case role literals ('Thriver' / 'Survivor' /
// 'Ghost') in app code. The DB normalises role to lowercase, so any
// inline comparison against the capital-case form silently never matches
// post-migration and silently hides features. Reads stay safe via the
// helpers in `lib/auth/roles.ts`; writes should also use the lowercase
// constants exported there.
//
// Allow-list:
//   - lib/auth/roles.ts itself (defines the constants).
//   - app/logging/page.tsx — the Ghost/Survivor labels there are UI
//     display strings inside Leaflet popup HTML, not DB comparisons.
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
])

// Matches 'Thriver' / "Thriver" / 'Survivor' / "Survivor" / 'Ghost' / "Ghost"
// as standalone quoted strings (any leading/trailing punctuation OK).
const ROLE_LITERAL = /['"](Thriver|Survivor|Ghost)['"]/g

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
      const matches = [...line.matchAll(ROLE_LITERAL)]
      if (matches.length === 0) continue
      for (const m of matches) {
        offenders.push({ file: rel, line: i + 1, match: m[0], snippet: line.trim() })
      }
    }
  }
}

for (const d of SCAN_DIRS) {
  const abs = path.join(ROOT, d)
  if (fs.existsSync(abs)) walk(abs)
}

if (offenders.length === 0) {
  console.log(`OK — scanned ${scanned} files, no capital-case role literals found.`)
  process.exit(0)
}

console.error(`Found ${offenders.length} capital-case role literal${offenders.length === 1 ? '' : 's'} in ${scanned} scanned files:\n`)
for (const o of offenders) {
  console.error(`  ${o.file}:${o.line}  ${o.match}`)
  console.error(`     ${o.snippet}`)
}
console.error(`\nFix: use THRIVER / SURVIVOR / GHOST constants from lib/auth/roles.ts,`)
console.error(`or use isThriver()/isSurvivor()/isGhost() for comparisons.`)
console.error(`Add \`// role-literal-allow\` on a UI-only line to suppress.`)
process.exit(1)
