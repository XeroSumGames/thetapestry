# Health Pulse

Autonomous status checks every 3 hours (00:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 UTC). Newest first. Silent runs (all-green, no drift) are NOT logged here — absence = healthy.

When you see a new entry: open it, take the action listed, then leave the entry in place as a historical record.

---

## 2026-05-19 00:10 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [168 passed]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox — skipped

**Drift:**
- Stale Confidence Ledger: reads "160 unit tests" — 168 now pass (+8 since last drain). New tests: sentry-realtime (5) + image-utils (3).

**Action:** Update `tasks/debug-handoff.md` §3 Confidence Ledger test count: 160 → 168; expand coverage description to include sentry-realtime + image-utils.

---

## 2026-05-18 — DRIFT DRAINED (manual entry)

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
- `tasks/debug-handoff.md` §3 Confidence Ledger — HOPED-FOR list now empty; test count 141 → 160; PLAYTESTED RECENTLY expanded.
- `tasks/debug-handoff.md` §1 Risk Register — `lib/campaign-clock.ts`, `roll_log` writer, Initiative state machine, TacticalMap canvas all note "playtested green 2026-05-18" as demote candidates next review.
- `tasks/todo.md` — three testplan items closed.

**Action:** None. The 10 consecutive DRIFT-only entries below (06:08 → 18:05 UTC) were the signal that prompted this drain; preserved as historical context. Next health-pulse run should be clean.

---

## 2026-05-18 18:05 UTC

**Status:** DRIFT *(10th consecutive DRIFT-only — gates/audit clean; orphan-trigger todo still open; playtest confirmation still pending)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [160 passed]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox — skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (5 days): Phase 3 a/b/c/d, 10 feed-audit fixes. No playtest confirmation.
- HOPED-FOR 2026-05-14 batch (4 days): Coord Effort, Healing time-tick, Year-0, Export Log, Weapon Repair, Luxury Ration. No playtest confirmation.
- HOPED-FOR 2026-05-15 batch (3 days): fog cache, RollOutcome refactor, role-check sweep, helpers extraction.
- Stale Confidence Ledger: still reads "141 unit tests" — 160 pass (10th flag).
- Stale-open: `- [ ] 1 orphan trigger` in todo.md — commit `3fc28e6` (2026-05-17) closed it.

**Action:** Post-playtest session overdue: update Ledger (141→160), promote HOPED-FOR items that passed, mark orphan-trigger todo shipped.

---

## 2026-05-18 15:05 UTC

**Status:** DRIFT *(9th consecutive DRIFT-only — gates/audit clean; no commits since 12:05 UTC health-pulse; playtest not yet confirmed complete)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [160 passed]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox — skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (5 days): Phase 3 a/b/c/d, 10 feed-audit fixes. No playtest confirmation.
- HOPED-FOR 2026-05-14 batch (4 days): Coord Effort, Healing time-tick, Year-0, Export Log, Weapon Repair, Luxury Ration. No playtest confirmation.
- HOPED-FOR 2026-05-15 batch (3 days): fog cache, RollOutcome refactor, role-check sweep, helpers extraction.
- Stale Confidence Ledger: still reads "141 unit tests" — 160 pass (9th flag).
- Stale-open: `- [ ] 1 orphan trigger` in todo.md — commit `3fc28e6` (2026-05-17) closed it.

**Action:** No change from 12:04 — post-playtest session: update Ledger (141→160), promote HOPED-FOR items that passed, mark orphan-trigger todo shipped.

---

## 2026-05-18 12:04 UTC

**Status:** DRIFT *(8th consecutive DRIFT-only — gates/audit clean; no post-playtest commits yet)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [160 passed]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox — skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (5 days): Phase 3 a/b/c/d drainers, 10 feed-audit fixes. No playtest confirmation yet.
- HOPED-FOR 2026-05-14 batch (4 days): Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, Luxury Ration.
- HOPED-FOR 2026-05-15 batch (3 days): fog cache, RollOutcome refactor, role-check sweep, helpers extraction.
- Stale Confidence Ledger: still reads "141 unit tests" — 160 pass (8th flag).
- No commits since 09:09 UTC; playtest is either in progress or hasn't started.

**Action:** Same as 09:09 — after playtest session, update Confidence Ledger (141→160) + promote HOPED-FOR items that passed + close orphan-trigger todo.

---

## 2026-05-18 09:09 UTC

**Status:** DRIFT *(7th consecutive DRIFT-only — gates/audit clean; playtest prep active)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [160 passed]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox — skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (5 days, no playtest): Phase 3 a/b/c/d drainers, 10 feed-audit fixes.
- HOPED-FOR 2026-05-14 batch (4 days, no playtest): Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, Luxury Ration.
- HOPED-FOR 2026-05-15 batch (3 days): fog cache, RollOutcome refactor, role-check sweep, helpers extraction.
- Stale Confidence Ledger: still says "141 unit tests" — 160 pass now (flagged since 06:08).
- **POSITIVE:** `0375865` (pre-playtest smoke testplan) just landed — playtest prep is active today.
- **New untracked ship:** `a9a68b2 perf(sentry)` dropped benign Sentry noise (not gameplay-critical; watch if error visibility drops unexpectedly).

**Action:** Playtest in progress today per 06:08 note — after session, update Confidence Ledger (141→160), promote HOPED-FOR items that pass, close orphan-trigger todo.

---

## 2026-05-18 06:08 UTC

**Status:** DRIFT *(6th consecutive DRIFT-only — gates/audit clean; two new signals below)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [160 passed — up from 141]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox — skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (5 days, no playtest): Phase 3 a/b/c/d drainers, 10 feed-audit fixes. Still YELLOW in Risk Register.
- HOPED-FOR 2026-05-14 batch (4 days, no playtest): Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, die3, Luxury Ration.
- HOPED-FOR 2026-05-15 batch (3 days, threshold): fog cache, RollOutcome refactor, role-check sweep, helpers extraction.
- **NEW:** Confidence Ledger says "141 unit tests" — now 160 pass. Ledger is stale; update `tasks/debug-handoff.md` §3.
- **Stale-open candidate:** `- [ ] 1 orphan trigger — on_character_changed` in todo.md. Commit `3fc28e6` (2026-05-17) explicitly closes it ("Closes the only orphan trigger flagged by today's schema-drift report"). Mark shipped.
- **Playtest scheduled TODAY (2026-05-18):** Pre-playtest verification items still `[ ]` in todo.md (Sentry pipeline check + 2026-05-13 batch watch-fors).

**Action:** Before playtest — run Sentry verification + 2026-05-13 watch-fors. After playtest — update Confidence Ledger (141→160 tests; promote HOPED-FOR items that pass). Close orphan-trigger todo.

---

## 2026-05-17 21:05 UTC

**Status:** DRIFT *(5th consecutive DRIFT-only entry — gates/audit clean; playtest remains the only blocker)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [141 passed]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox — skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (4 days, no playtest): Phase 3 a/b/c/d (campaign-clock drainers), 10 feed-audit drift fixes. `lib/campaign-clock.ts` still YELLOW in Risk Register.
- HOPED-FOR 2026-05-14 batch (3+ days, no playtest): Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, die3, Luxury Ration consume.
- Stale-todo candidates: Tier 1 items #1/#3/#5 still `[ ]` — same open question as 18:08 entry (rules-only scope vs platform pending).

**Action:** 5th flag — 2026-05-13 Phase 3 batch 4 days unplaytested. Needs a live table session or deliberate decision to promote to PLAYTESTED.

---

## 2026-05-17 18:08 UTC

**Status:** DRIFT *(4th consecutive DRIFT-only entry — gates/audit clean; playtest remains the only blocker)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [141 passed]

**Audit:** npm audit [clean]

**CI:** gh not authenticated in sandbox — skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (4+ days, no playtest): Phase 3 a/b/c/d (campaign-clock drainers), 10 feed-audit drift fixes. `lib/campaign-clock.ts` still YELLOW in Risk Register.
- HOPED-FOR 2026-05-14 batch (3+ days, no playtest): Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, die3, Luxury Ration consume.
- Stale-todo candidates: todo.md Tier 1 items #1 (Item Condition + Upkeep), #3 (Activity Block taxonomy), #5 (Falling/Drowning/Subsistence Damage) remain `[ ]` but "2026-05-14 canon shipped" audit note in the same file lists all three as shipped. Rules pages exist (`app/rules/equipment/item-condition/page.tsx`). Possible audit-correction needed — verify platform-side vs rules-only scope then close or re-scope.

**Action:** Playtest 2026-05-13 Phase 3 batch — campaign-clock drainers 4+ days unverified. Then audit Tier 1 items #1/#3/#5 in todo.md (close or split rules-done / platform-pending).

---

## 2026-05-17 15:10 UTC

**Status:** DRIFT *(RED resolved — `next` upgraded to 16.2.6 since 12:13 check)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [141 passed]

**Audit:** npm audit [clean] — `next` 16.2.6 confirmed installed; previous 3-check SSRF/DoS/bypass RED is now resolved.

**CI:** gh not authenticated in sandbox — skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (4 days, no playtest): Phase 3 a/b/c/d (campaign-clock drainers), 10 feed-audit drift fixes. Still unverified; risk accumulates.
- HOPED-FOR 2026-05-14 batch (3 days, threshold): Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, die3, Luxury Ration consume.

**Action:** Audit RED resolved. Schedule live playtest of 2026-05-13 Phase 3 batch — campaign-clock drainers now 4 days unverified.

---

## 2026-05-17 12:13 UTC

**Status:** RED+DRIFT *(findings unchanged from 09:08 — no fix landed yet)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [141 passed]

**Audit:** npm audit [2 high, 0 critical]
- HIGH: `next` — SSRF via WebSocket (CVSS 8.6) + middleware bypass + DoS; fix: `npm i next@^16.2.6`
- HIGH: `fast-uri` ≤3.1.1 — host confusion via percent-encoded authority

**CI:** gh not authenticated in sandbox — skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (4 days, no playtest): Phase 3 a/b/c/d (campaign-clock drainers), 10 feed-audit drift fixes.
- HOPED-FOR 2026-05-14 batch (3 days): Coord Effort, Healing on time-tick, Year-0, Export Log, Weapon Repair, die3, Luxury Ration consume.
- Stale-todo: Intimidation still live in `lib/npc-generator.ts` + `lib/setting-npcs.ts`; todo item correctly open.

**Action:** This is the 3rd consecutive check with the same RED. `npm i next@^16.2.6` is a non-breaking patch — run it.

---

## 2026-05-17 09:08 UTC

**Status:** RED+DRIFT *(findings unchanged from 06:09 — no fix landed yet)*

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [141 passed]

**Audit:** npm audit [2 high, 0 critical]
- HIGH: `next` 16.2.1 — DoS (GHSA-q4gf-8mx6-v5v3, GHSA-8h8q-6873-q5fj, GHSA-mg66-mrh9-m8jx), SSRF via WebSocket (GHSA-c4j6-fc7j-m34r, CVSS 8.6), middleware bypass (GHSA-26hh-7cqf-hhc6, GHSA-492v-c6pp-mqqv, GHSA-267c-6grr-h53f, GHSA-36qx-fr4f-26g5); fix: `npm i next@^16.2.6`
- HIGH: `fast-uri` ≤3.1.1 — host confusion via percent-encoded authority (GHSA-v39h-62p7-jpjc)

**CI:** gh not authenticated in sandbox — skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (4 days, no playtest): Phase 3 a/b/c/d (campaign-clock drainers), 10 feed-audit drift fixes. Load-bearing; risk increases with each unverified day.
- HOPED-FOR 2026-05-14 batch (3 days, borderline): Coord Effort, Healing on time-tick, Year-0 calendar shift, Export Session Log, Weapon Repair, die3, Luxury Ration consume.

**Action:** Priority 1 — `npm i next@^16.2.6` (patches SSRF + middleware bypass, CVSS 8.6). Priority 2 — schedule live playtest of 2026-05-13 Phase 3 batch.

---

## 2026-05-17 06:09 UTC

**Status:** RED+DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [141 passed]

**Audit:** npm audit [2 high, 0 critical]
- HIGH: `next` — DoS with Server Components (2 advisories); fix available: upgrade to 16.2.6 (non-semver-major)
- HIGH: `fast-uri` — host confusion via percent-encoded authority delimiters; fix available

**CI:** gh not authenticated in sandbox — skipped

**Drift:**
- HOPED-FOR 2026-05-13 batch (4 days old, no playtest update): Phase 3 a/b/c/d, 10 feed-audit drift fixes. Still in HOPED-FOR; all load-bearing (campaign-clock drainers, feed rows).
- Stale-todo check: no definitively-shipped-but-still-open items found. Intimidation removal still pending in `lib/npc-generator.ts` + `lib/setting-npcs.ts` (6+ sites). `app/rules/vehicles/` still absent.

**Action:** `npm i next@16.2.6` to patch the DoS vuln (non-breaking); then schedule a live playtest of the 2026-05-13 Phase 3 batch — campaign-clock drainers + feed rows are 4 days unverified.

---
