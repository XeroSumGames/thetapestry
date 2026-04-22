#!/usr/bin/env node
// Enforce UI readability rules across .ts/.tsx source:
//   1) Inline `fontSize` must be >= 12px (9–11px get flagged / auto-bumped).
//   2) The combo `fontSize: '12px'` + `color: '#3a3a3a'` on the same line is
//      banned — that pair is illegible on dark backgrounds. Bump to 13px /
//      `#cce0f5` instead. (Reported only; no auto-fix since the desired
//      replacement color depends on context.)
//
// Two modes:
//   node scripts/check-font-sizes.mjs          -> report offenders, exit 1 if any
//   node scripts/check-font-sizes.mjs --fix    -> auto-bump sub-12px to 12px
//                                                 (the #3a3a3a combo is not
//                                                 auto-fixed)
//
// Why: tiny font sizes (9–11px) make the UI hard to read. This script is the
// backstop for the "12px minimum" convention documented in AGENTS.md.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const fix = process.argv.includes('--fix')
const root = process.cwd()
const skipDirs = new Set(['node_modules', '.next', '.git', 'scripts', '.claude'])

// Match:  fontSize: '10px'  fontSize: "11px"  fontSize:'9px'  (no template literals)
const RE = /fontSize:\s*(['"])([0-9]+)px\1/g

const offenders = []
const dimCombo = []

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

    // Dim-combo check — `fontSize: '12px'` + `color: '#3a3a3a'` on the same line.
    // Case-insensitive hex match so `#3A3A3A` also trips. Line-scoped so we
    // don't false-positive across separate style blocks in the same file.
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/fontSize:\s*['"]12px['"]/.test(line) && /color:\s*['"]#3a3a3a['"]/i.test(line)) {
        dimCombo.push({ file: full.replace(root + '\\', '').replace(/\\/g, '/'), line: i + 1, snippet: line.trim().slice(0, 140) })
      }
    }
  }
}

walk(root)

const totalProblems = offenders.length + dimCombo.length

if (totalProblems === 0) {
  console.log('[check-font-sizes] OK — no inline fontSize below 12px, no 12px+#3a3a3a dim combo.')
  process.exit(0)
}

if (fix && offenders.length > 0 && dimCombo.length === 0) {
  console.log(`[check-font-sizes] rewrote ${offenders.length} occurrence(s) to 12px.`)
  process.exit(0)
}

if (offenders.length > 0) {
  console.log(`[check-font-sizes] Found ${offenders.length} sub-12px fontSize occurrence(s):`)
  for (const o of offenders.slice(0, 40)) {
    console.log(`  ${o.file}:${o.line}  ${o.match}  -> should be 12px`)
  }
  if (offenders.length > 40) console.log(`  … and ${offenders.length - 40} more`)
  console.log('Run `node scripts/check-font-sizes.mjs --fix` to bump them all to 12px.')
}

if (dimCombo.length > 0) {
  console.log(`[check-font-sizes] Found ${dimCombo.length} banned 12px + #3a3a3a combo(s):`)
  for (const o of dimCombo.slice(0, 40)) {
    console.log(`  ${o.file}:${o.line}`)
    console.log(`    ${o.snippet}`)
  }
  if (dimCombo.length > 40) console.log(`  … and ${dimCombo.length - 40} more`)
  console.log('Bump those to `fontSize: \'13px\'` and `color: \'#cce0f5\'` (no auto-fix — replacement depends on context).')
}

process.exit(1)
