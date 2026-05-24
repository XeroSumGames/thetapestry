#!/usr/bin/env node
// Infra-as-code guardrail (Stage A1): supabase_realtime publication drift.
//
// A Supabase postgres_changes subscription delivers NOTHING for a table that
// is not in the supabase_realtime publication - no error, no warning, just a
// silently dead realtime surface. That config lived only in the dashboard and
// caused the 2026-05-24 publication gap (stockpile/pins/membership all dead).
//
// This script diffs the LIVE publication membership against the committed
// source of truth at sql/_baseline/publication.sql and fails on any drift:
//   - MISSING: a table in the baseline that is no longer live (someone dropped
//     it from the publication - a feature just went silently dead).
//   - EXTRA:   a table live but not in the baseline (someone added it without
//     updating the baseline - the version-controlled record is now stale).
//
// Needs the linked Supabase project + network (it runs `supabase db query
// --linked`), so it is an ON-DEMAND / pre-ship check, NOT a blind pre-commit
// or CI gate (yet - that needs a read-only DB secret; see
// tasks/stage-a-infra-as-code-scope.md Tier 3). If it cannot reach the DB it
// SKIPS loudly (exit 0) rather than blocking work offline.
//
//   node scripts/check-publication-drift.mjs        # compare + report
//   npm run check:publication
//
// Exit: 0 = match or skipped (could not verify); 1 = drift detected.

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const BASELINE_PATH = 'sql/_baseline/publication.sql'
const PUBLICATION = 'supabase_realtime'
const TAG = '[check-publication]'

function baselineTables() {
  const sql = readFileSync(BASELINE_PATH, 'utf8')
  const set = new Set()
  // Parse `ALTER PUBLICATION <pub> ADD TABLE <name>;` lines (ignore comments).
  const re = /^\s*ALTER\s+PUBLICATION\s+\w+\s+ADD\s+TABLE\s+([a-z0-9_]+)\s*;/gim
  let m
  while ((m = re.exec(sql)) !== null) set.add(m[1])
  return set
}

function liveTables() {
  // Write a temp query file, run it through the linked CLI, parse the JSON.
  const dir = mkdtempSync(join(tmpdir(), 'pubdrift-'))
  const qPath = join(dir, 'q.sql')
  writeFileSync(
    qPath,
    `select tablename from pg_publication_tables where pubname='${PUBLICATION}' order by 1;`,
  )
  let out
  try {
    out = execSync(`npx supabase db query --linked -f "${qPath}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    return { ok: false, reason: (e.stderr || e.message || 'CLI error').toString().trim().split('\n').pop() }
  }
  // The CLI prints a preamble ("Initialising login role...") then a JSON object.
  const start = out.indexOf('{')
  const end = out.lastIndexOf('}')
  if (start === -1 || end === -1) return { ok: false, reason: 'no JSON in CLI output' }
  let parsed
  try {
    parsed = JSON.parse(out.slice(start, end + 1))
  } catch {
    return { ok: false, reason: 'could not parse CLI JSON' }
  }
  const rows = Array.isArray(parsed.rows) ? parsed.rows : []
  return { ok: true, set: new Set(rows.map((r) => r.tablename)) }
}

const baseline = baselineTables()
if (baseline.size === 0) {
  console.error(`${TAG} FAIL - parsed 0 tables from ${BASELINE_PATH} (broken baseline).`)
  process.exit(1)
}

const live = liveTables()
if (!live.ok) {
  console.warn(`${TAG} SKIPPED - could not reach the linked DB (${live.reason}). Not verified.`)
  process.exit(0)
}

const missing = [...baseline].filter((t) => !live.set.has(t)).sort()
const extra = [...live.set].filter((t) => !baseline.has(t)).sort()

if (missing.length === 0 && extra.length === 0) {
  console.log(`${TAG} OK - live publication matches the baseline (${baseline.size} tables).`)
  process.exit(0)
}

console.error(`${TAG} DRIFT - live supabase_realtime publication does not match ${BASELINE_PATH}:`)
if (missing.length) {
  console.error(`  MISSING from live (baseline says published, but they are NOT - feature silently dead):`)
  for (const t of missing) console.error(`    - ${t}`)
  console.error(`  Re-add: ALTER PUBLICATION ${PUBLICATION} ADD TABLE <name>;`)
}
if (extra.length) {
  console.error(`  EXTRA in live (published, but NOT in the baseline - update the baseline file):`)
  for (const t of extra) console.error(`    + ${t}`)
  console.error(`  Add an "ALTER PUBLICATION ${PUBLICATION} ADD TABLE <name>;" line to ${BASELINE_PATH}.`)
}
process.exit(1)
