#!/usr/bin/env node
// Infra-as-code guardrail: em-dash / en-dash in LIVE database object bodies.
//
// The no-em-dash rule (memory: feedback_no_en_dash) must hold for everything
// that reaches users - including text emitted by DB functions/triggers (e.g.
// the community-growth notification "has grown to N members ... it's officially
// a Community now"). That text lives in pg_proc bodies, NOT in app code, so the
// pre-commit check-em-dashes.mjs cannot see it: that script scans staged repo
// files, and the only repo reflection (sql/_baseline/schema.sql) is
// intentionally EXEMPT as a faithful mirror of live. So a forbidden dash could
// (and did, 2026-05-24) sit in a live function body undetected.
//
// This check closes that gap by querying the LIVE database directly for an
// em-dash (U+2014) or en-dash (U+2013) in function/trigger and view
// definitions.
//
// Needs the linked Supabase project + network (runs `supabase db query
// --linked`), so it is an ON-DEMAND / pre-ship check, NOT a blind pre-commit
// or CI gate (same posture as check-publication-drift.mjs). If it cannot reach
// the DB it SKIPS loudly (exit 0) rather than blocking work offline.
//
//   node scripts/check-db-emdashes.mjs
//   npm run check:db-emdashes
//
// Exit: 0 = clean or skipped (could not verify); 1 = offenders found.

import { writeFileSync, mkdtempSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const TAG = '[check-db-emdashes]'
// JS-side detectors built from char codes so THIS file stays free of the
// literal characters it forbids (otherwise the pre-commit em-dash gate would
// flag it). 8212 = em-dash, 8211 = en-dash.
const EM = String.fromCharCode(8212)
const EN = String.fromCharCode(8211)

function liveOffenders() {
  const dir = mkdtempSync(join(tmpdir(), 'dbemdash-'))
  const qPath = join(dir, 'q.sql')
  // chr(8212) = em-dash, chr(8211) = en-dash. Built via chr() so the query
  // file (and this script) never contains the literal forbidden characters.
  const cls = "('[' || chr(8212) || chr(8211) || ']')"
  // prokind in ('f','p') = normal functions + procedures only. pg_get_functiondef
  // ERRORS on aggregate ('a') / window ('w') functions, so they must be excluded
  // BEFORE it is called - a MATERIALIZED CTE pins that order (no planner inlining).
  writeFileSync(
    qPath,
    `with fns as materialized (
       select p.proname as name, pg_get_functiondef(p.oid) as body
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind in ('f', 'p')
     )
     select 'function' as kind, name, body from fns where body ~ ${cls}
     union all
     select 'view' as kind, c.relname as name, pg_get_viewdef(c.oid) as body
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('v', 'm') and pg_get_viewdef(c.oid) ~ ${cls}
     order by 1, 2;`,
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
  return { ok: true, rows }
}

const res = liveOffenders()
if (!res.ok) {
  console.warn(`${TAG} SKIPPED - could not reach the linked DB (${res.reason}). Not verified.`)
  process.exit(0)
}

if (res.rows.length === 0) {
  console.log(`${TAG} OK - no em-dash / en-dash in live function or view bodies.`)
  process.exit(0)
}

console.error(`${TAG} BLOCKED - em-dash / en-dash found in LIVE database object bodies:`)
console.error('')
for (const r of res.rows) {
  const offending = (r.body || '').split('\n').filter((l) => l.includes(EM) || l.includes(EN))
  console.error(`  ${r.kind} public.${r.name}`)
  for (const l of offending) console.error(`      ${l.trim().slice(0, 120)}`)
}
console.error('')
console.error('  These reach users / logs with a forbidden character. Fix via a')
console.error('  CREATE OR REPLACE that swaps the dash for an ASCII hyphen (copy the')
console.error('  exact live body from pg_get_functiondef), apply with')
console.error('  `npx supabase db query --linked -f sql/<fix>.sql`, then re-run this.')
console.error('  Reference: sql/fix-db-function-emdashes-2026-05-24.sql.')
process.exit(1)
