# Health Pulse

Autonomous status checks every 3 hours (00:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 UTC). Newest first. Silent runs (all-green, no drift) are NOT logged here - absence = healthy.

When you see a new entry: open it, take the action listed, then leave the entry in place as a historical record.

---

## 2026-05-23 15:09 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [524 passed, 29 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox — skipped

**Drift:**
- **Confidence Ledger TESTED count stale (5th alert):** ledger still 502/26 files; live is 524/29. Unfixed across 5 consecutive pulses (~18h). Run `node scripts/refresh-ledger.mjs`.
- **HOPED-FOR (2026-05-19 batch) day 4** — drain target 2026-05-25 (2 days). On track; no action needed before playtest.

**Action:** `node scripts/refresh-ledger.mjs` — 5 consecutive alerts with no fix; delta stable (502→524, +3 files).

---

## 2026-05-23 12:11 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [524 passed, 29 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **Confidence Ledger TESTED count stale (4th alert):** ledger still 502/26 files; live is 524/29. Unfixed across 4 consecutive pulses since ~21:05 UTC 2026-05-22. Run `node scripts/refresh-ledger.mjs`.
- **HOPED-FOR (2026-05-19 batch) day 4** - drain target 2026-05-25 (2 days). On track; no action needed before playtest.

**Action:** `node scripts/refresh-ledger.mjs` — ledger stale for 4 consecutive pulses; delta stable (502→524, +3 files).

---

## 2026-05-23 09:08 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [524 passed, 29 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **Confidence Ledger TESTED count stale (3rd alert):** ledger still 502/26 files; live is 524/29. No action taken since 18:09 UTC yesterday. Run `node scripts/refresh-ledger.mjs`.
- **HOPED-FOR (2026-05-19 batch) day 4** - drain target 2026-05-25 (2 days). On track; no action needed before playtest.

**Action:** `node scripts/refresh-ledger.mjs` — ledger count stale for 3 consecutive pulses.

---

## 2026-05-23 00:11 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [524 passed, 29 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **Confidence Ledger TESTED count stale (unfixed):** ledger still shows 502/26 files; previous pulse (21:05 UTC) flagged 513/27 and recommended `node scripts/refresh-ledger.mjs` - not yet run. Now at 524/29. Delta growing.
- **HOPED-FOR (2026-05-19 batch) day 4** - drain target 2026-05-25 (2 days). On track; no action needed before playtest.

**Action:** Run `node scripts/refresh-ledger.mjs` to sync the Confidence Ledger test count (502 → 524, +3 new test files since last update).

---

## 2026-05-22 21:05 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [513 passed, 27 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **Confidence Ledger TESTED count stale:** ledger shows 502/26 files; live run shows 513/27. `8a4a371` added `tests/lib/initiative-actions.test.ts` (11 new tests). Run `node scripts/refresh-ledger.mjs` to drain.
- **HOPED-FOR (2026-05-19 batch) day 3** - drain target 2026-05-25 (3 days). At threshold; no action before playtest.

**Action:** `node scripts/refresh-ledger.mjs` to sync the Confidence Ledger test count.

---

## 2026-05-22 18:09 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [502 passed, 26 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**New since 15:09:** `a3294bc` docs(rearch) - architecture + conformance plan answering Xero's two questions. Leaf phase confirmed complete. No code changes.

**Drift (unchanged):**
- **HOPED-FOR (2026-05-19 batch) day 3** - drain target 2026-05-25 (3 days). No action before playtest.
- **Upstash KV approval `todo.md:42` still `[ ]`** (11th flag). L-3 shipped; gate item needs close/annotate to stop recurring.

**Action:** Annotate or close `todo.md:42` (Upstash retroactive approval) to silence this flag. Await 2026-05-25 playtest for HOPED-FOR drain.

---

## 2026-05-22 15:09 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [502 passed, 26 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**New since 12:06:** `4cc4352` drained ledger stale (502/26 confirmed) - **ledger drift RESOLVED**. Rearch step 2 items 8-11 landed (RestorePickerModal, GrantAdvantageModal, FeedColumn, CommunityStatusModal extracted); `9568469` marks leaf phase complete.

**Drift (remaining):**
- **HOPED-FOR (2026-05-19 batch) day 4** - drain target 2026-05-25 (3 days). No action before playtest.
- **Upstash KV approval `todo.md:42` still `[ ]`** (10th flag). L-3 shipped; this gate item is stale-open.

**Action:** Close/annotate `todo.md:42` re Upstash retroactive approval. Await 2026-05-25 playtest for HOPED-FOR drain.

---

## 2026-05-22 12:06 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [502 passed, 26 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift (unchanged from 09:08 — no new commits since last pulse):**
- **Ledger test count still stale:** ledger says 476/24 files; actual 502/26. `node scripts/refresh-ledger.mjs` not yet run.
- **HOPED-FOR (2026-05-19 batch) >3 days old.** Drain target: 2026-05-25 playtest.
- **Upstash KV approval (todo:42) still `[ ]`** (9th flag). L-3 shipped; gate item needs close/annotate.

**Action:** Same as 09:08 — (1) `node scripts/refresh-ledger.mjs`. (2) Close/annotate todo:42. (3) Await 2026-05-25 playtest to drain HOPED-FOR.

---

## 2026-05-22 09:08 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [502 passed, 26 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift (unchanged from 06:08 — no new commits since last pulse):**
- **Ledger test count still stale:** ledger says 476/24 files; actual 502/26. `node scripts/refresh-ledger.mjs` not yet run.
- **HOPED-FOR (2026-05-19 batch) still >3 days old.** Drain target: 2026-05-25 playtest.
- **Upstash KV approval (todo:42) still `[ ]`** (8th flag). L-3 shipped; gate item needs close/annotate.

**Action:** Same as 06:08 — no new signal. (1) `node scripts/refresh-ledger.mjs`. (2) Close/annotate todo:42. (3) Await 2026-05-25 playtest to drain HOPED-FOR.

---

## 2026-05-22 06:08 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [502 passed, 26 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **HOPED-FOR (2026-05-19 batch) now >3 days old.** ~50 commits unplaytested (Tier-2 Recruit, Vehicles Q4-c/d, Advantages P3 Q4-b, FI streamline, table refactor, RLS fix, Sentry, GM Share, NPC UX, playtest recorder, player-bar sort, Stress Check, narrative polish). Drain target: 2026-05-25 playtest per `tasks/pre-playtest-smoke-2026-05-25.md`.
- **Ledger test count stale (again):** ledger says 476/24 files; actual is 502/26 files (+26 tests, +2 files from rearch step 1 `range-profiles` + blast/mortal-wound math). Run `node scripts/refresh-ledger.mjs` to sync.
- **Stale-open todo (7th flag):** `todo.md:42` "Approve Upstash KV" still `[ ]`. L-3 shipped (`todo.md:66` is [x]). This decision-gate item likely needs Xero to formally close or note the retroactive approval.

**Action:** (1) Run `node scripts/refresh-ledger.mjs`. (2) Close or annotate `todo.md:42` re Upstash approval. (3) No code action needed for HOPED-FOR — playtest on 2026-05-25 drains it.

---

## 2026-05-21 21:04 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [476 passed, 24 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **Confidence Ledger mismatch:** ledger says 473 tests / encumbrance (10); actual is 476 / encumbrance (13). Delta: +3 tests added by `fix(encumbrance): RP drain 1/hour PER POINT` (commit `6f04c53`) since last refresh 2026-05-20. Run `node scripts/refresh-ledger.mjs` to sync `tasks/debug-handoff.md`.
- **Stale-open todo (6th flag):** `todo.md` L-3 KV rate-limiter + "Approve Upstash KV" still `[ ]`. Shipped `dd1a452`. Six consecutive flags; action is overdue.
- HOPED-FOR (2026-05-19 batch): 2 days old - will cross 3-day threshold at ~09:00 UTC 2026-05-22. Drain target: 2026-05-25 playtest.

**Action:** (1) Run `node scripts/refresh-ledger.mjs` to resync ledger count. (2) Close the L-3 / Upstash KV stale todos - they shipped.

---

## 2026-05-21 18:10 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [473 passed, 24 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **Stale-open todo (5th flag):** `todo.md:54` L-3 KV rate-limiter + `todo.md:30` "Approve Upstash KV" still `[ ]`. Shipped `dd1a452`. Upstash Redis live and confirmed in `app/api/auth/verify-turnstile/route.ts`. Five consecutive pulses with no close.
- HOPED-FOR (2026-05-19 batch): 2 days old - below 3-day threshold. Will flag at ~09:00 UTC 2026-05-22. Drain target: 2026-05-25 playtest.

**Action:** Close `todo.md` lines 54 + 30. L-3 shipped; no code change needed. Five flags is the signal.

---

## 2026-05-21 15:10 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [473 passed, 24 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **Stale-open todo (4th flag):** `todo.md:54` L-3 KV rate-limiter + `todo.md:30` "Approve Upstash KV" still `[ ]`. Shipped `dd1a452` 2026-05-20. Upstash Redis live (package.json confirmed). This is the 4th pulse flagging this; action is overdue.
- HOPED-FOR (2026-05-19 batch): 2 days old — still below 3-day threshold. Will flag at 00:00 UTC 2026-05-22 if no playtest update. Drain target: 2026-05-25.

**Action:** Check off `todo.md` lines 54 + 30 now. No code change needed — these are already shipped.

---

## 2026-05-21 12:08 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [473 passed, 24 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **Stale-open todo (3rd flag):** `todo.md:54` L-3 KV rate-limiter + `todo.md:30` "Approve Upstash KV" both still `[ ]`. Shipped `dd1a452` 2026-05-20. Two prior pulses flagged; still unresolved.
- HOPED-FOR (2026-05-19 batch): now 2 days old — below 3-day threshold. Will flag tomorrow morning (2026-05-22 ~09 UTC) if no playtest update. Drain target: 2026-05-25.

**Action:** Close `todo.md` lines 54 + 30 (L-3 shipped; Upstash KV approved and live). Three pulses is enough signal.

---

## 2026-05-21 09:11 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [473 passed]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **RLS P0 from 00:06 run: CLEARED.** `e8cffb8` (committed since last pulse) verified all 10 Tier-3 tables have `rls_enabled=true`. No action needed.
- **Stale-open todo (carried from 00:06 run):** `todo.md:54` L-3 KV rate-limiter still marked `[ ]` despite shipping `dd1a452`. Also `todo.md:30` ("Approve Upstash KV") is moot — Upstash Redis used directly. Both need closing.
- HOPED-FOR (2026-05-19 batch): 2 days old — below 3-day threshold, watching. Drain target: 2026-05-25 playtest.

**Action:** Close L-3 + line 30 in `tasks/todo.md`. RLS P0 is resolved — no further action.

---

## 2026-05-21 00:06 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [473 passed]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **Stale-open todo:** `todo.md:44` L-3 KV-backed rate-limiter marked `[ ]` but shipped 2026-05-20 via `dd1a452 feat(rate-limit): L-3 KV-backed verify-turnstile via Upstash Redis`. Check off + close blocking item at line 20 (`Approve Upstash KV`) which is moot (used Upstash Redis directly, not `@vercel/kv`).
- **SECURITY PENDING (unconfirmed P0):** `tasks/audit-rls-gap-sweep-2026-05-20.md` (committed yesterday `ca699b4`) flags 10 Tier-3 tables (`campaign_members`, `campaign_notes`, `campaigns`, `character_states`, `characters`, `map_pins`, `notifications`, `profiles`, `session_attachments`, `sessions`) with policies in `sql/` but NO `ENABLE ROW LEVEL SECURITY` statement in repo. App works so dashboard-enabled is likely, but unverified. Query 1 in that doc confirms or escalates to P0.
- HOPED-FOR (2026-05-19 batch): 2 days old, threshold is 3 - watching, not flagging. Drain target: 2026-05-25 playtest.

**Action:** URGENT FIRST - run Query 1 from `tasks/audit-rls-gap-sweep-2026-05-20.md` in Supabase SQL editor; any `rls_enabled = false` on those 10 tables is a P0 fix. THEN close L-3 + line 20 in todo.md.

---

## 2026-05-20 18:05 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [400 passed]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- Confidence Ledger fingerprint stale: ledger says 390 tests / 20 files; live suite is 400 tests / 21 files. `stabilize-helpers.test.ts` (10 tests) added 2026-05-20 after the last `refresh-ledger` run.

**Action:** `node scripts/refresh-ledger.mjs` (drains the ledger; ~30 seconds)

---

## 2026-05-20 15:03 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [388 passed]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- `tasks/todo.md` line 314: `>>>>>>> Stashed changes` git stash artifact present in committed file (git log `ce17b1a` already banned autostash - recurred)
- todo lines 48-49: "Sentry pipeline check" + "2026-05-13 batch watch-fors" still `[ ]`; these were pre-playtest verification items for 2026-05-18 playtest (2 days past)
- HOPED-FOR: 2026-05-19 batch is 1 day old (threshold 3 days) - watching, not flagging yet

**Action:** Remove `>>>>>>> Stashed changes` from tasks/todo.md:314; verify/close lines 48-49 if 2026-05-18 playtest covered them

---

## 2026-05-20 - DRIFT DRAINED (manual entry)

**Status:** GREEN

**Trigger:** Audit-driven cleanup session 2026-05-20 closed all open drift items + refreshed the Confidence Ledger.

**Drained:**
- 2026-05-19 06:08 UTC drift (Modal unification + CMod Stack dups): dedup'd via `cb76156` + reframed via `004905e`.
- 2026-05-19 12:05 UTC drift (Coordinated Effort summary banner stale-open): closed via `137be68` (already shipped) + audit-tracked via `004905e`.
- 2026-05-19 00:10 UTC drift (Confidence Ledger 160 -> 168 stale): refreshed to 388 via `2260f21`. Categorized inventory across all 20 test files.

**Updated:**
- `tasks/debug-handoff.md` §3 Confidence Ledger - test count 141 -> 388; coverage expanded from single-line to categorized inventory (roll engine, character math, community math, combat actions, vehicles, advantages, infrastructure); suite runtime 230ms -> 430ms; pre-commit guardrail count 3 -> 4 (font-sizes, role-literals, preview-sync, em-dashes).
- `tasks/todo.md` - 5 stale items closed (Modal unification reframed, Gut Instinct shipped, GM force-push shipped, Recruitment Tier-2 shipped, Group Check redesign resolved); setting content (King's Crossroads + Astoria + Pelee Island) moved to Backburner per Xero 2026-05-20.
- `tasks/next-playtest-sprint.md` - marked CLOSED-OF-SPRINT 5 days early; all 6 Day 1-2 Open items + all 4 design Qs annotated with commit refs.
- `tasks/spec-stabilize-migration.md` - new doc; 4-phase plan for the deferred multi-day Stabilize migration.
- `tasks/handoff.md` - session-state block refreshed for 2026-05-20.
- New guardrail: `scripts/check-em-dashes.mjs` wired into pre-commit (comment-aware; --no-verify override path).
- Em-dash sweep: 7099 chars purged across 409 files (.ts/.tsx + .mjs/.sh/.md).
- `.gitignore` excludes `supabase/.temp/` (recurrent push-blocker).

**Action:** None. Next health-pulse run should be clean. Build LOCKED for pre-playtest (2026-05-25 Saturday).

---

## 2026-05-19 12:05 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [188 passed]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- todo:71 "Coordinated Effort - bespoke chain summary banner" still `[ ]`; commit `137be68` shipped it ("feat(feed): Coordinated Effort chain folds into single bespoke banner", within last 3 days)
- Duplicates from 06:08 pulse still unresolved: todo lines 56+57 duplicate lines 80+84 (Modal unification / CMod Stack); third copies at lines 580+621
- HOPED-FOR: empty (drained 2026-05-18) - no drift

**Action:** Close todo:71 (Coord Effort banner shipped); then deduplicate Modal unification + CMod Stack entries (keep lines 80+84, drop 56+57)

---

## 2026-05-19 06:08 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [188 passed]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- `tasks/todo.md` CURRENT OPEN has duplicate entries for the same unstarted work:
  - Line 56: "Modal unification finish" duplicates line 80: "Modal unification (5 of 6 remaining)" - same 5 modals listed, line 80 is more detailed (notes `6640b1a` Coordinated Effort migration)
  - Line 57: "CMod Stack extraction" duplicates line 84: "CMod Stack reusable component" - same task, line 84 has fuller scope notes
  - Both pairs also have a third copy further down in the backlog (lines 580, 621)
- HOPED-FOR: empty (drained 2026-05-18) - no drift

**Action:** Deduplicate todo.md - keep the more-detailed version (lines 80 + 84) in CURRENT OPEN; remove lines 56 + 57

---

## 2026-05-19 00:10 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [168 passed]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox - skipped

**Drift:**
- Stale Confidence Ledger: reads "160 unit tests" - 168 now pass (+8 since last drain). New tests: sentry-realtime (5) + image-utils (3).

**Action:** Update `tasks/debug-handoff.md` §3 Confidence Ledger test count: 160 → 168; expand coverage description to include sentry-realtime + image-utils.

---

## 2026-05-18 - DRIFT DRAINED (manual entry)

**Status:** GREEN

**Trigger:** Xero ran all three open testplans this session
(preplay-testsmoke-2026-05-17 + polish-pass-2026-05-14 +
thriver-godmode-sweep). All sections passed.

**Drained:**
- HOPED-FOR 2026-05-13 batch (Phase 3 a/b/c/d drainers, 10 feed-audit fixes) → PLAYTESTED RECENTLY.
- HOPED-FOR 2026-05-14 batch (Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, die3, Luxury Ration) → PLAYTESTED RECENTLY.
- HOPED-FOR 2026-05-15 batch (effective fog cache, insight uncap, role-check sweep, helper consolidations, RollOutcome refactor) → PLAYTESTED RECENTLY.
- HOPED-FOR 2026-05-15→17 ships (vehicle subsystem, Lasting Wound chips, Coord Effort Withdraw retcon, Heal-LI infection cascade, Day-0 Lasting Damage modal, pin sidebar OSRM, drag-end grab-offset fix, GM Notes draft, Tools sidebar, moderation tooling) → PLAYTESTED RECENTLY.

**Updated:**
- `tasks/debug-handoff.md` §3 Confidence Ledger - HOPED-FOR list now empty; test count 141 → 160; PLAYTESTED RECENTLY expanded.
- `tasks/debug-handoff.md` §1 Risk Register - `lib/campaign-clock.ts`, `roll_log` writer, Initiative state machine, TacticalMap canvas all note "playtested green 2026-05-18" as demote candidates next review.
- `tasks/todo.md` - three testplan items closed.

**Action:** None. The 10 consecutive DRIFT-only entries below (06:08 → 18:05 UTC) were the signal that prompted this drain; preserved as historical context. Next health-pulse run should be clean.

---

## 2026-05-18 18:05 UTC

**Status:** DRIFT *(10th consecutive DRIFT-only - gates/audit clean; orphan-trigger todo still open; playtest confirmation still pending)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [160 passed]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox - skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (5 days): Phase 3 a/b/c/d, 10 feed-audit fixes. No playtest confirmation.
- HOPED-FOR 2026-05-14 batch (4 days): Coord Effort, Healing time-tick, Year-0, Export Log, Weapon Repair, Luxury Ration. No playtest confirmation.
- HOPED-FOR 2026-05-15 batch (3 days): fog cache, RollOutcome refactor, role-check sweep, helpers extraction.
- Stale Confidence Ledger: still reads "141 unit tests" - 160 pass (10th flag).
- Stale-open: `- [ ] 1 orphan trigger` in todo.md - commit `3fc28e6` (2026-05-17) closed it.

**Action:** Post-playtest session overdue: update Ledger (141→160), promote HOPED-FOR items that passed, mark orphan-trigger todo shipped.

---

## 2026-05-18 15:05 UTC

**Status:** DRIFT *(9th consecutive DRIFT-only - gates/audit clean; no commits since 12:05 UTC health-pulse; playtest not yet confirmed complete)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [160 passed]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox - skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (5 days): Phase 3 a/b/c/d, 10 feed-audit fixes. No playtest confirmation.
- HOPED-FOR 2026-05-14 batch (4 days): Coord Effort, Healing time-tick, Year-0, Export Log, Weapon Repair, Luxury Ration. No playtest confirmation.
- HOPED-FOR 2026-05-15 batch (3 days): fog cache, RollOutcome refactor, role-check sweep, helpers extraction.
- Stale Confidence Ledger: still reads "141 unit tests" - 160 pass (9th flag).
- Stale-open: `- [ ] 1 orphan trigger` in todo.md - commit `3fc28e6` (2026-05-17) closed it.

**Action:** No change from 12:04 - post-playtest session: update Ledger (141→160), promote HOPED-FOR items that passed, mark orphan-trigger todo shipped.

---

## 2026-05-18 12:04 UTC

**Status:** DRIFT *(8th consecutive DRIFT-only - gates/audit clean; no post-playtest commits yet)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [160 passed]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox - skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (5 days): Phase 3 a/b/c/d drainers, 10 feed-audit fixes. No playtest confirmation yet.
- HOPED-FOR 2026-05-14 batch (4 days): Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, Luxury Ration.
- HOPED-FOR 2026-05-15 batch (3 days): fog cache, RollOutcome refactor, role-check sweep, helpers extraction.
- Stale Confidence Ledger: still reads "141 unit tests" - 160 pass (8th flag).
- No commits since 09:09 UTC; playtest is either in progress or hasn't started.

**Action:** Same as 09:09 - after playtest session, update Confidence Ledger (141→160) + promote HOPED-FOR items that passed + close orphan-trigger todo.

---

## 2026-05-18 09:09 UTC

**Status:** DRIFT *(7th consecutive DRIFT-only - gates/audit clean; playtest prep active)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [160 passed]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox - skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (5 days, no playtest): Phase 3 a/b/c/d drainers, 10 feed-audit fixes.
- HOPED-FOR 2026-05-14 batch (4 days, no playtest): Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, Luxury Ration.
- HOPED-FOR 2026-05-15 batch (3 days): fog cache, RollOutcome refactor, role-check sweep, helpers extraction.
- Stale Confidence Ledger: still says "141 unit tests" - 160 pass now (flagged since 06:08).
- **POSITIVE:** `0375865` (pre-playtest smoke testplan) just landed - playtest prep is active today.
- **New untracked ship:** `a9a68b2 perf(sentry)` dropped benign Sentry noise (not gameplay-critical; watch if error visibility drops unexpectedly).

**Action:** Playtest in progress today per 06:08 note - after session, update Confidence Ledger (141→160), promote HOPED-FOR items that pass, close orphan-trigger todo.

---

## 2026-05-18 06:08 UTC

**Status:** DRIFT *(6th consecutive DRIFT-only - gates/audit clean; two new signals below)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [160 passed - up from 141]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox - skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (5 days, no playtest): Phase 3 a/b/c/d drainers, 10 feed-audit fixes. Still YELLOW in Risk Register.
- HOPED-FOR 2026-05-14 batch (4 days, no playtest): Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, die3, Luxury Ration.
- HOPED-FOR 2026-05-15 batch (3 days, threshold): fog cache, RollOutcome refactor, role-check sweep, helpers extraction.
- **NEW:** Confidence Ledger says "141 unit tests" - now 160 pass. Ledger is stale; update `tasks/debug-handoff.md` §3.
- **Stale-open candidate:** `- [ ] 1 orphan trigger - on_character_changed` in todo.md. Commit `3fc28e6` (2026-05-17) explicitly closes it ("Closes the only orphan trigger flagged by today's schema-drift report"). Mark shipped.
- **Playtest scheduled TODAY (2026-05-18):** Pre-playtest verification items still `[ ]` in todo.md (Sentry pipeline check + 2026-05-13 batch watch-fors).

**Action:** Before playtest - run Sentry verification + 2026-05-13 watch-fors. After playtest - update Confidence Ledger (141→160 tests; promote HOPED-FOR items that pass). Close orphan-trigger todo.

---

## 2026-05-17 21:05 UTC

**Status:** DRIFT *(5th consecutive DRIFT-only entry - gates/audit clean; playtest remains the only blocker)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [141 passed]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox - skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (4 days, no playtest): Phase 3 a/b/c/d (campaign-clock drainers), 10 feed-audit drift fixes. `lib/campaign-clock.ts` still YELLOW in Risk Register.
- HOPED-FOR 2026-05-14 batch (3+ days, no playtest): Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, die3, Luxury Ration consume.
- Stale-todo candidates: Tier 1 items #1/#3/#5 still `[ ]` - same open question as 18:08 entry (rules-only scope vs platform pending).

**Action:** 5th flag - 2026-05-13 Phase 3 batch 4 days unplaytested. Needs a live table session or deliberate decision to promote to PLAYTESTED.

---

## 2026-05-17 18:08 UTC

**Status:** DRIFT *(4th consecutive DRIFT-only entry - gates/audit clean; playtest remains the only blocker)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [141 passed]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox - skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (4+ days, no playtest): Phase 3 a/b/c/d (campaign-clock drainers), 10 feed-audit drift fixes. `lib/campaign-clock.ts` still YELLOW in Risk Register.
- HOPED-FOR 2026-05-14 batch (3+ days, no playtest): Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, die3, Luxury Ration consume.
- Stale-todo candidates: todo.md Tier 1 items #1 (Item Condition + Upkeep), #3 (Activity Block taxonomy), #5 (Falling/Drowning/Subsistence Damage) remain `[ ]` but "2026-05-14 canon shipped" audit note in the same file lists all three as shipped. Rules pages exist (`app/rules/equipment/item-condition/page.tsx`). Possible audit-correction needed - verify platform-side vs rules-only scope then close or re-scope.

**Action:** Playtest 2026-05-13 Phase 3 batch - campaign-clock drainers 4+ days unverified. Then audit Tier 1 items #1/#3/#5 in todo.md (close or split rules-done / platform-pending).

---

## 2026-05-17 15:10 UTC

**Status:** DRIFT *(RED resolved - `next` upgraded to 16.2.6 since 12:13 check)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [141 passed]

**Audit:** npm audit [clean] - `next` 16.2.6 confirmed installed; previous 3-check SSRF/DoS/bypass RED is now resolved.

**CI:** gh not authenticated in sandbox - skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (4 days, no playtest): Phase 3 a/b/c/d (campaign-clock drainers), 10 feed-audit drift fixes. Still unverified; risk accumulates.
- HOPED-FOR 2026-05-14 batch (3 days, threshold): Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, die3, Luxury Ration consume.

**Action:** Audit RED resolved. Schedule live playtest of 2026-05-13 Phase 3 batch - campaign-clock drainers now 4 days unverified.

---

## 2026-05-17 12:13 UTC

**Status:** RED+DRIFT *(findings unchanged from 09:08 - no fix landed yet)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [141 passed]

**Audit:** npm audit [2 high, 0 critical]
- HIGH: `next` - SSRF via WebSocket (CVSS 8.6) + middleware bypass + DoS; fix: `npm i next@^16.2.6`
- HIGH: `fast-uri` ≤3.1.1 - host confusion via percent-encoded authority

**CI:** gh not authenticated in sandbox - skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (4 days, no playtest): Phase 3 a/b/c/d (campaign-clock drainers), 10 feed-audit drift fixes.
- HOPED-FOR 2026-05-14 batch (3 days): Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, die3, Luxury Ration consume.
- Stale-todo: Intimidation still live in `lib/npc-generator.ts` + `lib/setting-npcs.ts`; todo item correctly open.

**Action:** This is the 3rd consecutive check with the same RED. `npm i next@^16.2.6` is a non-breaking patch - run it.

---

## 2026-05-17 09:08 UTC

**Status:** RED+DRIFT *(findings unchanged from 06:09 - no fix landed yet)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [141 passed]

**Audit:** npm audit [2 high, 0 critical]
- HIGH: `next` 16.2.1 - DoS (GHSA-q4gf-8mx6-v5v3, GHSA-8h8q-6873-q5fj, GHSA-mg66-mrh9-m8jx), SSRF via WebSocket (GHSA-c4j6-fc7j-m34r, CVSS 8.6), middleware bypass (GHSA-26hh-7cqf-hhc6, GHSA-492v-c6pp-mqqv, GHSA-267c-6grr-h53f, GHSA-36qx-fr4f-26g5); fix: `npm i next@^16.2.6`
- HIGH: `fast-uri` ≤3.1.1 - host confusion via percent-encoded authority (GHSA-v39h-62p7-jpjc)

**CI:** gh not authenticated in sandbox - skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (4 days, no playtest): Phase 3 a/b/c/d (campaign-clock drainers), 10 feed-audit drift fixes. Load-bearing; risk increases with each unverified day.
- HOPED-FOR 2026-05-14 batch (3 days, borderline): Coord Effort, Healing on time-tick, Year-0 calendar shift, Export Session Log, Weapon Repair, die3, Luxury Ration consume.

**Action:** Priority 1 - `npm i next@^16.2.6` (patches SSRF + middleware bypass, CVSS 8.6). Priority 2 - schedule live playtest of 2026-05-13 Phase 3 batch.

---

## 2026-05-17 06:09 UTC

**Status:** RED+DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [141 passed]

**Audit:** npm audit [2 high, 0 critical]
- HIGH: `next` - DoS with Server Components (2 advisories); fix available: upgrade to 16.2.6 (non-semver-major)
- HIGH: `fast-uri` - host confusion via percent-encoded authority delimiters; fix available

**CI:** gh not authenticated in sandbox - skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (4 days old, no playtest update): Phase 3 a/b/c/d, 10 feed-audit drift fixes. Still in HOPED-FOR; all load-bearing (campaign-clock drainers, feed rows).
- Stale-todo check: no definitively-shipped-but-still-open items found. Intimidation removal still pending in `lib/npc-generator.ts` + `lib/setting-npcs.ts` (6+ sites). `app/rules/vehicles/` still absent.

**Action:** `npm i next@16.2.6` to patch the DoS vuln (non-breaking); then schedule a live playtest of the 2026-05-13 Phase 3 batch - campaign-clock drainers + feed rows are 4 days unverified.

---
