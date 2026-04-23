#!/usr/bin/env node
// Enforce UI readability rules across .ts/.tsx source:
//   1) Inline `fontSize` must be >= 13px (9–12px get flagged / auto-bumped).
//   2) The combo `fontSize: '13px'` + `color: '#3a3a3a'` on the same line is
//      banned — that pair is illegible on dark backgrounds. Bump color to
//      `#cce0f5` instead. (Reported only; no auto-fix since the desired
//      replacement color depends on context.)
//
// Two modes:
//   node scripts/check-font-sizes.mjs          -> report offenders, exit 1 if any
//   node scripts/check-font-sizes.mjs --fix    -> auto-bump sub-13px to 13px
//                                                 (the dim-combo is not
//                                                 auto-fixed)
//
// Why: tiny font sizes (9–12px) make the UI hard to read. Minimum raised
// from 12 → 13 on 2026-04-23. This script is the backstop for the "13px
// minimum" convention documented in AGENTS.md.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const fix = process.argv.includes('--fix')
const root = process.cwd()
const skipDirs = new Set(['node_modules', '.next', '.git', 'scripts', '.claude'])

// Match:  fontSize: '10px'  fontSize: "11px"  fontSize:'9px'  (no template literals)
const RE = /fontSize:\s*(['"])([0-9]+)px\1/g

const MIN_PX = 13

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
    let next = src
    const lines = src.split('\n')
    for (const m of src.matchAll(RE)) {
      const n = parseInt(m[2], 10)
      if (n >= MIN_PX) continue
      // Locate line number for readable reporting.
      const idx = m.index ?? 0
      const line = src.slice(0, idx).split('\n').length
      offenders.push({ file: full.replace(root + '\\', '').replace(/\\/g, '/'), line, match: m[0], size: n })
    }
    if (fix) {
      next = src.replace(RE, (full, q, num) => parseInt(num, 10) < MIN_PX ? `fontSize: ${q}${MIN_PX}px${q}` : full)
      if (next !== src) writeFileSync(full, next, 'utf8')
    }

    // Dim-combo check — min-size + `color: '#3a3a3a'` on the same line.
    // Case-insensitive hex match so `#3A3A3A` also trips. Line-scoped so we
    // don't false-positive across separate style blocks in the same file.
    const dimSizeRe = new RegExp(`fontSize:\\s*['"]${MIN_PX}px['"]`)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (dimSizeRe.test(line) && /color:\s*['"]#3a3a3a['"]/i.test(line)) {
        dimCombo.push({ file: full.replace(root + '\\', '').replace(/\\/g, '/'), line: i + 1, snippet: line.trim().slice(0, 140) })
      }
    }
  }
}

walk(root)

const totalProblems = offenders.length + dimCombo.length

if (totalProblems === 0) {
  console.log(`[check-font-sizes] OK — no inline fontSize below ${MIN_PX}px, no ${MIN_PX}px+#3a3a3a dim combo.`)
  process.exit(0)
}

if (fix && offenders.length > 0 && dimCombo.length === 0) {
  console.log(`[check-font-sizes] rewrote ${offenders.length} occurrence(s) to ${MIN_PX}px.`)
  process.exit(0)
}

if (offenders.length > 0) {
  console.log(`[check-font-sizes] Found ${offenders.length} sub-${MIN_PX}px fontSize occurrence(s):`)
  for (const o of offenders.slice(0, 40)) {
    console.log(`  ${o.file}:${o.line}  ${o.match}  -> should be ${MIN_PX}px`)
  }
  if (offenders.length > 40) console.log(`  … and ${offenders.length - 40} more`)
  console.log(`Run \`node scripts/check-font-sizes.mjs --fix\` to bump them all to ${MIN_PX}px.`)
}

if (dimCombo.length > 0) {
  console.log(`[check-font-sizes] Found ${dimCombo.length} banned ${MIN_PX}px + #3a3a3a combo(s):`)
  for (const o of dimCombo.slice(0, 40)) {
    console.log(`  ${o.file}:${o.line}`)
    console.log(`    ${o.snippet}`)
  }
  if (dimCombo.length > 40) console.log(`  … and ${dimCombo.length - 40} more`)
  console.log(`Change color to \`'#cce0f5'\` (no auto-fix — replacement depends on context).`)
}

process.exit(1)
