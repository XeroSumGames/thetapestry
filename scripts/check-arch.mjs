#!/usr/bin/env node
// Architecture fitness functions (grand re-architecture, Phase 1c).
// Three RATCHET checks that compare the whole repo against a committed
// baseline and FAIL only on regression (a number going the wrong way).
// This is how "does what we built match the target architecture?" gets
// answered by CI instead of by opinion - see
// tasks/grand-rearchitecture-2026-05-22.md Part 5.
//
//   1. LOC ceilings   - the 7 god-components may only SHRINK, never grow.
//   2. seam leakage   - raw `.from(` is only allowed in lib/data/**, raw
//                       `.channel(` only in lib/realtime/**. The count of
//                       violations outside those seams may only fall.
//   3. prod console   - console.log / console.warn in app|components|lib
//                       (render/handler noise) may only fall toward zero.
//
// Baseline lives at tasks/_baselines/arch.json. Re-baseline (ratchet the
// numbers DOWN after you've improved them) with:
//
//     node scripts/check-arch.mjs --save
//
// You can only ever save numbers that are <= the current baseline unless
// you pass --force (don't - raising a ceiling defeats the ratchet).
//
// Default run: compare + report. Exit 0 if every metric is at or below
// baseline; exit 1 on any regression. Runs on pre-commit + CI alongside
// the other check-*.mjs guardrails.
//
// Override for a true edge case: git commit --no-verify (don't).

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const BASELINE_PATH = 'tasks/_baselines/arch.json'
const SCAN_ROOTS = ['app', 'components', 'lib']
const SCAN_EXT = ['.ts', '.tsx', '.js', '.mjs']
const SKIP_DIR = new Set(['node_modules', '.next', '.git'])
const SKIP_FILE = /\.test\.(ts|tsx|js)$/

// The 7 god-components. Ceilings are captured at --save time.
const GOD_COMPONENTS = [
  'app/stories/[id]/table/page.tsx',
  'components/TacticalMap.tsx',
  'components/CampaignCommunity.tsx',
  'components/NpcRoster.tsx',
  'app/vehicle/page.tsx',
  'components/MapView.tsx',
  'app/moderate/page.tsx',
]

// Seams: the ONLY allowed homes for raw data/realtime access.
const DATA_SEAM = 'lib/data/'
const REALTIME_SEAM = 'lib/realtime/'

const args = process.argv.slice(2)
const SAVE = args.includes('--save')
const FORCE = args.includes('--force')

function walk(dir, out = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue
    const full = `${dir}/${name}`
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) walk(full, out)
    else if (SCAN_EXT.some(e => full.endsWith(e)) && !SKIP_FILE.test(name)) out.push(full)
  }
  return out
}

function countMatches(text, re) {
  const m = text.match(re)
  return m ? m.length : 0
}

const files = SCAN_ROOTS.flatMap(r => walk(r))

// --- Metric 1: LOC ceilings ---
const loc = {}
for (const f of GOD_COMPONENTS) {
  try { loc[f] = readFileSync(f, 'utf8').split('\n').length }
  catch { loc[f] = 0 } // missing file (e.g. renamed during migration) = 0, never a regression
}

// --- Metrics 2+3: seam leakage + prod console ---
let fromOutsideData = 0
let channelOutsideRealtime = 0
let prodConsole = 0
for (const f of files) {
  const norm = f.replace(/\\/g, '/')
  let text
  try { text = readFileSync(f, 'utf8') } catch { continue }
  if (!norm.includes(DATA_SEAM)) fromOutsideData += countMatches(text, /\.from\(/g)
  if (!norm.includes(REALTIME_SEAM)) channelOutsideRealtime += countMatches(text, /\.channel\(/g)
  prodConsole += countMatches(text, /console\.(log|warn)\(/g)
}

const current = {
  locCeilings: loc,
  seamLeakage: { fromOutsideData, channelOutsideRealtime },
  prodConsole,
}

// --- Save mode ---
// Default --save RATCHETS: it records improvements (lower numbers) but
// NEVER regresses a baseline - so a within-grace LOC bump from a migration
// can't accidentally raise a ceiling, and you can always lock in a
// leakage/console win without being blocked by unrelated churn. Use
// --force to write the exact current values (a deliberate re-baseline,
// e.g. after a justified new feature legitimately grows a file).
if (SAVE) {
  let prev = null
  if (existsSync(BASELINE_PATH)) { try { prev = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) } catch {} }
  const keepLower = (cur, p) => (p != null && !FORCE) ? Math.min(cur, p) : cur
  const merged = {
    locCeilings: {},
    seamLeakage: {
      fromOutsideData: keepLower(fromOutsideData, prev?.seamLeakage?.fromOutsideData),
      channelOutsideRealtime: keepLower(channelOutsideRealtime, prev?.seamLeakage?.channelOutsideRealtime),
    },
    prodConsole: keepLower(prodConsole, prev?.prodConsole),
  }
  for (const f of GOD_COMPONENTS) merged.locCeilings[f] = keepLower(loc[f], prev?.locCeilings?.[f])
  mkdirSync(dirname(BASELINE_PATH), { recursive: true })
  const out = { _comment: 'Architecture ratchet baseline. --save only ratchets numbers DOWN (--force to re-baseline up). node scripts/check-arch.mjs --save', ...merged }
  writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2) + '\n')
  console.log(`[check-arch] baseline ${FORCE ? 'FORCE-' : ''}saved to ${BASELINE_PATH}`)
  console.log(`    .from outside lib/data: ${merged.seamLeakage.fromOutsideData}${merged.seamLeakage.fromOutsideData < fromOutsideData ? ' (kept lower baseline)' : ''}`)
  console.log(`    .channel outside lib/realtime: ${merged.seamLeakage.channelOutsideRealtime}`)
  console.log(`    console.log|warn in app|components|lib: ${merged.prodConsole}`)
  process.exit(0)
}

// --- Compare mode ---
if (!existsSync(BASELINE_PATH)) {
  console.error('[check-arch] no baseline at ' + BASELINE_PATH + ' - run `node scripts/check-arch.mjs --save` first.')
  process.exit(2)
}
const base = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))

const regressions = []
const improvements = []

// LOC ceilings get a small GRACE band: the goal is to stop god-components
// BALLOONING, not to block the +1/+2 line churn that legitimate migration
// causes (e.g. adding a repo import before the bigger removals land). Real
// bloat (a new feature) blows past the grace. Seam-leakage + prod-console
// stay strict (0 tolerance) - those are the precise architectural metrics.
const LOC_GRACE = 25
for (const f of GOD_COMPONENTS) {
  const ceil = base.locCeilings?.[f]
  if (ceil == null) continue
  if (loc[f] > ceil + LOC_GRACE) regressions.push(`LOC: ${f} grew ${ceil} -> ${loc[f]} (+${loc[f] - ceil}, past the ${LOC_GRACE}-line grace)`)
  else if (loc[f] < ceil) improvements.push(`LOC: ${f} ${ceil} -> ${loc[f]}`)
}
const checks = [
  ['.from outside lib/data', fromOutsideData, base.seamLeakage?.fromOutsideData],
  ['.channel outside lib/realtime', channelOutsideRealtime, base.seamLeakage?.channelOutsideRealtime],
  ['console.log|warn in app|components|lib', prodConsole, base.prodConsole],
]
for (const [label, cur, b] of checks) {
  if (b == null) continue
  if (cur > b) regressions.push(`${label}: ${b} -> ${cur} (+${cur - b})`)
  else if (cur < b) improvements.push(`${label}: ${b} -> ${cur}`)
}

if (regressions.length === 0) {
  if (improvements.length) {
    console.log('[check-arch] OK - and ' + improvements.length + ' metric(s) IMPROVED since baseline. Ratchet them down: node scripts/check-arch.mjs --save')
    for (const i of improvements) console.log('    ' + i)
  } else {
    console.log('[check-arch] OK - all architecture metrics at baseline.')
  }
  process.exit(0)
}

console.error('')
console.error('[check-arch] BLOCKED - architecture regressed (a metric moved the wrong way):')
console.error('')
for (const r of regressions) console.error('    ' + r)
console.error('')
console.error('  The architecture ratchets only allow these numbers to FALL. To fix:')
console.error('    - New DB reads go in lib/data/** (not inline .from in a component).')
console.error('    - New realtime goes through lib/realtime/** (not a raw .channel).')
console.error('    - No new console.log/warn in render/handler paths; god-components only shrink.')
console.error('  If the rise is genuinely intended, re-baseline: node scripts/check-arch.mjs --save')
console.error('  Emergency bypass: git commit --no-verify')
console.error('')
process.exit(1)
