#!/usr/bin/env node
// Guardrail: the tab device may only be rendered by components/Frame.tsx.
//
// WHY THIS EXISTS. The /v2 pins rail shipped three bare <button> elements with
// no role="tab" and no aria-selected. A screen reader saw three unlabelled
// buttons and could not report which was active. Every geometry assertion we
// had passed on it - the buttons measured a plausible 29px - so only reading
// the markup found it, and only a signed-in session could reach it at all.
//
// The cause was NOT a missing component. components/Frame.tsx has exported a
// correct role="tablist" / role="tab" / aria-selected strip the whole time, and
// app/v2/frame.css carries both a --railtab-h token and a `.pinsrailtabs
// .railtabs` rule written for that very panel. The panel hand-rolled buttons
// anyway, because a SECOND rendering path survived and was there first.
//
// The TheTable hub's rule, from auditing the Mothership reference: having the
// component prevents drift only when it is the ONLY way to render the device.
// Mothership is correct everywhere not through care but because nothing else
// can render a strip. This script is what makes that true here too, so the
// guarantee is structural rather than a fact about today's grep.
//
// TWO CHECKS, in both directions:
//   1. NEGATIVE - no file outside components/Frame.tsx renders the device:
//      role="tablist", role="tab", or the .railtab / .railtabs classes.
//   2. POSITIVE - what Frame.tsx renders actually carries the semantics:
//      role="tablist", role="tab" and aria-selected. A negative check alone
//      would pass happily on a Frame.tsx that had been stripped of them.
//
// COMMENTS ARE STRIPPED BEFORE MATCHING. PinsPanel.tsx carries a comment
// explaining this very defect, and a raw-text scan flags its own postmortem.
// We have been bitten by exactly this before - see AGENTS.md on the seam
// counter scanning raw text including comments.
//
// Allow-list: any line containing the token `tab-device-allow`.
//
// KNOWN DUPLICATE, deliberate and DATED. PinsPanel.tsx renders a second,
// hand-rolled strip on its !inRail branch for the OLD /map and /dashboard.
// That one is frozen on purpose: the onboarding tour targets those elements by
// selector, so adopting the house markup would break the tour silently, with no
// error, for a brand new user at first contact. It uses inline styles and no
// tab roles, so it does not trip check 1. It is owed a deletion when the old
// pages retire - tracked in tasks/plan-one-frame-new-pages-2026-09-15.md under
// "the gate-on-inRail pattern and the duplicates it owes". Do not adopt the
// house markup there before the tour moves to the new selectors.

import { readFileSync, existsSync, globSync } from 'node:fs'

const OWNER = 'components/Frame.tsx'
const ALLOW = 'tab-device-allow'

// The device: tab semantics, and the rail-tab classes that carry its geometry.
const DEVICE = [
  { re: /role=["']tablist["']/, what: 'role="tablist"' },
  { re: /role=["']tab["']/, what: 'role="tab"' },
  { re: /className=[^\n]*\brailtabs?\b/, what: '.railtab / .railtabs class' },
]

// Strip comments so a file explaining the defect is not reported as the defect.
// Replace each stripped span with its own newlines so line numbers stay true.
const blanks = (m) => '\n'.repeat((m.match(/\n/g) || []).length)

function stripComments(src) {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, blanks) // JSX block comments
    .replace(/\/\*[\s\S]*?\*\//g, blanks)           // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')           // line comments, sparing http://
}

const files = globSync('{components,app,lib}/**/*.tsx')
  .map((f) => f.split('\\').join('/'))
  .sort()

const offenders = []
for (const f of files) {
  if (f === OWNER) continue
  const lines = stripComments(readFileSync(f, 'utf8')).split('\n')
  lines.forEach((line, i) => {
    if (line.includes(ALLOW)) return
    for (const d of DEVICE) {
      if (d.re.test(line)) {
        offenders.push({ f, n: i + 1, what: d.what, line: line.trim().slice(0, 100) })
      }
    }
  })
}

// Check 2: the owner must still carry the semantics it is the sole source of.
//
// The owner may legitimately not exist on this branch. components/Frame.tsx
// arrived with the /v2 work, so any branch from before it - including
// origin/main while that work is unpushed - has no tab device at all. There the
// NEGATIVE check still means something (nothing may render a strip) and the
// positive one has nothing to read. Crashing there would break commits on every
// pre-frame branch, which is the same rollout hazard as the missing script, one
// layer down: a guard has to be correct on every branch it can run from, not
// just the one it was written on.
let missing = []
if (existsSync(OWNER)) {
  const owner = readFileSync(OWNER, 'utf8')
  missing = [
    ['role="tablist"', /role=["']tablist["']/],
    ['role="tab"', /role=["']tab["']/],
    ['aria-selected', /aria-selected/],
  ]
    .filter(([, re]) => !re.test(owner))
    .map(([what]) => what)
} else {
  console.log(`[check-tab-device] ${OWNER} is not on this branch - no tab device here yet, so only the negative check applies.`)
}

let bad = false

if (offenders.length) {
  bad = true
  console.error(`[check-tab-device] ${offenders.length} line(s) render the tab device outside ${OWNER}:\n`)
  for (const o of offenders) console.error(`  ${o.f}:${o.n}  ${o.what}\n    ${o.line}`)
  console.error(`\nUse the exported RailTabs (or the nav strip) from ${OWNER} rather than hand-rolling a strip.`)
  console.error(`A hand-rolled strip can measure correctly and still be unreadable to a screen reader,`)
  console.error(`which is exactly how the /v2 pins rail shipped three unlabelled buttons.`)
  console.error(`If a second path is genuinely required (a frozen old surface), add ${ALLOW} to the line`)
  console.error(`AND record its deletion condition in the plan doc - an undated duplicate becomes permanent.`)
}

if (missing.length) {
  bad = true
  console.error(`\n[check-tab-device] ${OWNER} is missing: ${missing.join(', ')}`)
  console.error(`It is the ONLY place the tab device is allowed, so if it loses the semantics,`)
  console.error(`every strip in the app loses them at once and no geometry check will notice.`)
}

if (bad) process.exit(1)
// Say only what was actually checked. With no owner on this branch the positive
// half did not run, and claiming it passed would be the same false-verification
// we keep catching in each other.
console.log(
  existsSync(OWNER)
    ? `[check-tab-device] OK - the tab device is rendered only by ${OWNER}, and carries tablist/tab/aria-selected. Scanned ${files.length} files.`
    : `[check-tab-device] OK - nothing renders the tab device on this branch (${OWNER} absent, so the semantics check did not run). Scanned ${files.length} files.`,
)
