#!/usr/bin/env node
// Enforce a minimum inline `fontSize` of 12px across .ts/.tsx source.
//
// Two modes:
//   node scripts/check-font-sizes.mjs          -> report offenders, exit 1 if any
//   node scripts/check-font-sizes.mjs --fix    -> rewrite offenders to 12px
//
// Why: tiny font sizes (9–11px) make the UI hard to read. This script is the
// backstop for the "12px minimum" convention documented in AGENTS.md.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const fix = process.argv.includes('--fix')
const root = process.cwd()
const skipDirs = new Set(['node_modules', '.next', '.git', 'scripts'])

// Match:  fontSize: '10px'  fontSize: "11px"  fontSize:'9px'  (no template literals)
const RE = /fontSize:\s*(['"])([0-9]+)px\1/g

const offenders = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) { walk(full); continue }
    if (!/\.(ts|tsx)$/.test(name)) continue
    const src = readFileSync(full, 'utf8')
    let changed = false
    let next = src
    const lines = src.split('\n')
    for (const m of src.matchAll(RE)) {
      const n = parseInt(m[2], 10)
      if (n >= 12) continue
      // Locate line number for readable reporting.
      const idx = m.index ?? 0
      const line = src.slice(0, idx).split('\n').length
      offenders.push({ file: full.replace(root + '\\', '').replace(/\\/g, '/'), line, match: m[0], size: n })
    }
    if (fix) {
      next = src.replace(RE, (full, q, num) => parseInt(num, 10) < 12 ? `fontSize: ${q}12px${q}` : full)
      if (next !== src) { writeFileSync(full, next, 'utf8'); changed = true }
    }
  }
}

walk(root)

if (offenders.length === 0) {
  console.log('[check-font-sizes] OK — no inline fontSize below 12px.')
  process.exit(0)
}

if (fix) {
  console.log(`[check-font-sizes] rewrote ${offenders.length} occurrence(s) to 12px.`)
  process.exit(0)
}

console.log(`[check-font-sizes] Found ${offenders.length} sub-12px fontSize occurrence(s):`)
for (const o of offenders.slice(0, 40)) {
  console.log(`  ${o.file}:${o.line}  ${o.match}  -> should be 12px`)
}
if (offenders.length > 40) console.log(`  … and ${offenders.length - 40} more`)
console.log('Run `node scripts/check-font-sizes.mjs --fix` to bump them all to 12px.')
process.exit(1)
