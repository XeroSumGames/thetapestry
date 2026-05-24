#!/usr/bin/env node
// Pre-commit guardrail: enforce project rule "No em-dash / en-dash
// anywhere in code, in chat, in docs." Per feedback_no_en_dash memory
// + lessons.md ("Compact log narratives never show mechanical bits"
// + the recurring em-dash sweeps).
//
// Why: em-dashes break label parsers (compactRollSummary's suffix
// strip handles ASCII hyphen primarily; the em-dash tolerance was
// added as defensive backstop, not as a license to keep introducing
// them). They also cause copy/paste mismatches when content moves
// between docs, code, and user-facing surfaces.
//
// Scope: scan staged .ts / .tsx / .js / .mjs / .sql / .md files for
// em-dash (U+2014) or en-dash (U+2013) characters. Comment lines are
// allowed (`//` or `/* */`) to avoid breaking legacy authoring notes.
// HTML preview files in tasks/ are allowed (they're documentation
// snapshots, not source).
//
// Exclusions (intentional carve-outs):
// - lib/roll-helpers.ts suffix-strip detector (line that contains
//   `namePrefix + '— '`): the strip handles legacy DB rows whose
//   labels were saved with em-dash separators. Removing the detector
//   would break parse on those rows.
// - tests/lib/roll-helpers.test.ts assertions for the strip path:
//   they test the legacy-em-dash handling explicitly. The pattern
//   `'Enya — ACU Check'` is intentionally em-dash and must stay.
//
// Override: `git commit --no-verify` for true edge cases (e.g.,
// quoting external content verbatim). Don't bypass for new authored
// content - sweep the em-dash out first.

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const EM_DASH = '—'
const EN_DASH = '–'
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.sql', '.md']

// Files/patterns intentionally exempt from the rule.
const EXEMPT_PATHS = [
  'tasks/roll-feed-log-preview.html',         // doc snapshot, can keep em-dashes if needed
  'scripts/check-em-dashes.mjs',              // this file (defines the patterns)
  'tasks/lessons.md',                          // historical notes referencing past em-dash bugs
  'tasks/handoff',                             // session handoff prose; archival
  'tasks/handoff-',                            // dated handoff variants
  'sql/_baseline/',                            // GENERATED schema mirror of live; must reflect live verbatim (live function bodies contain em-dashes - see the live-em-dash finding in todo). Authoring rule does not apply to a faithful capture.
]

// Substring patterns inside scanned files that are intentional em-dash
// uses. Lines matching any of these pass the check even when they
// contain the forbidden character.
const EXEMPT_LINE_PATTERNS = [
  /namePrefix\s*\+\s*['"]— /,                  // legacy em-dash strip detector
  /Enya — ACU Check/,                          // unit test for the strip path
  /<name> — <label>/,                          // comment describing the legacy shape
  /<name> ['"]?—['"]? <label>/,
]

let staged
try {
  staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
} catch (err) {
  console.error('[check-em-dashes] git diff failed:', err.message)
  process.exit(2)
}

const offenders = []

for (const file of staged) {
  const norm = file.replace(/\\/g, '/')
  if (!SCAN_EXTENSIONS.some(ext => norm.endsWith(ext))) continue
  if (EXEMPT_PATHS.some(p => norm.includes(p))) continue

  let content
  try {
    content = readFileSync(norm, 'utf8')
  } catch {
    // Deleted file; skip.
    continue
  }

  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.includes(EM_DASH) && !line.includes(EN_DASH)) continue

    // Skip comment-only lines and lines whose em-dash is INSIDE a
    // comment (JSX `{/* ... */}`, JS `//`, block `*`, HTML `<!-- -->`).
    // Heuristic: find the em-dash position, walk back, check if any
    // open-comment marker appears between line start and em-dash with
    // no matching close marker. Imperfect but handles 95% of cases
    // without false positives.
    const trimmed = line.trim()
    if (trimmed.startsWith('//')) continue
    if (trimmed.startsWith('*')) continue
    if (trimmed.startsWith('<!--')) continue
    if (trimmed.startsWith('{/*')) continue          // JSX comment open
    // Multi-line JSX comments: lines that contain neither `{/*` nor
    // `*/}` but are inside a comment block. We don't track block state
    // (too complex for a single-pass scan); rely on the leading-`*`
    // convention many of these use.
    // Same-line JSX comment containing em-dash: `{/* ... — ... */}`
    if (trimmed.includes('{/*') && trimmed.includes('*/}')) {
      const cs = trimmed.indexOf('{/*')
      const ce = trimmed.lastIndexOf('*/}')
      const em = Math.max(trimmed.indexOf(EM_DASH), trimmed.indexOf(EN_DASH))
      if (em > cs && em < ce + 2) continue
    }
    // Trailing-line-comment containing em-dash: `code; // ... — ...`
    const lcIdx = line.indexOf('//')
    if (lcIdx >= 0) {
      const em = Math.max(line.indexOf(EM_DASH), line.indexOf(EN_DASH))
      if (em > lcIdx) continue
    }

    // Skip exempt line patterns.
    if (EXEMPT_LINE_PATTERNS.some(p => p.test(line))) continue

    offenders.push({ file: norm, line: i + 1, content: line.trim() })
  }
}

if (offenders.length === 0) {
  process.exit(0)
}

console.error('')
console.error('[check-em-dashes] BLOCKED')
console.error('')
console.error(`  Found ${offenders.length} em-dash / en-dash occurrence(s) in staged files.`)
console.error('  Project rule (memory: feedback_no_en_dash): "No em-dash / en-dash')
console.error('  anywhere - always plain ASCII hyphen, in chat AND code AND docs."')
console.error('')
for (const o of offenders) {
  console.error(`    ${o.file}:${o.line}`)
  console.error(`      ${o.content.length > 100 ? o.content.slice(0, 97) + '...' : o.content}`)
}
console.error('')
console.error('  How to fix:')
console.error('    Replace each — (U+2014) or – (U+2013) with - (ASCII hyphen).')
console.error('    Re-stage and re-commit.')
console.error('')
console.error('    If the occurrence is INTENTIONAL (e.g., a comment describing the')
console.error('    legacy em-dash strip path, or a test asserting that path), add the')
console.error('    pattern to EXEMPT_LINE_PATTERNS at the top of this script.')
console.error('')
console.error('    Emergency bypass: git commit --no-verify')
console.error('')
process.exit(1)
