#!/usr/bin/env node
// Refreshes the Confidence Ledger TESTED line in tasks/debug-handoff.md Sec 3
// from current vitest output. Kills the recurring "test count is stale"
// health-pulse DRIFT entries at the root.
//
// Pattern documented in tasks/lessons.md "Stability-audit pattern + stale
// audit line numbers + Confidence-Ledger drift threshold."
//
// Usage:
//   node scripts/refresh-ledger.mjs            run tests, update ledger if drifted
//   node scripts/refresh-ledger.mjs --check    exit 1 if drift detected (CI mode)
//
// Updates: the single bullet starting "- **TESTED (automated):**" in
// tasks/debug-handoff.md. Replaces test count + file count + per-file
// breakdown + duration + last-refresh date.

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const HANDOFF = resolve('tasks/debug-handoff.md')
const CHECK_ONLY = process.argv.includes('--check')

function runTests() {
  try {
    return execSync('npm test --silent', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    })
  } catch (err) {
    console.error('[refresh-ledger] npm test failed:')
    console.error(err.stdout || err.stderr || err.message)
    process.exit(2)
  }
}

function parseCounts(out) {
  const filesMatch = out.match(/Test Files\s+(\d+) passed/)
  const testsMatch = out.match(/Tests\s+(\d+) passed/)
  const durationMatch = out.match(/Duration\s+(\d+)ms/)
  if (!filesMatch || !testsMatch) {
    console.error('[refresh-ledger] could not parse vitest summary. Raw output:')
    console.error(out)
    process.exit(2)
  }
  const perFile = []
  const fileRe = /✓\s+tests\/lib\/([^.]+)\.test\.ts\s+\((\d+)\s+tests?\)/g
  let m
  while ((m = fileRe.exec(out)) !== null) {
    perFile.push({ name: m[1], count: parseInt(m[2], 10) })
  }
  perFile.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return {
    files: parseInt(filesMatch[1], 10),
    tests: parseInt(testsMatch[1], 10),
    durationMs: durationMatch ? parseInt(durationMatch[1], 10) : null,
    perFile,
  }
}

function buildLine(c) {
  const today = new Date().toISOString().slice(0, 10)
  const detail = c.perFile.map(p => `${p.name} (${p.count})`).join(', ')
  const duration = c.durationMs ? `Suite runs in ~${c.durationMs}ms on every commit + every push to main. ` : ''
  return `- **TESTED (automated):** ${c.tests} unit tests across ${c.files} files in \`tests/lib/\` covering ${detail}. ${duration}(Auto-refreshed ${today} via \`scripts/refresh-ledger.mjs\`.)`
}

// Drift fingerprint: only the load-bearing fields. Duration + last-refresh
// date are rendered into the line for humans but excluded here so they
// don't fire false-positive drift on every invocation.
function fingerprint(line) {
  const tests = line.match(/\*\*TESTED \(automated\):\*\* (\d+) unit tests/)?.[1]
  const files = line.match(/across (\d+) files/)?.[1]
  // Per-file detail: capture the "name (count)" pairs in declared order.
  const detail = []
  const fileRe = /([a-z][a-z0-9_-]+)\s*\((\d+)\)/g
  let m
  while ((m = fileRe.exec(line)) !== null) detail.push(`${m[1]}=${m[2]}`)
  return JSON.stringify({ tests, files, detail })
}

function refresh(counts) {
  const md = readFileSync(HANDOFF, 'utf8')
  const pattern = /^- \*\*TESTED \(automated\):\*\*[^\n]*$/m
  const existing = md.match(pattern)?.[0]
  if (!existing) {
    console.error('[refresh-ledger] TESTED line not found in tasks/debug-handoff.md Sec 3')
    process.exit(2)
  }
  const fresh = buildLine(counts)
  if (fingerprint(existing) === fingerprint(fresh)) {
    return { changed: false, counts }
  }
  if (CHECK_ONLY) {
    console.error('[refresh-ledger] DRIFT: TESTED fingerprint changed.')
    console.error('  current fingerprint:', fingerprint(existing))
    console.error('  fresh fingerprint:  ', fingerprint(fresh))
    console.error('  fix: node scripts/refresh-ledger.mjs')
    process.exit(1)
  }
  writeFileSync(HANDOFF, md.replace(pattern, fresh))
  return { changed: true, counts }
}

const out = runTests()
const counts = parseCounts(out)
const result = refresh(counts)
if (result.changed) {
  console.log(`[refresh-ledger] updated: ${counts.tests} tests across ${counts.files} files${counts.durationMs ? ` (${counts.durationMs}ms)` : ''}.`)
} else {
  console.log(`[refresh-ledger] no change: ${counts.tests} tests across ${counts.files} files already current.`)
}
