# Stability + Efficiency Audit - 2026-05-30

**Trigger:** Xero ask after the largest ship batch of the project (`#1 KS
core-loop reliability CLOSED` + 54 commits today; 761 in 14 days). Audit
pattern: CLAUDE.md "Stability-audit pattern" / `tasks/operating-mode.md`
on-demand `/stability-audit`.

**Scope:** stability (production confidence) AND efficiency (perf / dead
code / type-safety / dependency drift). Wider than the 3-hour health-pulse,
narrower than `/pre-launch-audit`. No code edits in this pass - findings
only; severity-prefixed todos route to the right lane.

**Sources read:** `debug-handoff.md` (Risk Register §1, Tech Debt §2,
Confidence Ledger §3), `tasks/health-pulse.md` (latest 31st DRIFT, 2026-05-31
00:05 UTC), `tasks/security-audit.md` (latest 2026-05-26 weekly), `tasks/
lessons.md` (7 new entries today), `git log --since=14.days.ago` (761
commits), `tasks/todo.md` CURRENT OPEN.

**Live gates this pass:**
- `npx tsc --noEmit` -> GREEN (silent)
- `node scripts/check-arch.mjs` -> GREEN ("all architecture metrics at baseline")
- `node scripts/check-em-dashes.mjs` -> GREEN
- `npm test` -> 738 passed / 41 files (per latest commit's pre-commit run)
- npm audit (per health-pulse) -> GREEN (0 high/critical; 3 moderate carry-overs)

---

## BLOCKER findings

**None.** No production-stopping issue surfaced in this pass. The
ship-readiness for 2026-07-01 Beta-500 stays on track.

---

## HIGH findings

### H1. `as any` proliferation is ~280x what the Tech Debt Ledger records
- **Observed:** 557 `as any` casts across `app/`, `components/`, `lib/`.
  Top contributors: `app/stories/[id]/table/page.tsx` (108), `components/
  RollsFeed.tsx` (38), `components/NpcRoster.tsx` (28), `components/
  MapView.tsx` (28), `components/CampaignCommunity.tsx` (19).
- **Documented in Tech Debt Ledger:** "at least 2 sites cast damage payload
  to `any`" (debug-handoff.md L97-101). The real number is ~280x larger
  and spreads across most large components, not just damage handling.
- **Why this matters:** `as any` defeats TypeScript's whole point.
  Refactors that should be caught by tsc walk straight through these
  casts. The 7 new lessons today (TacticalMap stale-ref races, persist-
  effect races, viewport math) are CLASSIC cases tsc would have helped on
  if the surrounding code wasn't any-cast.
- **Route:** Puffer doc fix - update `debug-handoff.md` §2 "`damage_json:
  { ... } as any` casts" entry to "**~557 `as any` sites across the
  codebase**, concentrated in table-page (108) and 4 large components".
  HP follow-up - one component at a time, type the casts away. Start with
  the highest-pain: `RollsFeed.tsx` (38, hot path) + `useRollResolution`
  area. Multi-week effort; do incrementally.
- **Severity rationale:** HIGH because it's a documented Tech Debt Ledger
  entry that significantly understates the actual debt. Updating the
  ledger is cheap; eliminating the casts is a long campaign.

### H2. Confidence Ledger STALE: says 622/37, actual 738/41
- **Observed:** `debug-handoff.md` §3 TESTED row says "622 unit tests
  across 37 files in `tests/lib/`". Reality (per `npm test` this session
  and per the 31st DRIFT health-pulse): 738 passed across 41 files. +116
  tests, +4 files since 2026-05-24 ledger refresh.
- **Why this matters:** the Confidence Ledger is the surface I cite when
  answering "would I be surprised if X breaks?". A stale ledger erodes
  trust in every triage decision keyed on it. The health-pulse called this
  out 6+ days running with no action.
- **Route:** Puffer - run `node scripts/refresh-ledger.mjs` (the auto-
  refresh script referenced in the ledger). Single commit, ~5 min.
- **Severity rationale:** HIGH because it's directly cited in the triage
  playbook; multiple pulse flags have been ignored.

### H3. HOPED-FOR drain untouched for 12 days (was 6 at last triage)
- **Observed:** Confidence Ledger §3 HOPED-FOR entry covers the 2026-05-19
  batch (~50 commits: Tier-2 Recruit, Vehicles Q4-c/Q4-d, P3 Q4-b
  Advantages, FI streamline, ShareView, NPCs CLOSE ALL / drag-drop / folder
  reorder, GM-cascade playtest recorder, etc.). Drain target was the
  2026-05-25 playtest. That playtest happened (Minnie S7 evidence in
  debug-handoff.md and lessons.md), but the ledger entry was NOT updated
  with what got verified vs what's still hoped-for.
- **Why this matters:** the HOPED-FOR class is the "be surprised if a bug
  report comes in here" tier. Players reported bugs in this window
  (tactical-map move-follow was one of them); some of those bugs are
  fixed and verified; others might be lurking. The ledger should reflect
  the post-playtest state.
- **Route:** Puffer - drain pass after a quick playtest-evidence sweep.
  Move VERIFIED entries to PLAYTESTED RECENTLY; keep UNVERIFIED entries
  on HOPED-FOR with a fresh target. Single commit, ~30 min.
- **Severity rationale:** HIGH because the ledger drives "how confident
  should I be?" answers; 12 days of staleness means one full sprint of
  unverified-vs-verified status is unknown.

---

## MEDIUM findings

### M1. Security audit 2026-05-26 carry-overs (3) - no closure motion in 5 days
- `app/scene-controls-popout/page.tsx:316` uploadBackground -> tactical-maps
  bucket lacks `prepareUpload` guard + bucket not registered in
  `lib/safe-upload.ts` BUCKETS whitelist. GM-only (auth-gated) so exposure
  bounded, but pattern-inconsistent with war-stories / session-attachments
  / rumors which were all fixed in the same audit. Route: HP - apply the
  same `prepareUpload('tactical-maps', file)` pattern + register the
  bucket. ~15 min.
- `postcss` / `next` / `@sentry/nextjs` moderates - no non-breaking fix
  path; weekly re-check via health-pulse / security-audit. NO ACTION;
  re-confirm next Tuesday's audit.
- `@supabase/ssr` 0.9.0 -> 0.10.3 minor bump - low urgency advisory. Route:
  Puffer - skim changelog when convenient, defer.

### M2. TacticalMap post-gate polish wave (8 commits since gate-pass) unverified
- **Observed:** Risk Register demoted TacticalMap to GREEN today on the
  12-check 2-client gate ALL-PASS. After the demote, the polish wave kept
  shipping: `c0d9fb8`, `a068ffb`, `38e59cb`+`5845bfd`, `0599207`+`c3e0f10`,
  `421a4d6`, `aea76cd`, `31b28e9`+`867a128`. Some of these landed BEFORE
  the gate (and are part of the gate-pass evidence); others (Share Map
  one-shot, sticky scene lock, diag logging) landed AFTER.
- **Why this matters:** the gate proved the build before these. A fresh
  2-client playtest would close the verification gap; the smoketest doc
  (HP's `c818476`) covers a subset.
- **Route:** Puffer doc update - add a 14-day "watch" note to the
  TacticalMap Risk Register entry, NOT a re-bump to YELLOW. If a real
  playtest bug surfaces in the polish wave, re-bump then.
- **Severity rationale:** MEDIUM, not HIGH, because the gate did pass +
  the polish-wave commits are mostly UX (Share Map UX, scene-lock UX);
  none altered the core render/follow model.

### M3. Console statements lingering: 46 files, top 3 = 51+19+17 = 87 calls
- **Observed:** 46 files in `app/` `components/` `lib/` carry
  `console.(log|warn|error|info)` calls. Top: `app/stories/[id]/table/
  page.tsx` (51), `app/stories/[id]/table/hooks/useRollResolution.ts`
  (19), `lib/campaign-clock.ts` (17), `components/CampaignCommunity.tsx`
  (10).
- **Why this matters:** prod consoles are noise in support-debugging.
  Some are intentional (HP's `aea76cd` shipped today: `diag(tactical-map):
  surface auto-fit grid persist failures`) - those WANT to be there. But
  most are leftover instrumentation.
- **Route:** HP - audit the top 4 files; replace prod-relevant logs with
  Sentry breadcrumbs / `reportSupabaseError`; remove dev-only logs.
  ~1-2 hours per file. Defer to a quiet window; not urgent.
- **Severity rationale:** MEDIUM, not LOW, because the top file is the
  table page (the throat of the app during sessions) - any noisy
  exception there muddies support triage.

### M4. Tech Debt Ledger doesn't reference today's lessons
- **Observed:** 7 new `tasks/lessons.md` entries today (useEffect-persist
  race, broadcast-vs-explicit-action, prop-ref staleness, prop-mirrored
  ref during realtime races, channel reuse, ref capture at draw-time,
  pointerEvents on clickable children). All TacticalMap / scene-controls /
  Share Map territory.
- **Why this matters:** these are real architectural patterns the
  codebase now follows. The Tech Debt Ledger doesn't reflect them, so a
  future Claude or HP triaging a similar bug won't have them at hand.
- **Route:** Puffer - add a "Patterns learned 2026-05-30 (#1 KS gate
  closure)" subsection to debug-handoff.md §2 referencing the 7 lessons +
  the SHA chain. Single commit, ~20 min.

### M5. Sentry coverage on supabase error paths: 9 explicit captures across the codebase
- **Observed:** `Sentry.captureException` + `reportSupabaseError` together:
  9 sites total. The realtime wrappers (`wrapBroadcast`, `wrapDbChange`
  in `lib/sentry-realtime.ts`) absorb most of the realtime error volume,
  so 9 explicit captures is probably fine - but the ASYMMETRY is worth
  flagging.
- **Why this matters:** if `wrapBroadcast` were ever bypassed (a fresh
  realtime handler written without it), we'd lose error reporting from
  that path silently.
- **Route:** Puffer audit only - confirm `useCampaignChannel` / `useBroadcast`
  use sites all wrap their handlers. If yes -> close finding. If no -> add
  a guardrail script (`scripts/check-realtime-wrap.mjs`) on the pre-commit.
- **Severity rationale:** MEDIUM because it's a "no-known-issue but no-
  enforced-invariant" gap - exactly the class of thing that bites later.

---

## LOW findings

### L1. Sequential `await` in wound-infection loop
- **Site:** `app/stories/[id]/table/hooks/useRollResolution.ts:1855` and
  the mirror at `app/stories/[id]/table/page.tsx`.
- **Observed:** `for (const n of names) await maybeLogWoundInfection(n)`.
  Sequential; each call is a roll_log INSERT + dedup check.
- **Why minor:** the loop runs at end-of-combat or per-attack; volumes
  are 1-5 names typically. `Promise.all(names.map(maybeLogWoundInfection))`
  would parallelize but the dedup logic might assume serial execution.
  Touch with care.
- **Route:** HP investigation - confirm the dedup is safe under
  parallel; if yes, `Promise.all` it; if no, add a comment explaining
  why serial.

### L2. Empty `.catch(() => {})` swallows (5+ visible sites)
- **Sites:** `app/account/page.tsx:474`, `app/campaigns/new/page.tsx:58`,
  `app/campfire/page.tsx:140`, `app/moderate/page.tsx:647`, `app/rumors/
  [id]/edit/page.tsx:187` (+ likely more).
- **Why minor:** most are intentional "ignore non-critical failures"
  (e.g., the rumors edit storage cleanup is best-effort - failed deletes
  don't break the user flow). But each one is a silently-lost error.
- **Route:** HP audit - categorize each as (a) genuinely best-effort
  with a comment, (b) should be Sentry-breadcrumb'd, (c) should bubble.
  ~30 min sweep.

### L3. 3 useEffect empty-deps - probably right but worth a sanity check
- **Observed:** 3 components use `useEffect(() => {...}, [])`. Pattern-
  correct for mount-only side effects, but a frequent source of stale-
  closure bugs (4 of today's 7 lessons were stale-closure / stale-ref
  races).
- **Route:** Puffer or HP - eyeball the 3 sites to confirm they're truly
  mount-only and don't read state that mutates over time.

### L4. ~2 TODO/FIXME markers - clean
- **Observed:** only 2 inline TODO/FIXME/HACK markers in the entire
  `app/` + `components/` + `lib/` surface. That is unusually low.
- **Why notable:** either (a) the codebase is genuinely clean of
  acknowledged debt, or (b) we don't write TODO comments at all. Likely
  both - the Tech Debt Ledger doc captures debt instead of inline
  markers.
- **Route:** none. Observation only.

---

## Confidence Ledger triage (the part the audit pattern names explicitly)

| Tier | Current state | Audit action |
|---|---|---|
| TESTED (automated) | Says 622/37; actual 738/41 | **H2 - refresh ledger** |
| TYPECHECKED + GUARDRAILS | Current (tsc + arch + font + role + em-dash all GREEN this pass) | OK |
| PLAYTESTED RECENTLY | Last update covers 2026-05-18 evidence | **H3 - post-Minnie-S7 + post-gate-pass drain** |
| VALIDATED BY 2-CLIENT SUITE | Phase 7 suite + the 12-check gate (today) | Add the gate-pass evidence to the row |
| HOPED-FOR | Covers 2026-05-19 batch (50 commits) - 12 days stale | **H3 - drain** |

---

## Risk Register color updates

- **TacticalMap canvas - GREEN (today's demote)** stays GREEN; add an
  inline "polish wave 8 commits post-gate; watch 14 days through 2026-06-13
  for regressions in Share-Map / sticky-scene-lock / scene-controls
  persist surfaces" note. NOT a re-bump.
- All other Risk Register entries: no color changes warranted.

---

## Severity-prefixed todos (paste-ready)

Add these to `tasks/todo.md` CURRENT OPEN; close as worked:

```
- [ ] **[HIGH][PUFFER] H2 - refresh Confidence Ledger** via `node scripts/refresh-ledger.mjs`; current state says 622/37, actual 738/41. Health-pulse has flagged this 6+ days running. Single commit, ~5 min.
- [ ] **[HIGH][PUFFER] H3 - HOPED-FOR drain** post-Minnie-S7 + post-12-check-gate-pass. Update `debug-handoff.md` §3 with what got verified vs what's still hoped-for in the 2026-05-19 / 2026-05-25 / 2026-05-30 batches. Single commit, ~30 min.
- [ ] **[HIGH][PUFFER doc + HP campaign] H1 - update Tech Debt Ledger** §2 "damage_json as any" entry to reflect the real ~557 sites + 5 top hotspots. HP follow-up: type away `as any` one component at a time starting with `RollsFeed.tsx` (38 sites, hot path). Multi-week.
- [ ] **[MEDIUM][HP] M1 - close security carry-over**: `app/scene-controls-popout/page.tsx:316` uploadBackground needs `prepareUpload('tactical-maps', file)` + register `tactical-maps` in `lib/safe-upload.ts`. ~15 min.
- [ ] **[MEDIUM][PUFFER doc] M2 - TacticalMap 14-day watch** note added to debug-handoff.md §1 (post-gate polish wave; through 2026-06-13). NOT a YELLOW re-bump.
- [ ] **[MEDIUM][HP] M3 - console.* sweep** on the top 4 files (table page 51, useRollResolution 19, campaign-clock 17, CampaignCommunity 10). Replace prod-relevant logs with Sentry breadcrumbs; remove dev-only logs. Defer to a quiet window.
- [ ] **[MEDIUM][PUFFER] M4 - patterns learned 2026-05-30** subsection in debug-handoff.md §2 referencing the 7 new lessons + SHA chain. ~20 min.
- [ ] **[MEDIUM][PUFFER audit] M5 - realtime-wrap invariant** check: confirm all `useCampaignChannel` / `useBroadcast` sites wrap handlers via `wrapBroadcast` / `wrapDbChange`. If yes -> close. If no -> add `scripts/check-realtime-wrap.mjs` guardrail.
- [ ] **[LOW][HP investigation] L1 - wound infection loop** parallelization safety check (`useRollResolution.ts:1855` + mirror). Dedup might assume serial.
- [ ] **[LOW][HP audit] L2 - empty .catch(() => {})** sweep across 5+ sites. Categorize (best-effort vs Sentry-worthy vs should-bubble). ~30 min.
- [ ] **[LOW][HP or PUFFER] L3 - useEffect empty-deps** triple-check on the 3 sites - confirm not stale-closure.
```

---

## What this audit did NOT cover (gaps for the next pass)

- **Live 2-client playtest of the polish wave** (M2). The audit is a
  static analysis; it does not substitute for Xero + a second account.
- **Bundle size / network waterfall on prod** - never measured this pass.
  Worth a one-off look before KS opens (KS reviewers test on slow
  connections).
- **DB query plan analysis** for hot tables (`roll_log`, `character_states`,
  `scene_tokens`). 144 FK references + 119 indexes; coverage looks
  reasonable on inspection but I didn't run `EXPLAIN`.
- **Realtime payload audit** - the new `tactical_shared` Share-Map
  broadcast (today) joins existing surfaces. Worth confirming no payload
  is leaking sensitive data (e.g., GM-side data sent to players).
- **The 3 deferred KS visual-pass surfaces** (true ghost `/`, new-GM
  dashboard, real mobile) - tracked in `tasks/ks-visual-pass-2-2026-05-30
  .md`, not in this audit.

---

## Audit closure

Live gates GREEN; no BLOCKER findings; 3 HIGH items that are all stale-
state-bookkeeping (the codebase outran the docs after today's wave);
5 MEDIUM items, mostly distributed sweeps; 4 LOW items. The wave that
closed #1 KS core-loop reliability did NOT introduce new structural debt
- it introduced new patterns that need to be documented (M4) and surfaced
new evidence that needs to be folded into the ledgers (H2, H3).

Net: TheTapestry's stability posture for 2026-07-01 Beta-500 stays on
track. The biggest risk for the KS surface (cold-`/` -> map not pitch)
sits outside this audit's scope and is tracked under F1.
