#!/usr/bin/env node
// Pre-commit guardrail: enforce that any change to roll-feed
// narrative source code (lib/roll-helpers.ts or components/RollsFeed.tsx)
// is accompanied by a matching update to tasks/roll-feed-log-preview.html.
//
// Why: the preview file is the canonical visual reference for compact
// narratives. It drifts from reality if we change a narrative string
// without updating the preview. Memory rule `feedback_preview_sync` +
// lessons.md rule "Always update roll-feed-log-preview.html when
// amending log messages (2026-05-19)" both already mandated this; the
// rule was ignored 5+ times in a single session on 2026-05-19, so we
// promoted it to a mechanical pre-commit check.
//
// Failure mode: if you've touched a SOURCE file but NOT the preview,
// this script exits 1 and the commit is blocked.
//
// Override: if your edit is a pure refactor / type-change / comment
// fix with NO narrative-string changes, you can pass the commit
// through with `git commit --no-verify`. Don't bypass for actual
// narrative changes - the audit will catch it later, just less kindly.
//
// Bypass guidance is shown in the failure message.

import { execSync } from 'node:child_process'

const SOURCE_FILES = [
  'lib/roll-helpers.ts',
  'components/RollsFeed.tsx',
]
const PREVIEW_FILE = 'tasks/roll-feed-log-preview.html'

// Get staged files (the commit's diff-against-HEAD). --cached =
// what's actually about to be committed, not just modified in
// the working tree.
let staged
try {
  staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
} catch (err) {
  console.error('[check-preview-sync] git diff failed:', err.message)
  process.exit(2)
}

// Normalize separators (Git emits forward slashes on every OS).
const stagedSet = new Set(staged.map(f => f.replace(/\\/g, '/')))
const touchedSource = SOURCE_FILES.filter(f => stagedSet.has(f))
const touchedPreview = stagedSet.has(PREVIEW_FILE)

if (touchedSource.length === 0) {
  // No log-narrative source touched; nothing to gate.
  process.exit(0)
}

if (touchedPreview) {
  // Source touched + preview touched. Allow.
  console.log(`[check-preview-sync] OK - ${touchedSource.join(' + ')} + ${PREVIEW_FILE} both staged.`)
  process.exit(0)
}

// Source touched but preview NOT touched. Block.
console.error('')
console.error('[check-preview-sync] BLOCKED')
console.error('')
console.error(`  Staged change to: ${touchedSource.join(', ')}`)
console.error(`  But MISSING:      ${PREVIEW_FILE}`)
console.error('')
console.error('  These files render compact-narrative log rows. Whenever you')
console.error('  change one of those narratives, the preview file MUST be')
console.error('  updated in the same commit to stay in sync as the canonical')
console.error('  visual reference. (Memory rule: feedback_preview_sync.')
console.error('  Lessons rule: "Always update roll-feed-log-preview.html when')
console.error('  amending log messages", 2026-05-19.)')
console.error('')
console.error('  How to fix (pick ONE):')
console.error('')
console.error(`  1) Update ${PREVIEW_FILE} to reflect the narrative change,`)
console.error('     then stage it and re-commit.')
console.error('')
console.error('  2) If this is a TRUE refactor (no narrative string change,')
console.error('     e.g., type tweak, comment fix, helper extraction),')
console.error('     bypass with:  git commit --no-verify')
console.error('     Use sparingly. Most "tiny" tweaks DO change narrative.')
console.error('')
process.exit(1)
