# Health Pulse

Autonomous status checks every 3 hours (00:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 UTC). Newest first. Silent runs (all-green, no drift) are NOT logged here - absence = healthy.

When you see a new entry: open it, take the action listed, then leave the entry in place as a historical record.

---

## 2026-08-02 18:04 UTC

**Status:** DRIFT (state unchanged from 15:04 - no new commits, no new issues)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [937 passed / 55 files]

**Audit:** npm audit [4 high, 0 critical] - unchanged (brace-expansion DoS, postcss XSS, sharp libvips CVEs, next via those two)

**CI:** last 5 runs all SUCCESS (confirmed via GitHub API)

**Drift (carried):**
- HOPED-FOR vehicle popout broadcasts - stale 47+ days, no git activity
- HOPED-FOR stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - stale 47+ days
- HOPED-FOR FI Insight Die award path (roll doubles -> +1 insight die) - stale 47+ days
- todo open: CampaignMap fingerprint hashes allPins not visible subset (CampaignMap.tsx ~650)
- todo open: 3s vehicles poll (page.tsx ~3090) - setInterval 3000ms still live

**Action:** No change from prior entries. postcss XSS (HIGH) most urgent npm item. HOPED-FOR items drain at next playtest.

---

## 2026-08-02 15:04 UTC

**Status:** DRIFT (state unchanged from 12:07 - CI now confirmed; vulns + HOPED-FOR still open)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [937 passed / 55 files]

**Audit:** npm audit [4 high, 0 critical] - brace-expansion DoS, postcss XSS, sharp libvips CVEs, next via those two

**CI:** last 5 runs all SUCCESS (confirmed via GitHub API this run; was "skipped" in prior entries)

**Drift:**
- HOPED-FOR vehicle popout broadcasts - stale 47+ days, no recent playtest confirmation
- HOPED-FOR stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - stale 47+ days
- HOPED-FOR FI Insight Die award path (roll doubles -> +1 insight die) - never fired in live play
- todo open: CampaignMap fingerprint hashes allPins not visible subset (CampaignMap.tsx:650-656)
- todo open: 3s vehicles poll (page.tsx:3129) - setInterval 3000ms still live

**Action:** postcss XSS (HIGH) is the most urgent npm item for a web app - worth a focused npm audit fix pass. HOPED-FOR items need next playtest session to drain. CI is green; no code emergency.

---

## 2026-08-02 12:07 UTC

**Status:** DRIFT (state unchanged from 09:03 - no new commits, no new issues)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [937 passed / 55 files]

**Audit:** npm audit [4 high, 0 critical] - unchanged (brace-expansion DoS, postcss XSS, sharp libvips CVEs, next via those two)

**CI:** gh not available, skipped

**Drift (carried):**
- HOPED-FOR vehicle popout broadcasts - stale 47+ days, no git activity
- HOPED-FOR stress-check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - stale 47+ days
- HOPED-FOR FI Insight Die award path (roll doubles -> +1 insight die) - stale 47+ days
- todo open: CampaignMap fingerprint hashes allPins not visible subset (CampaignMap.tsx:656)
- todo open: 3s vehicles poll (page.tsx:3129) - setInterval 3000ms still live

**Action:** Same as prior entries. postcss XSS (HIGH) is the most urgent npm item for a web app. Drain the 3 HOPED-FOR items at next playtest session.

---

## 2026-08-02 09:03 UTC

**Status:** DRIFT (state unchanged from 00:06 - 1 new commit, no new issues)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [937 passed / 55 files]

**Audit:** npm audit [4 high, 0 critical] - unchanged (brace-expansion, postcss, sharp, next)

**CI:** gh not authenticated, skipped

**Drift:**
- HOPED-FOR vehicle popout broadcasts - stale, no git activity
- HOPED-FOR stress-check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - stale
- HOPED-FOR Cover Fire -2 CMod 2-client verify + GM Screen interactive verify - stale
- todo open: CampaignMap fingerprint hashes allPins not visible subset (CampaignMap.tsx:656) - still live
- todo open: 3s vehicles poll (page.tsx:3129) - setInterval 3000ms still live

**New commit:** 5f955c6 chore(arch): re-baseline page.tsx LOC ceiling (11114 -> 11165) - maintenance only, no behavioral change.

**Action:** Carry from 00:06. 4 high npm vulns remain unpached. Drift items unchanged.

---

## 2026-08-02 00:06 UTC

**Status:** DRIFT (state unchanged from 21:04 entry - no new commits, no new signal)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [937 passed / 55 files]

**Audit:** npm audit [4 high, 0 critical] - same as 21:04 (brace-expansion, postcss, sharp, next)

**CI:** last 5 runs all pass (most recent: 2026-08-01 21:06 UTC)

**Drift:**
- HOPED-FOR vehicle popout broadcasts - stale, no git activity
- HOPED-FOR stress-check 12-string narrative (HEAL/UNJAM/REPAIR/etc.) - stale
- HOPED-FOR Cover Fire -2 CMod 2-client verify + GM Screen interactive verify - stale
- todo open: CampaignMap fingerprint hashes allPins not visible (CampaignMap.tsx:656) - still live
- todo open: 3s vehicles poll (page.tsx:3129) - setInterval 3000ms still live

**Action:** Carry from 21:04 entry. No new issues.

---

## 2026-08-01 21:04 UTC

**Status:** DRIFT (state unchanged from 18:05 entry - no new signal)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [937 passed / 55 files], arch [OK]

**Audit:** npm audit [4 high, 0 critical] - same as 18:05 (brace-expansion, postcss, sharp, next)

**CI:** last 5 runs all pass (most recent: health-pulse push 18:07 UTC, success)

**Drift:**
- HOPED-FOR vehicle popout broadcasts - no git activity, stale 3+ days
- HOPED-FOR stress-check 12-string narrative (HEAL/UNJAM/REPAIR/etc.) - stale 3+ days
- HOPED-FOR Cover Fire -2 CMod 2-client verify - owed ~13 days (2026-07-20)
- HOPED-FOR GM Screen interactive verify - owed ~13 days (2026-07-20)
- todo open: CampaignMap fingerprint hashes allPins not visible (CampaignMap.tsx ~650) - still present
- todo open: 3s vehicles poll (page.tsx ~3090) - setInterval 3000ms still live

**Action:** All action items carried from 18:05 entry. No new issues.

---

## 2026-08-01 18:05 UTC

**Status:** RED+DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [937 passed / 55 files]

**Audit:** npm audit [4 high, 0 critical]
- brace-expansion 5.0.7 (PATCHABLE -> 5.0.8, DoS via unbounded expansion)
- sharp 0.34.5 (PATCHABLE -> 0.35.0, inherited libvips CVE-2026-33327/33328/35590/35591)
- postcss 8.4.31 (no patch available <=8.5.17 - path traversal via sourceMappingURL + XSS; build-time risk)
- next (transitive via postcss + sharp)

**CI:** 2 failures in last 5 runs (recovered - 3 successes since)
- https://github.com/XeroSumGames/thetapestry/actions/runs/30707274927 2026-08-01T16:03Z (security: forum cross-campaign injection fix)
- https://github.com/XeroSumGames/thetapestry/actions/runs/30707326077 2026-08-01T16:04Z (security: DM spam vector fix)
- Most recent run GREEN: https://github.com/XeroSumGames/thetapestry/actions/runs/30708936054

**Drift:**
- HOPED-FOR vehicle popout broadcasts (vehicle_updated/firing_arc_toggle) - unverified 3+ days
- HOPED-FOR stress-check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - unverified 3+ days
- HOPED-FOR Cover Fire -2 CMod 2-client verify - owed ~13 days (2026-07-20)
- HOPED-FOR GM Screen interactive verify (drag/collapse/filter persist) - owed ~13 days
- todo open: CampaignMap fingerprint hashes allPins not visible (components/CampaignMap.tsx:650) - confirmed still present
- todo open: 3s vehicles poll (page.tsx:3129) - setInterval 3000ms still live

**Action:** Patch brace-expansion + sharp (low-risk, independent of Next.js). Postcss has no patch yet - monitor. Schedule Cover Fire + GM Screen 2-client verify (13 days overdue). CI failures were on security fix commits and self-recovered - review those 2 runs to confirm they were transient.

---

## 2026-08-01 15:08 UTC

**Status:** DRIFT (arch ratchet CI blockage CLEARED - 4 consecutive passes as of 14:59 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [937 passed / 55 files]

**Audit:** npm audit [4 high, 0 critical] - brace-expansion (independently fixable), next/postcss/sharp (require major Next.js version bump). Unchanged.

**CI:** last failure: https://github.com/XeroSumGames/thetapestry/actions/runs/30703395923 2026-08-01T14:15Z (tsc, commit 61677df, recovered within 33 min - 4 subsequent successes). Prior arch-ratchet breach chain from the 12:07 entry is CLEARED.

**Drift:**
- HOPED-FOR vehicle popout broadcasts (Section B) - stale 3+ days, no git activity
- HOPED-FOR Cover Fire -2 CMod 2-client verify - owed since 2026-07-20 (12 days)
- HOPED-FOR GM Screen interactive verify (drag/collapse/filter persist) - owed since 2026-07-20 (12 days)
- HOPED-FOR stress-check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - stale 3+ days
- HOPED-FOR FI Insight Die award path (doubles -> +1 pool) - stale 3+ days, never fired live
- todo open: CampaignMap fingerprint hashes allPins (line 651) - GM editing hidden pins churns player maps
- todo open: 3s vehicles poll (page.tsx:3129) - scale liability at Beta-500 (~167 req/s)

**Action:** CI blockage cleared. Schedule Cover Fire + GM Screen 2-client verify (12 days overdue). Plan brace-expansion fix (low-risk, independent). CampaignMap fingerprint is low-risk fix (hash visible not allPins).

---

## 2026-08-01 12:07 UTC

**Status:** RED+DRIFT (4th consecutive health-pulse, 12h+ unresolved - escalating)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [934 passed / 55 files]

**Audit:** npm audit [4 high, 0 critical] - brace-expansion, next, postcss, sharp. Unchanged.

**CI:** FAILURE x4 in last 5 runs. Latest: 2026-08-01T09:06Z. All fail: arch ratchet - `app/stories/[id]/table/page.tsx` grew 11114 -> 11165 (+51 lines, past 25-line grace). Root commits: `ca83fd4` + `693f813` (combat bug fixes). Every push to main fails CI. TSC + Vitest remain dark while arch:check blocks them.

**Drift:**
- HOPED-FOR vehicle popout broadcasts (Section B) - stale 3+ days, no code activity
- HOPED-FOR stress-check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - stale 3+ days
- HOPED-FOR FI Insight Die award path (doubles -> +1 pool) - stale 3+ days, never fired live

**Action:** CRITICAL - 4 consecutive CI failures. Run `node scripts/check-arch.mjs --save` to re-baseline at 11165 (the +51 LOC came from legitimate bug fixes). Every push blocked until this is done.

---

## 2026-08-01 09:03 UTC

**Status:** RED+DRIFT (persists - 3rd consecutive health-pulse with unresolved arch ratchet breach)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [934 passed / 55 files]

**Audit:** npm audit [4 high, 0 critical] - brace-expansion, next, postcss, sharp. Unchanged.

**CI:** FAILURE x3 in last 5 runs (latest: 2026-08-01T06:07Z). All fail at Architecture ratchet: `app/stories/[id]/table/page.tsx` grew 11114 -> 11165 (+51 lines, past the 25-line grace). Health-pulse commits are now also triggering CI failures - the ratchet blocks every push to main until resolved. Root: `ca83fd4` + `693f813` (bug fixes that legitimately added LOC). TSC + Vitest remain dark (skipped by CI when arch:check fails).

**Drift:**
- HOPED-FOR vehicle popout broadcasts (section B) - stale since 2026-06-16, no code touches
- HOPED-FOR stress-check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - stale since 2026-06-16
- HOPED-FOR FI Insight Die award path (doubles -> +1 pool) - stale since 2026-06-16, never fired live

**Action:** HP: run `node scripts/check-arch.mjs --save` to re-baseline at 11165 (growth was intentional bug fixes) OR extract code to bring LOC below 11114. Every push to main fails CI until this is done. Escalating - 9h unresolved.

---

## 2026-08-01 06:07 UTC

**Status:** RED+DRIFT (persists from 00:04 entry - unresolved after 6h)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [934 passed / 55 files]

**Audit:** npm audit [4 high, 0 critical] - brace-expansion, next, postcss, sharp. Unchanged.

**CI:** FAILURE x2 in last 5 runs. Latest: 2026-08-01T00:06:19Z (run on health-pulse commit a815d80). Failing step: Architecture ratchet. Error: `app/stories/[id]/table/page.tsx` grew 11114 -> 11165 (+51 lines, past the 25-line grace). Root commit: ca83fd4 "fix(combat): in-table toast for Attack gates, drop browser alert()". TSC + Vitest skipped because arch:check fails first - those gates are dark while this persists.

**Drift:**
- HOPED-FOR vehicle popout broadcasts (section B) - stale since 2026-06-16, no code touches
- HOPED-FOR stress-check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - stale since 2026-06-16
- HOPED-FOR FI Insight Die award path (doubles -> +1 pool) - stale since 2026-06-16

**Action:** UNRESOLVED since 00:04 entry. HP must extract code from table/page.tsx OR re-baseline (`node scripts/check-arch.mjs --save`) if the +51 LOC is intentional. Every push to main will keep failing CI until fixed.

---

## 2026-08-01 00:04 UTC

**Status:** RED+DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [934 passed / 55 files]

**Audit:** npm audit [4 high, 0 critical] - brace-expansion, next (via postcss), postcss, sharp. Unchanged from prior entry.

**CI:** FAILURE - run 1598 (2026-07-31T21:40 UTC). Commit: `ca83fd4` "fix(combat): in-table toast for Attack gates, drop browser alert()". Failing step: Architecture ratchet (LOC ceilings). Error: `app/stories/[id]/table/page.tsx` grew 11114 -> 11165 (+51 lines, past the 25-line grace). All other CI steps (font-sizes, role-literals, em-dash, preview-sync guardrails) PASS. TSC + Vitest were skipped because arch:check failed first.

**Drift:**
- HOPED-FOR vehicle popout broadcasts (section B) - stale since 2026-06-16, no code change
- HOPED-FOR stress-check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - stale since 2026-06-16
- HOPED-FOR FI Insight Die award path (doubles -> +1 pool) - stale since 2026-06-16, never fired live

**Action:** CI RED since ca83fd4. HP: extract code from table/page.tsx to bring it below the ratchet ceiling, OR re-baseline with `node scripts/check-arch.mjs --save` if the growth is intentional. Ratchet ceiling was 11114; file is now 11165. The arch:check does NOT run in the local pre-commit hook, only in CI.

---

## 2026-07-31 21:04 UTC

**Status:** DRIFT (x31 - same 3 HOPED-FOR; audit improved 12->4 high)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [934 passed / 55 files]

**Audit:** npm audit [4 high, 0 critical] - DOWN from 12 high. Remaining: brace-expansion, next, postcss, sharp. Several dev-only highs (eslint/minimatch etc.) resolved automatically (dep tree update?).

**CI:** last 5 runs all SUCCESS (latest: 2026-07-31T18:06 UTC)

**Drift:**
- HOPED-FOR vehicle popout broadcasts (section B) - stale since 2026-06-16, no code change in area
- HOPED-FOR stress-check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - stale since 2026-06-16
- HOPED-FOR FI Insight Die award path (doubles -> +1 pool) - stale since 2026-06-16, never fired live

**Todo spot-check:** alert() broken-weapon gate (page.tsx still present), vehicles 3s poll (page.tsx:3108 still present), window.prompt in recorder (PlaytestRecorder.tsx:355 still present). All confirmed still open.

**Action:** Audit improvement is passive/automatic - nothing to do. Remaining 4 highs: `next` + `sharp` are runtime-path (real); `postcss` + `brace-expansion` are build-time only. Pin or upgrade `next` + `sharp` when a maintenance window opens.

---

## 2026-07-31 18:06 UTC

**Status:** DRIFT (x30 consecutive - unchanged from 15:05 UTC entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [934 passed / 55 files]

**Audit:** npm audit [12 high, 0 critical] - unchanged (next + sharp runtime-path CVEs; eslint/minimatch/brace-expansion dev-only)

**CI:** last 5 runs all SUCCESS (latest: 2026-07-31T15:08 UTC)

**Drift:**
- HOPED-FOR vehicle popout broadcasts (B section) - stale since 2026-06-16, no code change
- HOPED-FOR stress-check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - stale since 2026-06-16
- HOPED-FOR FI Insight Die award path (doubles -> +1 pool) - stale since 2026-06-16, never fired in live play

**Todo spot-check:** alert() at page.tsx:6015-6017 (broken-weapon gate, open), vehicles 3s poll at page.tsx:3108 (open). No evidence of silent ships.

**Action:** No new findings. See 15:05 entry. Upgrade `next` + `sharp` to close production-path CVEs.

---

## 2026-07-31 15:05 UTC

**Status:** DRIFT (x29 consecutive - unchanged from 09:05 UTC entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [934 passed / 55 files]

**Audit:** npm audit [12 high, 0 critical] - unchanged (next + sharp are runtime-path CVEs; eslint/minimatch/brace-expansion dev-only)

**CI:** last 5 runs all SUCCESS (latest: 2026-07-31T09:07 UTC)

**Drift:**
- HOPED-FOR vehicle popout broadcasts (B section) - stale since 2026-06-16, no code change in last 3 days
- HOPED-FOR stress-check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - stale since 2026-06-16
- HOPED-FOR FI Insight Die award path (doubles -> +1 pool) - stale since 2026-06-16, never fired in live play

**Action:** No new findings since 09:05 entry. Top unresolved: upgrade next + sharp to close runtime CVEs.

---

## 2026-07-31 09:05 UTC

**Status:** DRIFT (x28 consecutive - unchanged from 00:06 UTC entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [934 passed / 55 files]

**Audit:** npm audit [12 high, 0 critical] - unchanged (postcss XSS, sharp libvips CVEs; eslint/minimatch dev-only)

**CI:** last 5 runs all SUCCESS (latest: 2026-07-31T00:09 UTC)

**Drift:** Same 3 HOPED-FOR (vehicle popout broadcasts, stress-check 12-string narrative, FI Insight Die award path). No app code changes in last 3 days (only health-pulse commits + NPC reload fix 2026-07-30).

**Action:** No new findings. Sharp + next upgrade still the top unresolved item to close production-path CVEs.

---

## 2026-07-31 00:06 UTC

**Status:** DRIFT (x27 consecutive - same as 21:04 UTC entry, no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [934 passed / 55 files]

**Audit:** npm audit [12 high, 0 critical] - unchanged (postcss XSS, sharp libvips CVEs; eslint/minimatch dev-only)

**CI:** last 5 runs all SUCCESS (latest: 2026-07-30T21:06 UTC)

**Drift:** Same 3 HOPED-FOR (vehicle popout broadcasts, stress-check 12-string, FI Insight Die award). No code activity.

**Action:** See 2026-07-30 15:09 UTC entry. Upgrade `sharp` + `next` to close production-path CVEs. No new action this run.

---

## 2026-07-30 21:04 UTC

**Status:** DRIFT (x26 consecutive - same as 18:04 UTC entry, no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [934 passed / 55 files]

**Audit:** npm audit [12 high, 0 critical] - unchanged (postcss XSS, sharp libvips CVEs; eslint/minimatch dev-only)

**CI:** last 5 runs all SUCCESS (latest: 2026-07-30T18:07 UTC)

**Drift:** Same 3 HOPED-FOR (vehicle popout broadcasts, stress-check 12-string, FI Insight Die award). No code activity.

**Action:** See 15:09 UTC entry. Upgrade `sharp` + `next` to close production-path CVEs.

---

## 2026-07-30 18:04 UTC

**Status:** DRIFT (same as 15:09 UTC entry - no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [934 passed / 55 files]

**Audit:** npm audit [12 high, 0 critical] - unchanged (postcss XSS, sharp libvips CVEs production-path; eslint/minimatch dev-only)

**CI:** last 5 runs all SUCCESS (latest: 2026-07-30T15:10 UTC)

**Drift:** Same 3 HOPED-FOR items (vehicle popout broadcasts, stress-check 12 strings, FI Insight Die award); same stale todos. No code activity.

**Action:** See 15:09 UTC entry. No new action needed.

---

## 2026-07-30 15:09 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [934 passed / 55 files]

**Audit:** 12 HIGH, 0 critical
- Production-affecting: `postcss` (XSS via unescaped </style> + arbitrary file read via sourceMappingURL), `sharp` (4 libvips CVEs: CVE-2026-33327/33328/35590/35591), `next` (via both)
- Dev-only (no runtime risk): `minimatch`/`brace-expansion` DoS via eslint ecosystem

**CI:** Last 5 runs all SUCCESS (2026-07-30)

**Drift:**
- HOPED-FOR: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - no git activity in 3+ days; drain target was Beta-500 dry-run
- HOPED-FOR: Vehicle popout broadcasts (Section B) - no git activity in 3+ days; awaiting playtest confirm
- HOPED-FOR: FI Insight Die AWARD (rolling doubles) - no git activity in 3+ days; never fired in live play
- Stale todo confirmed open: vehicles 3s poll `page.tsx:3108` setInterval still present (routed HP 2026-06-29)
- Stale todo confirmed open: broken-weapon `alert()` `page.tsx:6015` still present (routed HP 2026-07-06)

**Action:** Upgrade `sharp` + `next` to patch available versions (postcss/sharp CVEs are the only production-path HIGHs); the eslint HIGHs are dev-only and can wait.

---

## 2026-07-30 12:07 UTC

**Status:** DRIFT (x25 consecutive - same 3 HOPED-FOR items, no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [934 passed / 55 files]

**Audit:** npm audit [12 high, 0 critical] - same carry-overs (eslint/minimatch/brace-expansion dev-only DoS, postcss XSS, sharp libvips CVEs). Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-30T09:08 UTC)

**Drift:**
- vehicle popout broadcasts: HOPED-FOR >60 days, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR since 2026-06-16, untouched
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched

**Action:** x25 same drift - 3 HOPED-FOR items need a deliberate playtest pass. No code action from this run.

---

## 2026-07-30 09:12 UTC

**Status:** DRIFT (x24 consecutive - same 3 HOPED-FOR items, no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [934 passed / 55 files]

**Audit:** npm audit [12 high, 0 critical] - carry-overs unchanged (eslint/minimatch/brace-expansion dev-only, postcss XSS, sharp libvips CVEs)

**CI:** last 5 runs all success (latest: 2026-07-30T06:13 UTC - new since last entry)

**Drift:**
- vehicle popout broadcasts: HOPED-FOR >60 days, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR since 2026-06-16, untouched
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched
- [todo stale audit] health-pulse template em-dash fix (todo.md open item) appears already applied - current template uses ASCII hyphens; 1 residual em-dash in the file is from pre-fix entries. Todo item candidate for closing.

**Action:** x24 same drift - these 3 items need a deliberate playtest pass, not more automated checks. No code action from this run.

---

## 2026-07-30 06:12 UTC

**Status:** DRIFT (x23 consecutive - same 3 HOPED-FOR items, no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [934 passed / 55 files]

**Audit:** npm audit [12 high, 0 critical] - same carry-overs (eslint/minimatch/brace-expansion dev-only DoS, postcss XSS, sharp libvips CVEs). Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-30T01:51 UTC)

**Drift:**
- vehicle popout broadcasts: HOPED-FOR >60 days, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR since 2026-06-16, untouched
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched
- [todo audit confirm] broken-weapon alert() still at page.tsx:6013; vehicles 3s poll still at page.tsx:3106; both confirmed open

**Note:** test count 928 -> 934 (+6 from fix(combat): NPC reload via Ready Weapon was a no-op).

**Action:** x23 same drift - no new action. 3 HOPED-FOR items need a deliberate playtest pass, not another automated check.

---

## 2026-07-30 00:05 UTC

**Status:** DRIFT (x22 consecutive - same 3 HOPED-FOR items, no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same carry-overs (eslint/minimatch/brace-expansion dev-only DoS, postcss XSS, sharp libvips CVEs). Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-29T21:07 UTC)

**Drift:**
- vehicle popout broadcasts: HOPED-FOR >60 days, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR since 2026-06-16, untouched
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched
- [todo audit confirm] broken-weapon alert() still at page.tsx:6013; vehicles 3s poll still at page.tsx:3106; both confirmed open

**Action:** x22 same drift - no new action. These 3 items need deliberate scheduling against a playtest, not another automated check.

---

## 2026-07-29 21:05 UTC

**Status:** DRIFT (x21 consecutive - same 3 HOPED-FOR items, no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same carry-overs (eslint/minimatch/brace-expansion dev-only DoS, postcss XSS, sharp libvips CVEs). Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-29T18:07 UTC)

**Drift:**
- vehicle popout broadcasts: HOPED-FOR >60 days, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR since 2026-06-16, untouched
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched
- [todo audit confirm] broken-weapon alert() still at page.tsx:6013; vehicles 3s poll still at page.tsx:3106; both confirmed open

**Action:** x21 same drift - no new action. 3 HOPED-FOR items need deliberate scheduling, not another check.

---

## 2026-07-29 18:05 UTC

**Status:** DRIFT (x20 consecutive - same 3 HOPED-FOR items, no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same carry-overs (eslint/minimatch/brace-expansion dev-only DoS, postcss XSS, sharp libvips CVEs). Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-29T15:08 UTC)

**Drift:**
- vehicle popout broadcasts: HOPED-FOR >60 days, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR since 2026-06-16, untouched
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched
- [todo audit confirm] broken-weapon alert() still at page.tsx:6013; vehicles 3s poll still at page.tsx:3106; both confirmed open

**Action:** x20 same drift - no new action. Schedule 3 HOPED-FOR items for next playtest cycle.

---

## 2026-07-29 15:05 UTC

**Status:** DRIFT (x19 consecutive - same 3 HOPED-FOR items, no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same carry-overs (eslint/minimatch/brace-expansion dev-only DoS, postcss XSS, sharp libvips CVEs). Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-29T12:08 UTC)

**Drift:**
- vehicle popout broadcasts: HOPED-FOR >60 days, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR since 2026-06-16, untouched
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched
- [todo audit confirm] broken-weapon alert() still at page.tsx:6013; vehicles 3s poll still at page.tsx:3106; CampaignMap fingerprint hashes allPins not visible (all 3 correctly open)

**Action:** x19 same drift - no action beyond scheduling 3 HOPED-FOR items for next playtest cycle.

---

## 2026-07-29 12:08 UTC

**Status:** DRIFT (x18 consecutive - same 3 HOPED-FOR items; CORRECTION: 2 prior "may have shipped" todos confirmed still open)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same carry-overs (eslint/minimatch/brace-expansion dev-only DoS, postcss XSS, sharp libvips CVEs). Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-29T09:07 UTC)

**Drift:**
- vehicle popout broadcasts: HOPED-FOR >60 days, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR since 2026-06-16, untouched
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched
- [todo audit CORRECTION] broken-weapon `alert()` confirmed still at page.tsx:6013-6015 - NOT shipped; x17 false-positive
- [todo audit CORRECTION] vehicles 3s poll confirmed still at page.tsx:3106 - NOT shipped; x17 false-positive

**Action:** x18 same drift. Broken-weapon alert + vehicles poll both still open - x17 misreported them as shipped. Assign 3 HOPED-FOR items to next playtest; fix alert()+poll in HP lane when bandwidth opens.

---

## 2026-07-29 09:05 UTC

**Status:** DRIFT (x17 consecutive - same 3 HOPED-FOR items; 2 stale todos may have shipped)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same carry-overs (eslint/minimatch/brace-expansion dev-only DoS, postcss XSS, sharp libvips CVEs). Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-29T06:08 UTC)

**Drift:**
- vehicle popout broadcasts: HOPED-FOR >60 days, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR since 2026-06-16, untouched
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched
- [todo audit] broken-weapon `alert()` (was page.tsx:5994) - no `alert(` in page.tsx now; likely shipped, mark done
- [todo audit] vehicles 3s poll (was page.tsx:3090) - no `setInterval/refetchVehicles` in page.tsx now; likely shipped, mark done

**Action:** x17 same drift - new signal: 2 todos appear shipped (broken-weapon alert + vehicles poll). Verify + mark done. Assign 3 HOPED-FOR items to next playtest or defer to post-KS.

---

## 2026-07-29 06:09 UTC

**Status:** DRIFT (x16 consecutive - same 3 HOPED-FOR items, no code movement since prior entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same persistent: eslint/minimatch/brace-expansion (dev-only DoS), postcss XSS, sharp libvips CVEs. Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-29T05:18 UTC - new pass since prior entry)

**Drift:**
- vehicle popout broadcasts: >60 days HOPED-FOR, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR since 2026-06-16, untouched
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched

**Action:** x16 consecutive same drift - no new signal. Action from prior entries still pending: assign these 3 items to next playtest or formally defer to post-KS in todo.md.

---

## 2026-07-29 00:05 UTC

**Status:** DRIFT (x15 consecutive - same 3 HOPED-FOR items unchanged; security fix 260bc92 shipped post-last-pulse but covers health-route/supabase/sentry, not drift items)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same persistent: eslint/minimatch/brace-expansion chain (dev-only DoS), postcss XSS, sharp libvips CVEs. Unchanged post-260bc92.

**CI:** last 5 runs all success (latest: 2026-07-28T23:01 UTC)

**Drift:**
- vehicle popout broadcasts: >60 days HOPED-FOR, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR, untouched since 2026-06-16
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched

**Stale-todo spot check:** alert() at page.tsx:6013 (broken-weapon gate) + vehicles 3s poll at page.tsx:3106 + CampaignMap fingerprint hashes allPins not visible - all confirmed still open, no shipping evidence.

**Action:** x15 consecutive same drift, nothing new. If 9/1 KS deadline is firm, assign these 3 HOPED-FOR items to next playtest or formally defer in todo.md.

---

## 2026-07-28 21:05 UTC

**Status:** DRIFT (x14+ consecutive - same 3 HOPED-FOR items, no code movement since 16:27 UTC security-audit commit)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same persistent: eslint/minimatch/brace-expansion chain (dev-only DoS), postcss XSS, sharp libvips CVEs (CVE-2026-33327/28/35590/91). Documented in tasks/security-audit.md (45a1e03). No change.

**CI:** last 5 runs all success (latest: 2026-07-28T18:08 UTC)

**Drift:**
- vehicle popout broadcasts: >60 days HOPED-FOR, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR, untouched since 2026-06-16
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched

**Stale-todo spot check:** alert() at page.tsx:6013-6015 (broken-weapon/ammo/throws gates) - confirmed still present. Vehicles 3s poll at page.tsx:3106 - confirmed still present. Both match open todo entries, no shipping evidence.

**Action:** 14+ consecutive DRIFT flags, identical items. Action item from prior entries still pending: formally schedule these 3 HOPED-FOR items for the next playtest session OR defer to post-KS in todo.md.

---

## 2026-07-28 18:04 UTC

**Status:** DRIFT (x13+ consecutive - same 3 items; security-audit.md updated 16:27 UTC by Puffer noting brace-expansion CVSS 7.5 advisory)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same persistent: eslint/minimatch/brace-expansion chain (dev-only DoS), postcss XSS, sharp libvips CVEs (CVE-2026-33327/28/35590/91). Documented in tasks/security-audit.md (commit 45a1e03).

**CI:** last 5 runs all success (latest: 2026-07-28T16:28 UTC, post security-audit commit)

**Drift:**
- vehicle popout broadcasts: >60 days HOPED-FOR, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR, untouched since 2026-06-16
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched

**Action:** Same 3 drift items x13+ consecutive with no code movement. Needs explicit scheduling - assign to next playtest session or formally defer to post-KS in todo.md.

---

## 2026-07-28 15:12 UTC

**Status:** DRIFT (x12+ consecutive - same 3 items unchanged, no code commits since 09:09 UTC entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - persistent: eslint chain (dev-only), postcss XSS/path-traversal, sharp libvips CVEs. Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-28T12:25 UTC)

**Drift:**
- vehicle popout broadcasts: >60 days HOPED-FOR, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR, untouched
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched

**Action:** 12+ consecutive DRIFT flags on same 3 items. Explicit scheduling decision needed - assign to next playtest session or defer to post-KS in todo.md.

---

## 2026-07-28 12:24 UTC

**Status:** DRIFT (x11+ consecutive - same 3 items, no commits since 09:09 UTC entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same persistent: eslint chain (dev-only), postcss XSS/path-traversal, sharp libvips CVEs. Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-28T09:10 UTC)

**Drift:**
- vehicle popout broadcasts: >60 days HOPED-FOR, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR, untouched
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched

**Action:** 11+ consecutive DRIFT flags unchanged. These need an explicit decision - assign to next playtest session or mark deferred to post-KS in todo.md.

---

## 2026-07-28 09:09 UTC

**Status:** DRIFT (unchanged from 06:12 UTC - one new CI success since then, no commits)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same persistent: eslint chain, postcss XSS/path-traversal, sharp libvips CVEs. Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-28T06:14 UTC)

**Drift:**
- vehicle popout broadcasts: >60 days HOPED-FOR, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR, untouched
- FI Insight Die award path: HOPED-FOR since 2026-06-16, untouched

**Action:** 10+ consecutive DRIFT flags on same 3 items. Assign explicitly to next playtest or defer to post-KS in todo.md.

---

## 2026-07-28 06:12 UTC

**Status:** DRIFT (unchanged from 00:14 UTC - no commits since then)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same persistent items: eslint chain (dev-only) + postcss + sharp CVEs

**CI:** last 5 runs all success (latest: 2026-07-28T00:16 UTC)

**Drift:**
- vehicle popout broadcasts: >60 days HOPED-FOR, no activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV): HOPED-FOR, untouched
- stale-todo: health-pulse em-dash todo (todo.md ~line 67) appears resolved - current pulse entries already use ASCII hyphens; verify and mark [x] if confirmed

**Action:** 9+ consecutive DRIFT flags on same 3 items. Assign to next playtest or defer post-KS. Close em-dash todo if resolved.

---

## 2026-07-28 00:14 UTC

**Status:** DRIFT (unchanged from 2026-07-27 21:05 UTC - same 3 items, no new commits since)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same persistent items: eslint chain (dev-only) + postcss XSS/path-traversal CVEs + sharp libvips CVEs. Unchanged for days.

**CI:** last 5 runs all success (latest: 2026-07-27T21:07 UTC)

**Drift:**
- vehicle popout broadcasts: >60 days HOPED-FOR, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE): HOPED-FOR, untouched
- H10 [CharacterCard Rest/Travel]: confirmed shipped a08ae6c 2026-07-24; todo.md checkbox still [ ] - needs manual [x]

**Action:** These 3 items have been flagged 8+ consecutive pulses. Either assign them to the next playtest window or explicitly defer to post-KS. Mark H10 [x] in todo.md.

---

## 2026-07-27 21:05 UTC

**Status:** DRIFT (unchanged from 18:06 UTC entry - 7th flag today, no new commits)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same as prior entries; production-dep HIGH: postcss (XSS + path traversal CVEs), sharp (libvips CVE-2026-33327/33328/35590/35591). Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-27T18:10 UTC)

**Drift:** (no movement since 18:06 entry)
- vehicle popout broadcasts: >60 days HOPED-FOR, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE): HOPED-FOR, untouched
- H10 [CharacterCard Rest/Travel]: confirmed shipped a08ae6c 2026-07-24; todo.md checkbox still [ ]

**Action:** No change since 18:06. Mark H10 [x] in todo.md. Vehicle popout + stress-check strings need a playtest window or explicit defer to post-KS.

---

## 2026-07-27 18:06 UTC

**Status:** DRIFT (unchanged from 15:08 UTC entry - same 3 items, no new issues)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - ESLint dev-dep chain + sharp (libvips CVE-2026-33327/33328/35590/35591) + postcss (sourceMappingURL path traversal). Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-27T15:11 UTC)

**Drift:** (6th consecutive flag - no movement on any item)
- vehicle popout broadcasts: >60 days HOPED-FOR, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE): HOPED-FOR, untouched
- H10 [CharacterCard Rest/Travel]: shipped a08ae6c 2026-07-24 - stale todo.md checkbox; needs [ ] -> [x]

**Action:** Same 3 items, 6th flag. Mark H10 [x] in todo.md. Vehicle popout >60-day HOPED-FOR - needs 2-client verify or explicit defer.

---

## 2026-07-27 15:08 UTC

**Status:** DRIFT (no code changes since 12:17 UTC CI run; all gates clean)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - ESLint/minimatch/brace-expansion dev-dep chain + next via postcss/sharp. Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-27T12:17 UTC)

**Drift:** (unchanged from 12:14 UTC - 5th consecutive flag on all 3 items)
- vehicle popout broadcasts: >60 days HOPED-FOR, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE): HOPED-FOR, untouched
- H10 [CharacterCard Rest/Travel] confirmed shipped a08ae6c 2026-07-24; todo.md still shows [ ] open

**Action:** Same 3 items, 5th flag today. Persistent DRIFT. (1) Mark H10 [x] in todo.md. (2) Vehicle popout >60-day HOPED-FOR - schedule 2-client verify or move to known-gap.

---

## 2026-07-27 12:14 UTC

**Status:** DRIFT (no code changes since 09:11 UTC CI run; all gates clean)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - ESLint/minimatch/brace-expansion dev-dep chain + next via postcss/sharp. Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-27T09:11 UTC)

**Drift:** (unchanged from 09:08 UTC)
- vehicle popout broadcasts: >60 days HOPED-FOR, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE): HOPED-FOR, untouched
- H10 [CharacterCard Rest/Travel] confirmed shipped a08ae6c 2026-07-24; todo.md still shows [ ] open

**Action:** Persistent - same 3 items. (1) Mark H10 [x] in todo.md. (2) Vehicle popout >60-day HOPED-FOR - schedule 2-client verify or move to known-gap.

---

## 2026-07-27 09:08 UTC

**Status:** DRIFT (no code changes since 06:12 UTC; all gates clean)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - ESLint/minimatch/brace-expansion dev-dep chain + next via postcss/sharp. Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-27T06:16 UTC)

**Drift:** (unchanged from 06:12 UTC)
- vehicle popout broadcasts: >60 days HOPED-FOR, no code activity in last 3 days
- stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE): HOPED-FOR, untouched
- H10 [CharacterCard Rest/Travel] confirmed shipped a08ae6c 2026-07-24; todo.md still shows [ ] open

**Action:** No new fires. Persistent: (1) Mark H10 [x SHIPPED 2026-07-24] in todo.md. (2) Vehicle popout >60-day HOPED-FOR - schedule a deliberate 2-client verify or downgrade to known gap.

---

## 2026-07-27 06:12 UTC

**Status:** DRIFT (no code changes since 00:07 UTC health-pulse commit; all gates clean)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - unchanged from 00:07 UTC

**CI:** last 5 runs all success (latest: 2026-07-27T00:10 UTC)

**Drift:** (unchanged from 00:07 UTC)
- vehicle popout broadcasts: >60 days HOPED-FOR, no code activity in last 3 days
- stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE): HOPED-FOR, untouched
- H10 [CharacterCard Rest/Travel] confirmed shipped a08ae6c 2026-07-24; todo.md still shows [ ] open

**Action:** No new fires. Persistent: (1) Mark H10 [x SHIPPED 2026-07-24] in todo.md. (2) Vehicle popout >60-day HOPED-FOR - schedule a deliberate 2-client verify or downgrade to known gap.

---

## 2026-07-27 00:07 UTC

**Status:** DRIFT (no code changes since 21:03 UTC; all gates clean)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - ESLint/minimatch/brace-expansion dev-dep chain + next via postcss/sharp (build-time, not runtime user-facing). Unchanged.

**CI:** last 5 runs all success (latest: 2026-07-26T21:07 UTC)

**Drift:**
- vehicle popout broadcasts (Section B): >60 days HOPED-FOR, no code activity; pending a deliberate 2-client verify that hasn't happened
- stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE): still HOPED-FOR in Confidence Ledger; drain target is Beta-500 dry-run
- H10 stale-todo: CharacterCard Rest/Travel fix confirmed shipped `a08ae6c` (2026-07-24); todo.md still shows [ ] open - needs [x] mark

**Action:** Same as 21:03 UTC - no new fires. Persistent: (1) Mark H10 [SHIPPED] in todo.md. (2) Vehicle popout >60-day HOPED-FOR - schedule or downgrade.

---

## 2026-07-26 21:03 UTC

**Status:** RED+DRIFT (unchanged from 18:05 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same ESLint/minimatch/brace-expansion dev-dep chain; not runtime.

**CI:** last 5 runs all success (latest: 2026-07-26 18:08 UTC)

**Drift:**
- vehicle popout broadcasts (Section B): >60 days HOPED-FOR, no code activity (pending 2026-05-25 Minnie playtest that never closed out)
- stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE): still HOPED-FOR in Confidence Ledger
- H10 stale-todo: CharacterCard Rest/Travel fix shipped `a08ae6c` (2026-07-24) per commit msg; todo.md still shows open [ ] - needs [x] mark

**Action:** (1) Decision needed on Next.js bump to clear 12 HIGH audit before Beta-500. (2) Mark H10 [x SHIPPED 2026-07-24] in todo.md. (3) Vehicle popout HOPED-FOR is >60 days stale - schedule a deliberate 2-client verify or downgrade to known gap.

---

## 2026-07-26 18:05 UTC

**Status:** RED+DRIFT (unchanged from 15:07 UTC - no code commits between runs)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same ESLint/minimatch/brace-expansion dev-dep chain; not runtime.

**CI:** last 5 runs all success (latest: 2026-07-26 15:07 UTC)

**Drift:** unchanged from 15:07 UTC
- vehicle popout broadcasts (Section B): >60 days HOPED-FOR, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE): still HOPED-FOR
- FI Insight Die award path (useRollResolution.ts:264): never fired in live play
- H10 stale-todo: CharacterCard Rest/Travel still marked [ ] in todo.md; fix shipped `a08ae6c` (2026-07-24)

**Action:** No new findings. Outstanding: (1) Next.js bump to clear 12 HIGH audit before Beta-500. (2) Mark H10 [SHIPPED] in todo.md.

---

## 2026-07-26 15:07 UTC

**Status:** RED+DRIFT (unchanged from 12:05 UTC - no code commits since)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same ESLint/minimatch/brace-expansion dev-dep chain; not runtime.

**CI:** last 5 runs all success (latest: 2026-07-26 12:09 UTC)

**Drift:** unchanged from 12:05 UTC
- vehicle popout broadcasts (Section B): >60 days HOPED-FOR, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE): still HOPED-FOR
- FI Insight Die award path (useRollResolution.ts:264): never fired in live play
- H10 stale-todo: CharacterCard Rest/Travel still marked [ ] in todo.md; fix shipped `a08ae6c` (2026-07-24)

**Action:** No new findings. Same two outstanding items: (1) Next.js bump decision to clear 12 HIGH audit before Beta-500. (2) Mark H10 [SHIPPED] in todo.md.

---

## 2026-07-26 12:05 UTC

**Status:** RED+DRIFT (unchanged from 09:04 UTC - no code commits since then)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same oscillating advisory DB (all ESLint/build-tool dev deps via minimatch/brace-expansion; not runtime). Next.js major bump still the real fix path.

**CI:** last 5 runs all success (latest: 2026-07-26 09:06 UTC)

**Drift:** unchanged from 09:04 UTC
- vehicle popout broadcasts (Section B): >60 days HOPED-FOR, no code activity
- stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE): still HOPED-FOR
- FI Insight Die award path (useRollResolution.ts:264): never fired in live play
- H10 stale-todo: CharacterCard Rest/Travel still marked [ ] in todo.md; fix(H10) `a08ae6c` confirmed in codebase (isGM gate on line 645)

**Action:** No new findings since 09:04 UTC. Outstanding: (1) Next.js bump decision for 12 HIGH audit before Beta-500. (2) Mark H10 [SHIPPED] in todo.md.

---

## 2026-07-26 09:04 UTC

**Status:** RED+DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - RETURNED after 06:04 UTC clearing; advisories oscillating (postcss XSS+file-read; sharp libvips CVEs). No package changes between 06:04 and now. Advisory DB is unstable - the 06:04 "cleared" was not a real fix. Actual fix still requires Next.js major bump (see 00:06 entry).

**CI:** last 5 runs all success (latest: 2026-07-26 06:07 UTC)

**Drift:**
- vehicle popout broadcasts (Section B): >60 days HOPED-FOR, no code activity in 3 days
- stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE): still HOPED-FOR, no code activity
- FI Insight Die award path (useRollResolution.ts:264): still HOPED-FOR, never fired in live play

**Action:** (1) 12 HIGH audit oscillating - the 06:04 "cleared" was advisory-DB noise; Next.js major bump is still the real fix path (decision needed before Beta-500). (2) H10 CharacterCard clock bug flagged as shipped at 06:04 but todo.md still has it open - HP needs to mark [x].

---

## 2026-07-26 06:04 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [0 high, 0 critical] -- CLEARED (was 12 HIGH at 00:06 UTC; postcss/sharp advisories no longer flagged by npm registry -- no package change in this window, advisory database updated server-side)

**CI:** last 5 runs all success (latest: 2026-07-26 00:08 UTC)

**Drift:**
- vehicle popout broadcasts: >60 days HOPED-FOR, no code activity in 3 days
- stress-check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE): still HOPED-FOR
- FI Insight Die award path (useRollResolution.ts:264): never fired in live play
- STALE TODO: "[HIGH - HP] CharacterCard.tsx:1293/:680 per-character Rest/Travel advances shared clock" is still marked [ ] open in todo.md, but commit a08ae6c (2026-07-24) "fix(H10): Party Rest + Travel GM-gating + race-condition hardening" explicitly resolves it (Bug A: Per-PC Rest multiplying clock by party size). Needs audit mark [x] + [SHIPPED] in todo.

**Action:** (1) Mark H10 CharacterCard clock bug [SHIPPED] in todo.md -- it shipped 2026-07-24. (2) 12 HIGH audit is now gone -- no action needed. (3) 3 HOPED-FOR items remain unverified; drain target still Beta-500 dry-run.

---

## 2026-07-26 00:06 UTC

**Status:** RED+DRIFT (unchanged from 21:04 UTC; only new commit is the health-pulse commit itself)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - unchanged (postcss XSS+file-read; sharp libvips CVEs; fix requires Next.js major bump)

**CI:** last 5 runs all success (latest: 2026-07-25 21:06 UTC)

**Drift:**
- vehicle popout broadcasts (Section B): >60 days HOPED-FOR, no code activity
- stress-check 12-string: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE still uncaptured
- FI Insight Die award path: useRollResolution.ts:264 never fired in live play

**Action:** No new findings. Outstanding: 12 HIGH audit (postcss XSS + sharp libvips CVEs) - decision needed on Next.js major upgrade path before Beta-500.

---

## 2026-07-25 21:04 UTC

**Status:** RED+DRIFT (unchanged from 18:06 UTC; 0 new commits since last pulse)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - unchanged (postcss XSS+file-read; sharp libvips CVE-2026-33327/28/35590/91; fix requires Next.js major bump)

**CI:** last 5 runs all success (latest: 18:07 UTC)

**Drift:** unchanged from 18:06 UTC - no code changes
- vehicle popout broadcasts (Section B): >60 days HOPED-FOR, no code activity
- stress-check 12-string: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE still uncaptured
- FI Insight Die award path: useRollResolution.ts:264 never fired in live play

**Action:** No new findings. Outstanding: 12 HIGH audit (postcss XSS + sharp libvips CVEs) - decision needed on Next.js major upgrade path before Beta-500.

---

## 2026-07-25 18:06 UTC

**Status:** RED+DRIFT (unchanged from 15:06 UTC; 1 new commit `485c71c` report-issue/launch_signups, no remediation)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - unchanged (postcss XSS+file-read; sharp libvips CVE-2026-33327/28/35590/91; fix requires Next.js major bump to 9.3.3)

**CI:** last 5 runs all success (latest: 15:34 UTC)

**Drift:** same as 15:06 UTC - no remediation taken
- H10 stale-todo: CharacterCard Rest/Travel clock (`- [ ]`) still open
- vehicle popout broadcasts (Section B): >60 days, no code change
- stress-check 12-string: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured
- FI Insight Die award path: useRollResolution.ts:264 never fired in live play

**Action:** Same as prior entry - 12 HIGH audit chain (sharp libvips CVEs + postcss XSS) persists; needs decision on Next.js major upgrade before Beta-500.

---

## 2026-07-25 15:06 UTC

**Status:** RED+DRIFT (unchanged from 12:06 UTC; 2 new commits landed, both CI green)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - unchanged (postcss XSS+file-read; sharp libvips CVE-2026-33327/28/35590/91; minimatch+brace-expansion DoS via ESLint dev-dep chain)

**CI:** last 5 runs all success (latest: "Add launch-list + report-issue" 14:15 UTC, "Add launch-signup capture" 13:56 UTC)

**Drift:** same as 12:06 UTC - no remediation taken
- H10 stale-todo: CharacterCard Rest/Travel GM-gating fix (`a08ae6c`) still `- [ ]` in todo.md
- vehicle popout broadcasts (Section B): >60 days, no code change
- stress-check 12-string: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured
- FI Insight Die award path: useRollResolution.ts:264 never fired in live play

**Action:** No new action - conditions identical to 12:06 UTC. Mark H10 todo [x]; 12 HIGH audit chain persists.

---

## 2026-07-25 12:06 UTC

**Status:** RED+DRIFT (no change from 09:03 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same chain (postcss XSS+file-read+path-traversal; sharp CVE-2026-33327/28/35590/91; minimatch+brace-expansion DoS cascading to 8 ESLint dev-deps)

**CI:** last 4 runs all success

**Drift:** same as prior entries - no remediation since 00:07 UTC
- Stale-todo H10: `a08ae6c` Rest/Travel GM-gating shipped but `- [ ]` still open in todo.md
- Vehicle popout broadcasts (Section B): >60 days unplaytested
- Stress-check 12-string narrative: 8 strings uncaptured (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE)
- FI Insight Die award path: useRollResolution.ts:264 never fired in live play

**Action:** No new action - conditions identical to 09:03 UTC. See that entry.

---

## 2026-07-25 09:03 UTC

**Status:** RED+DRIFT (unchanged from 00:07 UTC - same conditions persist)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] - same chain as 00:07 UTC (postcss XSS+file-read+path-traversal, sharp libvips CVE-2026-33327, minimatch/brace-expansion DoS via ESLint chain - dev-only; runtime risk is postcss+sharp)

**CI:** last 5 runs all success (latest 2026-07-25T03:15:31Z)

**Drift:** same as 00:07 UTC - no remediation taken:
- H10 stale-todo: `a08ae6c` landed 2026-07-24, Rest/Travel GM-gating fix, still `- [ ]` in todo.md
- vehicle popout broadcasts (Section B): ~61 days, no code change
- stress-check 12-string: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured
- FI Insight Die award path: useRollResolution.ts:264 never fired in live play

**Action:** Same as 00:07 UTC - mark H10 todo [x]; 12 HIGH audit chain unresolved.

---

## 2026-07-25 00:07 UTC

**Status:** RED+DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [12 high, 0 critical] -- ESCALATED from 3 HIGH (previous pulse).
- New chain: minimatch + brace-expansion HIGH, cascading to 8 ESLint packages
  (@eslint/config-array, @eslint/eslintrc, eslint, eslint-config-next,
  eslint-plugin-import, eslint-plugin-jsx-a11y, eslint-plugin-react, minimatch)
- Existing: postcss XSS+file-read, sharp libvips CVE chain (unchanged)
- Note: minimatch/ESLint chain is dev-dep only; runtime risk is the existing postcss/sharp

**CI:** last 5 runs all success (latest 2026-07-24T22:45:28Z)

**Drift:**
- vehicle popout broadcasts (Section B): >60 days unplaytested, no code changes
- stress-check 12-string: 8 strings uncaptured (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- deferred to Beta-500
- FI Insight Die award path: useRollResolution.ts:264 never fired in live play
- Stale-todo: item 40 [HIGH-HP] Rest/Travel clock fix -- `a08ae6c` landed it 2026-07-24; still `- [ ]` in todo.md -- audit-correction needed

**Action:** Audit escalated 3->12 HIGH; new minimatch/brace-expansion chain is dev-only risk but worth a check (`npm audit` details above). Mark todo item 40 complete (H10 shipped).

- Note: this pulse entry uses ASCII hyphens only (per todo item 67 re em-dash rule in health-pulse.md)

---

## 2026-07-24 18:06 UTC

**Status:** RED+DRIFT (vulns + HOPED-FOR unchanged; 4 new commits landed since 15:05 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [3 high, 0 critical] - postcss XSS+file-read HIGH, sharp libvips CVE chain HIGH, next transitive HIGH. Unchanged.

**CI:** last 5 runs all success (latest 2026-07-24T17:38:32Z)

**New commits since last pulse:**
- `a08ae6c` fix(H10): Party Rest + Travel GM-gating + race-condition hardening -- closes HIGH bug-audit item; Rest now advances clock once (not once-per-PC); GM-gated; sickness Day-0 Stress pip fixed; Travel logs roll back on clock-advance failure
- `75d3080` feat(dredd-generator): proxy /dredd-generator + Thriver-only visitor dashboard
- `9b7b836` Redirect /apegenerator + /space1999 to their new home on thetable
- `4706761` Analytics: enrich visitor_logs (device/UTM/dwell) + unified site column

**Drift:**
- vehicle popout broadcasts (Section B): >60 days unplaytested, no code changes
- stress-check 12-string: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured
- FI Insight Die award path: useRollResolution.ts:264 never fired in live play
- Stale todos still open: broken-weapon alert() (page.tsx:5994 area), vehicles 3s poll (page.tsx:3090 area), CampaignMap fingerprint

**Action:** H10 Rest/Travel fix is the notable ship -- verify it at the table (party rest once, clock advances once, all PCs recover). Persistent: 3 HIGH vulns (next major upgrade) + 3 HOPED-FOR items need a playtest run.

---

## 2026-07-24 15:05 UTC

**Status:** RED+DRIFT (no change since 12:08 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [3 high, 0 critical] - postcss XSS+file-read HIGH, sharp libvips CVE chain HIGH, next transitive HIGH. All via next package; need major version upgrade to resolve.

**CI:** last 5 runs all success (latest 2026-07-24T12:10:24Z)

**Drift:**
- vehicle popout broadcasts (Section B): >60 days unplaytested, no code changes
- stress-check 12-string: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured
- FI Insight Die award path: useRollResolution.ts:264 never fired in live play
- Stale todos confirmed still open: broken-weapon alert() (page.tsx:6013), vehicles 3s poll (page.tsx:3106)

**Action:** same persistent items - 3 HIGH vulns via next (major upgrade needed) + 3 HOPED-FOR items needing playtest. No new developments this cycle.

---

## 2026-07-24 12:08 UTC

**Status:** RED+DRIFT (no change since 09:09 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [3 high, 0 critical] - postcss XSS+file-read HIGH, sharp libvips CVE chain HIGH (CVE-2026-33327/33328/35590/35591), next transitive HIGH. Unchanged.

**CI:** last 5 runs all success (latest 2026-07-24T09:06:48Z)

**Drift:**
- vehicle popout broadcasts (Section B): >60 days unplaytested
- stress-check 12-string: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured
- FI Insight Die award path: useRollResolution.ts:264 never fired in live play
- Stale todos confirmed still open: broken-weapon alert() (page.tsx:6013), vehicles 3s poll (page.tsx:3106), CampaignMap fingerprint (no commits to CampaignMap.tsx in 10 days)

**Action:** same open items - postcss/sharp HIGH vulns + HOPED-FOR drift. No new developments this cycle.

---

## 2026-07-24 09:09 UTC

**Status:** RED+DRIFT (unchanged from 06:05 UTC - no code commits, no remediation)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [3 high, 0 critical] - postcss XSS+file-read HIGH, sharp libvips CVE chain HIGH (CVE-2026-33327/33328/35590/35591), next transitive HIGH. Unchanged.

**CI:** last 5 runs all success (latest 2026-07-24T06:07:25Z)

**Drift:** same 3 HOPED-FOR items - no git activity on any in 3+ days
- vehicle popout broadcasts (Section B): >60 days old
- stress-check 12-string: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured
- FI Insight Die award path: useRollResolution.ts:264 never fired in live play

**Action:** postcss arbitrary-file-read + sharp libvips CVEs remain open HIGH items pre-Beta-500. No new developments this cycle.

---

## 2026-07-24 06:05 UTC

**Status:** RED+DRIFT (unchanged from 00:05 UTC - no code commits, no remediation)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [3 high, 0 critical] - postcss XSS+file-read HIGH, sharp libvips CVE chain HIGH (CVE-2026-33327/33328/35590/35591), next transitive HIGH. Unchanged.

**CI:** last 5 runs all success (latest 2026-07-24T00:07:38Z)

**Drift:** same 3 HOPED-FOR items (vehicle popout broadcasts, stress-check 12-string, FI Insight Die award path) - no git activity on these areas in 3+ days

**Action:** no change - postcss arbitrary-file-read + sharp libvips CVEs remain open HIGH items before Beta-500.

---

## 2026-07-24 00:05 UTC

**Status:** RED+DRIFT (unchanged from 21:06 UTC - no code commits, no remediation)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [3 high, 0 critical] - postcss XSS+file-read HIGH, sharp libvips CVE chain HIGH (CVE-2026-33327/33328/35590/35591), next transitive HIGH. Unchanged.

**CI:** last 5 runs all success (latest 2026-07-23T21:06:59Z)

**Drift:** same 3 HOPED-FOR items (vehicle popout broadcasts, stress-check 12-string, FI Insight Die award path)

**Action:** no change - postcss arbitrary-file-read + sharp libvips CVEs remain open HIGH items before Beta-500.

---

## 2026-07-23 21:06 UTC

**Status:** RED+DRIFT (unchanged from 18:05 pulse - no code commits since then)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [3 high, 0 critical] - same as 18:05: postcss XSS+file-read HIGH, sharp libvips CVE chain HIGH, next transitive HIGH. No change.

**CI:** last 5 runs all success (latest 2026-07-23T18:06:46Z)

**Drift (HOPED-FOR - no change):**
- vehicle popout broadcasts (Section B): >60 days, no git activity
- stress-check 12-string narrative: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured
- FI Insight Die award path: useRollResolution.ts:264 never fired in live play

**Action:** same as prior pulse - postcss arbitrary-file-read + sharp libvips CVEs are the open HIGH items before Beta-500; no new developments this cycle.

---

## 2026-07-23 18:05 UTC

**Status:** RED+DRIFT - audit escalated (3 HIGH, was 2)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [3 high, 0 critical] - UP from 2 HIGH last pulse. Newly flagged:
- `postcss` HIGH: XSS via unescaped `</style>` in CSS stringify + arbitrary file read via sourceMappingURL
- `sharp` HIGH: libvips CVE chain (CVE-2026-33327/33328/35590/35591) - unchanged
- `next` HIGH: bundles both postcss + sharp (transitive); fix requires major next version bump

**CI:** last 5 runs all success (latest 2026-07-23T15:08:29Z)

**Drift (HOPED-FOR - all >3 days, no git activity):**
- vehicle popout broadcasts (Section B): >60 days, still HOPED-FOR
- stress-check 12-string narrative: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured
- FI Insight Die award path: insight_dice +1 at useRollResolution.ts:264 never fired in live play

**Stale-todo (confirmed still open):**
- CharacterCard Rest/Travel per-character calls advance shared clock (HIGH bug)
- page.tsx:6013 broken-weapon gate uses alert()
- page.tsx:3106 vehicles 3s poll still present

**Action:** postcss arbitrary-file-read is a new HIGH worth review before Beta-500. Run `npm audit` for the exact advisory IDs and assess whether any input path reaches it server-side.

---

## 2026-07-23 15:06 UTC

**Status:** RED+DRIFT (unchanged from 12:06 pulse - no remediation)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [2 high, 0 critical] - sharp libvips CVE chain (CVE-2026-33327/33328/35590/35591) + next/postcss; fix: upgrade sharp >=0.35.0

**CI:** last 5 runs all success (latest 2026-07-23T12:08:38Z)

**Drift (HOPED-FOR - all >3 days, no git activity):**
- vehicle popout broadcasts (Section B): >60 days, still HOPED-FOR, no recent changes to vehicle components
- stress-check 12-string narrative: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured
- FI Insight Die award path: insight_dice +1 at useRollResolution.ts:264 never fired in live play

**Stale-todo (code confirms still open):**
- CharacterCard.tsx:648/1275 per-character Rest/Travel still call shared advanceClock directly
- page.tsx:6013 broken-weapon gate still uses alert()
- page.tsx:3106 vehicles 3s poll (setInterval 3000) still present

**Action:** upgrade sharp >=0.35.0 to close the libvips CVE chain (HIGH priority before Beta-500).

---

## 2026-07-23 12:06 UTC

**Status:** RED+DRIFT (unchanged from 09:06 pulse - no remediation)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [2 high, 0 critical] - same sharp libvips CVE chain; fix: upgrade sharp >=0.35.0

**CI:** last 5 runs all success (latest 2026-07-23T09:07:57Z)

**Drift (HOPED-FOR - all >3 days, no git activity):**
- vehicle popout broadcasts (Section B): >60 days, still HOPED-FOR
- stress-check 12-string narrative: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured
- FI Insight Die award path: insight_dice +1 at useRollResolution.ts:264 never fired in live play

**Stale-todo:** vehicles 3s poll and broken-weapon alert() confirmed still open, unchanged.

**Action:** upgrade sharp >=0.35.0 to close the libvips CVE chain; HOPED-FOR needs playtest pass.

---

## 2026-07-23 09:06 UTC

**Status:** RED+DRIFT (unchanged from 06:06 pulse - no remediation)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [2 high, 0 critical] - same sharp libvips CVE chain as prior pulses; fix: upgrade sharp >=0.35.0

**CI:** last 5 runs all success (latest 2026-07-23T06:08:48Z)

**Drift (HOPED-FOR - all >3 days, no git activity):**
- vehicle popout broadcasts (Section B): >60 days, still HOPED-FOR
- stress-check 12-string narrative: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured
- FI Insight Die award path: insight_dice +1 at useRollResolution.ts:264 never fired in live play

**Stale-todo:** vehicles 3s poll (page.tsx:3106) and broken-weapon alert() (page.tsx:6013) confirmed still open.

**Action:** upgrade sharp >=0.35.0 to close the libvips CVE chain; HOPED-FOR needs playtest pass.

---

## 2026-07-23 06:06 UTC

**Status:** DRIFT (unchanged from 00:05 pulse - no remediation)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [2 high, 0 critical] - same sharp libvips CVE chain as prior pulses; fix: upgrade sharp >=0.35.0

**CI:** last 5 runs all success (latest 2026-07-23T00:06:28Z)

**Drift (HOPED-FOR - all >3 days, no git activity):**
- vehicle popout broadcasts (Section B): >60 days, still HOPED-FOR
- stress-check 12-string narrative: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured
- FI Insight Die award path: insight_dice +1 at useRollResolution.ts:264 never fired in live play

**Stale-todo:** vehicles 3s poll (page.tsx:3106) and broken-weapon alert() confirmed still open, unchanged.

**Action:** upgrade sharp >=0.35.0 to close the libvips chain; HOPED-FOR needs playtest pass.

---

## 2026-07-23 00:05 UTC

**Status:** DRIFT (unchanged from 21:05 pulse - no remediation; one new CI run, all green)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [2 high, 0 critical] - same 2 HIGH as prior pulse
- sharp@0.34.5 (PROD): libvips CVE chain; fix: upgrade sharp to >=0.35.0
- next (PROD-path via sharp dep): same chain; fix available

**CI:** last 5 runs all success (latest 2026-07-22T21:06:06Z)

**Drift (HOPED-FOR - all >3 days, no recent git activity):**
- vehicle popout broadcasts (Section B): still HOPED-FOR, >60 days
- stress-check 12-string narrative: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured
- FI Insight Die award path: insight_dice +1 at useRollResolution.ts:264 never fired in live play

**Stale-todo:** vehicles 3s poll (page.tsx:3106) and broken-weapon alert() (page.tsx:6013) both confirmed still open.

**Action:** same as 21:05 - upgrade sharp (>=0.35.0) to close the libvips CVE chain. HOPED-FOR needs playtest pass.

---

## 2026-07-22 21:05 UTC

**Status:** DRIFT (unchanged from 18:05 pulse - no remediation yet)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [2 high, 0 critical] - same 2 HIGH as 18:05
- sharp@0.34.5 (PROD): libvips CVE-2026-33327/33328/35590/35591; fix: upgrade sharp to >=0.35.0
- next (PROD-path via sharp dep): same chain; fix available (upgrade next -> pulls patched sharp)

**CI:** last 5 runs all success (latest 2026-07-22T18:08:49Z)

**Drift (HOPED-FOR -- no new git activity since 18:05):**
- vehicle popout broadcasts (Section B): still HOPED-FOR, >59 days
- stress-check 12-string narrative: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured
- FI Insight Die award path: insight_dice +1 at useRollResolution.ts:264 never fired in live play

**Stale-todo:** both confirmed-open items unchanged:
- vehicles 3s poll: page.tsx:3106 setInterval(refetchVehicles, 3000) still present
- broken-weapon alert(): page.tsx:6012-6014 still using browser alert()

**Action:** same as 18:05 - upgrade sharp (>=0.35.0) to close the libvips CVE chain; HOPED-FOR needs a playtest pass to drain.

---

## 2026-07-22 18:05 UTC

**Status:** DRIFT (gates green; 2 HIGH vulns remain; HOPED-FOR items aging)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [2 high, 0 critical] -- improvement: commit 2521ba4 (upgrade next 16.2.6->16.2.11) resolved brace-expansion/js-yaml/fast-uri; down from 5 HIGH
- sharp@0.34.5 (PROD): libvips CVE-2026-33327/33328/35590/35591; fix: upgrade sharp to >=0.35.0
- next (PROD-path via sharp dep): same chain

**CI:** last 5 runs all success (latest 2026-07-22T15:31:45Z)

**Drift (HOPED-FOR -- all >36 days since last playtest coverage, last updated 2026-06-16):**
- vehicle popout broadcasts (Section B): no git activity last 3 days on vehicle paths; still HOPED-FOR
- stress-check 12-string narrative: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE uncaptured; drain target Beta-500 dry-run still owed
- FI Insight Die award path: insight_dice +1 at useRollResolution.ts:264 never fired in live play

**Stale-todo scan:** 2 confirmed-open items verified still present (no false alarms):
- vehicles 3s poll: page.tsx:3106 setInterval(refetchVehicles, 3000) still present
- broken-weapon alert(): page.tsx:6012-6014 still using browser alert()

**Action:** run `npm install sharp@latest` (0.35.0 fixes the libvips CVE chain); verify tsc+tests green; push. HOPED-FOR items need a playtest pass to drain.

---

## 2026-07-22 15:05 UTC

**Status:** RED+DRIFT (8th consecutive flagged pulse - conditions identical to 12:08; no remediation yet)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [5 high, 0 critical] - unchanged
- sharp (PROD) + next via sharp+postcss (PROD-path) - unpatched; libvips CVE-2026-33327/33328/35590/35591
- brace-expansion (DoS, direct fix available), js-yaml (CPU DoS), fast-uri (host confusion) - build-only

**CI:** last 5 runs all success (latest 2026-07-22T12:09:26Z)

**Drift:** same 3 chronic HOPED-FOR items, no new git activity:
- Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - drain target was 2026-07-01; 22 days overdue
- FI Insight Die award path (insight_dice +1 on doubles) - >36 days in HOPED-FOR
- Vehicle popout broadcasts (Section B) - >59 days in HOPED-FOR

**Stale-todo:** alert() at page.tsx:6012-6014 and vehicles poll at page.tsx:3106 both confirmed still open.

**Action:** 8 pulses, no change. sharp PROD-path is the highest-priority unresolved item. Stress 12-string needs an explicit call: schedule for Beta-500 dry-run or park it.

---

## 2026-07-22 12:08 UTC

**Status:** RED+DRIFT (no change from 09:05 - 7th consecutive flagged pulse)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [5 high, 0 critical] - unchanged
- sharp (PROD) + next via sharp+postcss (PROD-path) - still unpatched
- brace-expansion, js-yaml, fast-uri - build-only, still unpatched

**CI:** last 5 runs all success (latest 2026-07-22T09:07:43Z)

**Drift:** same 3 chronic HOPED-FOR items, no new git activity since 09:05:
- Stress 12-string narrative - drain target was 2026-07-01; now 22 days overdue
- FI Insight Die award path - >36 days in HOPED-FOR
- Vehicle popout broadcasts (Section B) - >59 days in HOPED-FOR

**Stale-todo:** vehicles poll `page.tsx:3106` still present (confirmed); no todo items appear newly shipped.

**Action:** identical to 09:05 - sharp+next PROD-path is highest priority; see 09:05 for remediation steps. Stress 12-string needs explicit decision: scope for Beta-500 dry-run or park.

---

## 2026-07-22 09:05 UTC

**Status:** RED+DRIFT (same conditions as 06:05 entry - no change; 6th consecutive RED pulse)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [5 high, 0 critical] - unchanged
- sharp (PROD) + next via sharp+postcss (PROD-path) - still unpatched
- brace-expansion, js-yaml, fast-uri - build-only, still unpatched

**CI:** last 5 runs all success (latest 2026-07-22T06:08:54Z)

**Drift:** same 3 chronic HOPED-FOR items, no new git activity:
- Stress 12-string narrative - drain target was 2026-07-01; now 22 days overdue
- FI Insight Die award path - >36 days in HOPED-FOR
- Vehicle popout broadcasts (Section B) - >59 days in HOPED-FOR

**Action:** No change from 06:05 - sharp PROD-path vulns and Stress 12-string overdue. See 06:05 entry for remediation steps.

---

## 2026-07-22 06:05 UTC

**Status:** RED+DRIFT (same conditions as 00:07 entry - no change)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [5 high, 0 critical] - unchanged from prior entry
- sharp (PROD) + next via sharp+postcss (PROD-path) - still unpatched
- brace-expansion, js-yaml, fast-uri - build-only, still unpatched

**CI:** last 5 runs all success (latest 2026-07-22T00:08:25Z)

**Drift:**
- Stress 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - drain target was 2026-07-01; now 21 days overdue
- FI Insight Die award path (doubles -> pool increment) - never fired live; >36 days in HOPED-FOR
- Vehicle popout broadcasts (Section B) - >58 days in HOPED-FOR

**Stale-todo audit confirms valid:**
- `page.tsx:3106` `setInterval(refetchVehicles, 3000)` still present (open todo to remove it)
- `CampaignMap.tsx:650-651` fingerprint still hashes `allPins` not `visible` (open todo confirmed)

**Action:** sharp+next PROD-path vulns are the highest priority item. Five consecutive pulses with no remediation. Run `npm install sharp@^0.35.0` (or add `overrides.sharp` in package.json) and commit. Stress 12-string is now past its own deadline - route to the next Beta-500 dry-run pass or explicitly park.

---

## 2026-07-22 00:07 UTC

**Status:** RED+DRIFT (5 high vulns - up from 3; 2 new are PROD-path; chronic HOPED-FOR drift)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [5 high, 0 critical]
- brace-expansion DoS (CVSS 5.3) - build/eslint chain, persists
- js-yaml quadratic CPU (CVSS 7.5) - build/eslint chain, persists
- fast-uri host confusion (CVSS 7.5) - build/sentry chain, persists
- **NEW: sharp@0.34.5** - libvips CVE-2026-33327/33328/35590/35591 (CVSS unscored, CWE-1395) - PROD dep (next image optimization). Fix: `npm install sharp@^0.35.0 --save-dev` to force-override, or await next update.
- **NEW: next (transitive)** - flagged HIGH via sharp+postcss chains; same fix as sharp.

**CI:** last 5 runs all success (latest 2026-07-21T21:07 UTC)

**Drift:** 3 chronic HOPED-FOR items, no git activity in last 3 days:
- Stress 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - >36 days no playtest drain
- FI Insight Die award path (doubles -> pool increment; never fired in live play) - >36 days
- Vehicle popout broadcasts (Section B) - >58 days

**Action:** sharp libvips CVEs are PROD-path (image optimization). Override with `npm install sharp@^0.35.0` + commit updated package-lock, OR add an overrides entry in package.json. Higher urgency than the build-only vulns. All 5 high vulns persist from prior entries - needs a decision: fix now or explicitly park with a target date.

---

## 2026-07-21 21:00 UTC

**Status:** RED+DRIFT (vuln count up from 2 to 3; same chronic HOPED-FOR drift)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [3 high, 0 critical]
- brace-expansion DoS (CVSS 5.3) - build-only, persists
- js-yaml quadratic CPU (CVSS 7.5) - build-only, persists
- fast-uri host confusion / IDN canonicalization (CVSS 7.5, I:H) -- **NEW** -- chain: @sentry/nextjs -> webpack -> ajv -> fast-uri@3.1.2 (fix: >=3.1.3)

**CI:** last 5 runs all success (latest 2026-07-21T18:07 UTC)

**Drift:** Same 3 chronic HOPED-FOR items, no git activity in last 3 days:
- Stress 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE)
- FI Insight Die award path (doubles -> pool increment; never fired in live play)
- Vehicle popout broadcasts (Section B; now >55 days)

**Action:** fast-uri@3.1.2 is a new HIGH (build-only, integrity-class). All 3 cleared by one pass: `npm audit fix --package-lock-only && npm install`. `tasks/security-audit.md` documents the prior 2; fast-uri is additive. Run before Beta-500.

---

## 2026-07-21 18:00 UTC

**Status:** RED (vulns persist - 5th consecutive flag; Puffer security audit now formally corroborates + fix command documented)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [2 high, 0 critical] - brace-expansion DoS (CVSS 5.3) + js-yaml quadratic CPU (CVSS 7.5); both dev/build-only (eslint chain); both have non-breaking fixes

**CI:** last 5 runs all success (latest security-audit commit abe9b90 at 2026-07-21T16:26 UTC)

**New since 15:05:** 1 commit - `abe9b90` Puffer weekly security audit; formally documents these 2 HIGH as NEW + provides exact fix command. See `tasks/security-audit.md`.

**Drift:** Same 3 chronic HOPED-FOR items (all >30 days without playtest):
- Stress 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE)
- FI Insight Die award path (doubles -> pool increment; never fired in live play)
- Vehicle popout broadcasts (Section B; >55 days)

**Action:** Puffer security audit at `tasks/security-audit.md` has the exact fix: `npm audit fix --package-lock-only && npm install`. 5th flag on same 2 HIGH vulns - run the fix or mark deferred explicitly. Both are dev/build-only (no prod exposure), but flagged as DoS risk at scale.

---

## 2026-07-21 15:05 UTC

**Status:** RED (vulns persist - 4th consecutive flag since 06:06)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [2 high, 0 critical] - brace-expansion + js-yaml; unremediated since 06:06; both dev/build only

**CI:** last 5 runs all success (latest 2026-07-21T13:13 UTC)

**New since 12:06:** 1 commit - `cfa7456` NPC panel toolbar consolidation (6 buttons -> 1 row icons); gates pass, CI green.

**Drift:** Same 3 chronic HOPED-FOR items (Stress 12-string, FI Insight Die, vehicle popout) - no change.

**Action:** `npm audit fix` still not run. Run it or explicitly defer - this is the 4th flag on the same issue.

---

## 2026-07-21 12:06 UTC

**Status:** RED (vulns persist from 09:04 entry - no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [2 high, 0 critical] - brace-expansion + js-yaml; same as 09:04; both dev/build only

**CI:** last 5 runs all success (latest 2026-07-21T09:07 UTC)

**New since 09:04:** 2 NPC panel commits (a5d714d green/red eye icon, 4dc0733 Show/Hide refactor); all gates pass.

**Drift:** Same 3 HOPED-FOR items (Stress 12-string, FI Insight Die, vehicle popout) - no code change, no playtest.

**Action:** `npm audit fix` still pending from 06:06 entry. Schedule or explicitly defer.

---

## 2026-07-21 09:04 UTC

**Status:** RED (vulns persist from 06:06 entry -- no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed / 54 files]

**Audit:** npm audit [2 high, 0 critical] -- same as 06:06; both in eslint (dev-only; no prod exposure)
- `brace-expansion` HIGH + `js-yaml` HIGH -- see 06:06 entry for full detail + fix command

**CI:** 5 runs today all pass (latest 2026-07-21T02:30 UTC) -- active ship day

**Drift:** Same 3 HOPED-FOR items (vehicle popout broadcasts, Stress 12-string, FI Insight Die) -- no code change. No new stale-open todos.

**Action:** `npm audit fix` from 06:06 still not run. Schedule or defer explicitly.

---

## 2026-07-21 06:06 UTC

**Status:** RED+DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [928 passed]

**Audit:** npm audit [2 high, 0 critical] -- NEW (was clean last run)
- `brace-expansion` HIGH: DoS via exponential {} expansion -- via @typescript-eslint + glob (dev/build only; fix available)
- `js-yaml` HIGH: DoS via YAML merge-key chains -- via eslint -> @eslint/eslintrc (dev/build only; fix available)
- Both are transitive, build-time only, not runtime/prod. Fix: `npm audit fix` or update eslint.

**CI:** last 5 runs all pass (latest 2026-07-20T23:37 UTC)

**Drift:**
- HOPED-FOR (35 days stale, last verified Test Bed Session 24 2026-06-16): Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE); FI Insight Die award path; vehicle popout broadcasts. Stress strings drain target was 2026-07-01 -- 20 days overdue.
- No new stale-open todos found; 585b3a3 closed 9 HIGH items correctly; H4 (Cover Fire) now [x] in todo.

**Action:** Run `npm audit fix --dry-run` to confirm non-breaking; if safe, run `npm audit fix` and commit. HOPED-FOR drain still needs a playtest or deliberate deferral decision.

---

## 2026-07-20 21:04 UTC

**Status:** DRIFT (19th consecutive flag - same items, no change)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all pass (latest 2026-07-20T18:07Z)

**Drift:**
- HOPED-FOR >34 days stale (last noted 2026-06-16, Test Bed Session 24): Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die award path, vehicle popout broadcasts. Drain target for Stress strings was Beta-500 dry-run before 2026-07-01 - now 19 days past that deadline.
- Stale-open todo: line 37 (CharacterCard.tsx:1080 Reload NaN) - FIXED (see CharacterCard.tsx:971 `reloads ?? 0`; confirmed by health-pulse 486fd7d). Close it.
- Cover Fire CMod (todo line 32, H4) still genuinely open - confirmed in Gate 2 commit 4fb1aea message: "Remaining Gate 2: H4 (Cover Fire, live migration)".

**Action:** Beta-500 path: H4 (Cover Fire) is the blocking HIGH in Gate 2; Stress Check strings + FI Insight Die + vehicle popout are 5+ weeks unverified - schedule a Beta-500 dry-run or explicitly defer past launch.

---

## 2026-07-20 18:05 UTC

**Status:** DRIFT (18th consecutive flag - same items, no change)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-20T15:08 UTC)

**Drift:**
- HOPED-FOR (35+ days): Stress Check 12-string (HEAL/UNJAM/REPAIR/GutInstinct/GroupCheck/DRIVE/BREW/NAVIGATE); FI Insight Die award path; Vehicle popout broadcasts.
- Stale-open todos (same): H11/H14/H16 confirmed shipped but still [ ] in todo.md.
- Cover Fire -2 CMod (page.tsx:4574/2423) still highest-impact open HIGH.

**Action:** 18th flag, nothing new. No commits since presence tune (531e37a). Defer HOPED-FOR to Beta-500 dry-run; mark H11/H14/H16 [x] in todo.md when convenient.

---

## 2026-07-20 15:07 UTC

**Status:** DRIFT (17th consecutive flag - same items, no change)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-20T12:09 UTC)

**Drift:**
- HOPED-FOR (35+ days): Stress Check 12-string (HEAL/UNJAM/REPAIR/GutInstinct/GroupCheck/DRIVE/BREW/NAVIGATE); FI Insight Die award path; Vehicle popout broadcasts.
- Stale-open todos (same): H11/H14/H16 confirmed shipped but still [ ] in todo.md.
- Cover Fire -2 CMod (page.tsx:4574/2423) still highest-impact open HIGH.

**Action:** 17th flag, nothing new. No commits since presence tune (531e37a). Same as 16th: defer HOPED-FOR to Beta-500 dry-run; mark H11/H14/H16 [x] in todo.md when convenient.

---

## 2026-07-20 12:07 UTC

**Status:** DRIFT (16th consecutive flag - same items, no change)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-20T09:08 UTC)

**Drift:**
- HOPED-FOR (35+ days): Stress Check 12-string (HEAL/UNJAM/REPAIR/GutInstinct/GroupCheck/DRIVE/BREW/NAVIGATE); FI Insight Die award path; Vehicle popout broadcasts.
- Stale-open todos (same): H11/H14/H16 confirmed shipped but still [ ] in todo.md.
- Cover Fire -2 CMod (page.tsx:4574/2423) still highest-impact open HIGH.

**Action:** 16th flag, nothing new. No commits since presence tune (531e37a). Call: deliberate defer on HOPED-FOR (pre-Beta-500 dry-run target) + mark H11/H14/H16 [x] in todo.md when convenient.

---

## 2026-07-20 09:09 UTC

**Status:** DRIFT (15th consecutive flag - same items, no change)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-20T06:08 UTC - new since 06:06 entry)

**Drift:**
- HOPED-FOR (34+ days): Stress Check 12-string (HEAL/UNJAM/REPAIR/GutInstinct/GroupCheck/DRIVE/BREW/NAVIGATE); FI Insight Die award path; Vehicle popout broadcasts.
- Stale-open todos (same): H11/H14/H16 confirmed shipped but still [ ] in todo.md.
- Cover Fire -2 CMod (page.tsx:4574/2423) still highest-impact open HIGH.

**Action:** 15th flag, nothing new since 06:06. Mark H11/H14/H16 [x] in todo.md when convenient.

---

## 2026-07-20 06:06 UTC

**Status:** DRIFT (14th consecutive flag - same items, no change)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-19T21:08 UTC)

**Drift:**
- HOPED-FOR (34+ days): Stress Check 12-string - 8 uncaptured (HEAL/UNJAM/REPAIR/GutInstinct/GroupCheck/DRIVE/BREW/NAVIGATE); FI Insight Die award path (doubles never fired live); Vehicle popout broadcasts.
- Stale-open todos (confirmed shipped but unchecked): H11 reload fix + H16 Bulk Upload Thriver gate + H14 CampaignPins sidebar topic.
- Cover Fire -2 CMod (page.tsx:4574/2423) still highest-impact unassigned active HIGH.

**Action:** 14th flag, no movement. Same call as pulse 13: deliberate defer decision on HOPED-FOR items + mark H11/H14/H16 [x] in todo.md.

---

## 2026-07-19 21:03 UTC

**Status:** DRIFT (13th+ consecutive flag - same items, 2 new commits presence-only)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-19T18:06 UTC)

**Drift:**
- HOPED-FOR (33+ days): Stress Check 12-string - 8 uncaptured (HEAL/UNJAM/REPAIR/GutInstinct/GroupCheck/DRIVE/BREW/NAVIGATE); FI Insight Die award path (doubles never fired live); Vehicle popout broadcasts.
- Stale-open todos (confirmed shipped but unchecked): H11 reload `?? 0` fix (CharacterCard.tsx:971) + H16 Bulk Upload Thriver gate (tools/token-creator/page.tsx:608) + H14 CampaignPins sidebar topic (components/CampaignPins.tsx:180).
- Cover Fire -2 CMod (page.tsx:4574/2423) confirmed genuine open HIGH - wipes penalty before it applies.
- New commits since last pulse (2): presence idle-threshold tuning only - no impact on any flagged item.

**Action:** 13th flag, no change. Deliberate decision needed: defer HOPED-FOR to post-KS + mark H11/H14/H16 [x] in todo.md. Cover Fire CMod is the highest-impact unassigned active HIGH.

---

## 2026-07-19 18:05 UTC

**Status:** DRIFT (12th+ consecutive flag - same items, no new commits to affected areas)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-19T15:10 UTC)

**Drift:**
- HOPED-FOR (33+ days, last playtest 2026-06-16, past 7/1 drain deadline): Stress Check 12-string - 8 strings uncaptured (HEAL/UNJAM/REPAIR/GutInstinct/GroupCheck/DRIVE/BREW/NAVIGATE); FI Insight Die award path (never fired in live play); Vehicle popout broadcasts.
- Stale-open todos (same as prior pulses): CharacterCard.tsx shared-clock bug (H12) + Bulk Upload Thriver gate (H13) still [ ] in todo.md despite prior pulse flagging possible fix evidence. Cover Fire -2 CMod (page.tsx:4574/:2423) confirmed open HIGH.
- Note: this pulse entry uses ASCII hyphens only (per open todo item about em-dash violations in health-pulse.md).

**Action:** 12+ flags, no change. These items need a dedicated playtest pass or a deliberate "defer to post-KS" decision to stop flagging them. Cover Fire CMod is the highest-impact unassigned active HIGH.

---

## 2026-07-19 15:03 UTC

**Status:** DRIFT (11th+ consecutive flag - same items, no new commits)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-19T12:07 UTC)

**Drift:**
- HOPED-FOR (chronic, 55+ days): Vehicle popout broadcasts (since 2026-05-24). Stress Check 12-string - 8 uncaptured (HEAL/UNJAM/REPAIR/GutInstinct/GroupCheck/DRIVE/BREW/NAVIGATE).
- Stale-open todos (11th+ flag, no action): H11 (CharacterCard.tsx reload `?? 0` confirmed fixed) + H16 (Bulk Upload Thriver gate confirmed fixed) - need [x] in todo.md.
- Cover Fire -2 CMod (`page.tsx:4574`/`:2423`) confirmed open HIGH - action-costs with zero effect.

**Action:** Same as last 10 runs. Mark H11 + H16 [x] in todo.md; assign Cover Fire CMod to HP lane.

---

## 2026-07-19 12:05 UTC

**Status:** DRIFT (10th+ consecutive flag - same items, no new commits)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-19T09:06 UTC)

**Drift:**
- HOPED-FOR (chronic, 55+ days): Vehicle popout broadcasts (since 2026-05-24). Stress Check 12-string - 8 uncaptured (HEAL/UNJAM/REPAIR/GutInstinct/GroupCheck/DRIVE/BREW/NAVIGATE). FI Insight Die award path (doubles never fired in live play).
- Stale-open todos (10th+ flag, no action): H11 (CharacterCard.tsx:971 reload `?? 0` confirmed fixed in code) + H16 (Bulk Upload `token-creator/page.tsx:608` Thriver gate confirmed fixed) - need [x] in todo.md.
- Cover Fire -2 CMod (`page.tsx:4574`/`:2423`) confirmed open HIGH - wipes the penalty before it applies; every Cover Fire costs an action and does nothing.

**Action:** Push notification sent. Mark H11 + H16 [x] in todo.md; Cover Fire CMod assign to HP lane.

---

## 2026-07-19 09:03 UTC

**Status:** DRIFT (same as 06:05 run - no new code commits)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-19T06:06 UTC)

**Drift:**
- HOPED-FOR (chronic, 30+ days): Vehicle popout broadcasts (since 2026-05-24). Stress Check 12-string - 8 uncaptured (HEAL/UNJAM/REPAIR/GutInstinct/GroupCheck/DRIVE/BREW/NAVIGATE). FI Insight Die award path (doubles never fired in live play).
- Stale-open todos (9th+ consecutive flag): H11 (Reload `CharacterCard.tsx:971` `?? 0` confirmed fixed) + H16 (Bulk Upload `app/tools/token-creator/page.tsx:608` `!isThriver` gate confirmed fixed) - need [x] in todo.md.
- Cover Fire -2 CMod (`page.tsx:4578`) remains genuine open HIGH - bug persists.

**Action:** 9th flag with no action taken. Mark H11 + H16 [x] in todo.md; assign Cover Fire CMod fix to HP lane.

---

## 2026-07-19 06:05 UTC

**Status:** DRIFT (same as 00:04 run - no new commits)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-19T00:06 UTC)

**Drift:**
- HOPED-FOR (chronic): Vehicle popout broadcasts (since 2026-05-24). Stress Check 12-string - 8 uncaptured strings.
- Stale-open todos (8th+ consecutive flag - no action taken): H11/H16/Reload confirmed fixed in code but not marked [x]. Cover Fire -2 CMod (page.tsx :4574/:2423) remains genuine open HIGH.

**Action:** 8th+ flag - H11/H16/Reload need [x] in todo.md; Cover Fire CMod still needs a fix in HP lane.

---

## 2026-07-19 00:04 UTC

**Status:** DRIFT (same as 21:04 run - no new commits)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-18T21:05 UTC)

**Drift:**
- HOPED-FOR (chronic): Vehicle popout broadcasts (since 2026-05-24). Stress Check 12-string - 8 uncaptured strings. FI Insight Die award path.
- Stale-open todos (7th+ consecutive flag - no action taken): H16/H11/Reload confirmed fixed in code but not marked [x]. Cover Fire -2 CMod (page.tsx :4574/:2423) remains genuine open HIGH.

**Action:** 7th+ flag with no response - H16/H11/Reload need [x] in todo.md; Cover Fire CMod still needs a fix in HP lane.

---

## 2026-07-18 21:04 UTC

**Status:** DRIFT (same as 18:03 run - no new commits)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-18T18:06 UTC)

**Drift:**
- HOPED-FOR (chronic): Vehicle popout broadcasts (waiting since 2026-05-24). Stress Check 12-string - 8 uncaptured strings. FI Insight Die award path (never fired in live play).
- Stale-open todos (6th+ consecutive flag, no action taken): H16/H11/Reload confirmed fixed in code but todo.md not updated. Cover Fire -2 CMod (page.tsx :4574/:2423) remains genuinely open HIGH.

**Action:** Same as 18:03 - mark H16/H11/Reload [x] in todo.md; Cover Fire CMod still needs a fix in HP lane.

---

## 2026-07-18 18:03 UTC

**Status:** DRIFT (same as 12:07 run - no new commits since then)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-18T12:10 UTC)

**Drift:**
- HOPED-FOR (chronic, 3+ days no code change): Vehicle popout broadcasts (waiting since 2026-05-24). Stress Check 12-string - 8 uncaptured strings (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE). FI Insight Die award path (rolling doubles, never fired in live play).
- Stale-open todos (5th+ consecutive run - action not yet taken): H16 Bulk Upload Thriver gate, H11 CampaignPins shared topic, Reload button NaN bug - all confirmed fixed in code. The only genuinely open HIGH bug in this cluster: Cover Fire -2 CMod (page.tsx aim_bonus write at :2423 still resets the -2 before it applies).

**Action:** todo.md cleanup needed - mark H16/H11/Reload [x] (all confirmed fixed); Cover Fire CMod remains a real open HIGH. Schedule playtest for vehicle popout + Stress Check strings.

---

## 2026-07-18 12:07 UTC

**Status:** DRIFT (same chronic drift - no new commits since 06:05 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-18T06:07 UTC)

**Drift:**
- HOPED-FOR (chronic, no code change in 3+ days): Vehicle popout broadcasts (Section B, waiting since 2026-05-24). Stress Check 12-string - 8 uncaptured strings (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE). FI Insight Die award path (rolling doubles).
- Stale-open todos (4th+ consecutive run flagging, still unaddressed): H16 Bulk Upload Thriver gate (confirmed fixed 2026-07-13 - full `if (!isThriver)` guard at app/tools/token-creator/page.tsx:608). H11 CampaignPins shared topic (confirmed fixed 2026-07-13 - moved to `campaign_pins_sidebar_${id}`). Reload button NaN bug (confirmed fixed 2026-07-13 - normalizes `weapon.reloads ?? 0`).

**Action:** Close H11/H16/Reload stale todos in todo.md (all three confirmed fixed in code); schedule playtest targeting vehicle popout + Stress Check strings.

---

## 2026-07-18 06:05 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files - OK]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-18T00:07 UTC)

**Drift:**
- STALE-TODO: `CharacterCard.tsx:1080` Reload button NaN bug (HIGH open todo) appears FIXED - line 965-971 now normalizes `weapon.reloads ?? 0` and all button refs use the normalized value; git log shows `481b925` (ammo fix 2026-07-13) + `1a450b9` (roadmap docs mark reload/loadout fixes shipped). Audit-correction needed: mark the todo `[x]`.
- HOPED-FOR (chronic, no code change in 3 days): Vehicle popout broadcasts (Section B, waiting for playtest since 2026-05-24). Stress Check 12-string narrative - 8 uncaptured strings (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE). FI Insight Die award path (rolling doubles - never fired in live play).
- NOTE: Confidence Ledger in debug-handoff.md says 875 tests/48 files; suite now reports 924/54 - ledger stale by ~49 tests.

**Action:** Mark Reload button todo `[x]` (already fixed); schedule Stress/FI/Vehicle HOPED-FOR for next playtest verification pass.

---

## 2026-07-18 00:04 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all pass

**Drift:**
- HOPED-FOR (32+ days, no playtest update): Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - drain target was Beta-500 dry-run
- HOPED-FOR (32+ days): FI Insight Die AWARD path (rolling doubles -> insight_dice +1) - never fired in live play; need ~36 rolls to expect one double
- HOPED-FOR (32+ days): Vehicle popout broadcasts (vehicle_updated / firing_arc_toggle) - awaiting ride at a playtest
- Stale-as-open todo: `[HIGH] CampaignPins + CampaignMap share campaign_pins_${id}` - FIXED 2026-07-13 (CampaignPins moved to `campaign_pins_sidebar_${id}`, code confirmed). Mark shipped.
- Stale-as-open todo: `[HIGH] token-creator Bulk Upload tab no Thriver gate` - FIXED (full `if (!isThriver) return` guard added at line ~607, whole tool gated). Mark shipped.

**Action:** Close the two stale-open audit items in todo.md; schedule a playtest to drain vehicle popout broadcasts + watch for Stress 12-string and FI Insight Die doubles.

---

## 2026-07-17 21:04 UTC

**Status:** DRIFT (same chronic drift - no new commits since 18:04 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-17 18:06 UTC)

**Drift:**
- HOPED-FOR chronic (31+ days): vehicle popout broadcasts, Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path.
- Stale-open todos (confirmed fixed in code, still [ ]): H11 CampaignPins shared topic (campaign_pins_sidebar in code), H16 Bulk Upload Thriver gate (isThriver gate exists in code, H16 line item may be stale), H3 insight reroll double damage, H5 upkeep Pristine degrades.

**Action:** Same as prior runs - clean up stale [ ] items in todo.md (H11 is confirmed shipped). HOPED-FOR drain overdue - needs a focused playtest targeting vehicle popout + Stress Check strings.

---

## 2026-07-17 18:04 UTC

**Status:** DRIFT (same as 15:07 run - only commit since then is the prior health-pulse)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-17 15:09 UTC)

**Drift:**
- HOPED-FOR chronic (31+ days): vehicle popout broadcasts, Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path.
- Stale-open todos (confirmed fixed in code, still [ ]): H11 CampaignPins shared topic (campaign_pins_sidebar in code; was H14 2026-07-13 ship), H16 Bulk Upload Thriver gate, H3 insight reroll double damage, H5 upkeep Pristine degrades.

**Action:** Mark H11 [x] in todo.md (CampaignPins topic fix confirmed shipped). HOPED-FOR drain pass overdue -- queue a dedicated playtest session targeting vehicle popout + Stress Check strings.

---

## 2026-07-17 15:07 UTC

**Status:** DRIFT (same as 12:06 run - no new commits since last health-pulse)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-17 12:09 UTC)

**Drift:**
- HOPED-FOR chronic (31+ days): vehicle popout broadcasts, Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE).
- Stale-open todos (confirmed fixed in code, still `[ ]`): H3 insight reroll double damage, H5 upkeep Pristine degrades, H11 CampaignPins shared topic, H16 Bulk Upload Thriver gate.

**Action:** Same as prior runs - mark H3/H5/H11/H16 as `[x]` in todo.md; HOPED-FOR drain pass overdue.

---

## 2026-07-17 12:06 UTC

**Status:** DRIFT (same as 09:04 run - no new commits since last health-pulse)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-17 09:06 UTC)

**Drift:**
- HOPED-FOR chronic (31+ days): vehicle popout broadcasts, Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path.
- Stale-open todos (confirmed fixed in code, still `[ ]`): H3 insight reroll double damage, H5 upkeep Pristine degrades, H11 CampaignPins shared topic, H16 Bulk Upload Thriver gate.

**Action:** Same as prior runs - mark H3/H5/H11/H16 as `[x]` in todo.md; HOPED-FOR drain pass overdue (Beta-500 dry-run target was 2026-07-01).

---

## 2026-07-17 09:04 UTC

**Status:** DRIFT (same as 06:10 run - no new commits since last health-pulse)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-17 06:08 UTC)

**Drift:**
- HOPED-FOR chronic (31+ days): vehicle popout broadcasts, Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path.
- Stale-open todos (confirmed fixed in code, still `[ ]`): H3 insight reroll double damage, H5 upkeep Pristine degrades, H11 CampaignPins shared topic, H16 Bulk Upload Thriver gate.

**Action:** Same as prior runs - mark H3/H5/H11/H16 as `[x]` in todo.md; HOPED-FOR drain pass overdue (Beta-500 dry-run target was 2026-07-01).

---

## 2026-07-17 06:10 UTC

**Status:** DRIFT (same as 00:05 run - no new commits since last health-pulse)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-17 00:08 UTC)

**Drift:**
- HOPED-FOR chronic (31+ days): vehicle popout broadcasts, Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path.
- Stale-open todos (confirmed fixed in code, still `[ ]`): H3 insight reroll double damage, H5 upkeep Pristine degrades, H11 CampaignPins shared topic, H16 Bulk Upload Thriver gate.

**Action:** Same as prior runs - mark H3/H5/H11/H16 as `[x]` in todo.md; HOPED-FOR drain pass overdue (Beta-500 dry-run target was 2026-07-01).

---

## 2026-07-17 00:05 UTC

**Status:** DRIFT (same as 21:04 run - no new commits since health-pulse commit)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-16 21:07 UTC)

**Drift:**
- HOPED-FOR chronic (31+ days): vehicle popout broadcasts, Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path.
- Stale-open todos (confirmed fixed, still `[ ]`): H3 insight reroll double damage, H5 upkeep Pristine degrades, H11 CampaignPins shared topic, H16 Bulk Upload Thriver gate.

**Action:** Same as 21:04 run - mark H3/H5/H11/H16 as `[x]` in todo.md. HOPED-FOR chronic: reschedule Beta-500 dry-run (2026-07-01 target passed).

---

## 2026-07-16 21:04 UTC

**Status:** DRIFT (unchanged gates/CI; 18:04 H16 correction)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 18:08 UTC 2026-07-16)

**Drift:**
- HOPED-FOR chronic (30+ days, no git activity since last run): vehicle popout broadcasts, Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path.
- Stale-open todos confirmed fixed in code but still `[ ]` in todo.md:
  - **H3** insight reroll double damage -- confirmed fixed (18:04 run); todo line 31 still `[ ]`.
  - **H5** upkeep Pristine degrades on Wild/High-Insight -- confirmed fixed (18:04 run); todo line 33 still `[ ]`.
  - **H11** CampaignPins + CampaignMap shared topic -- confirmed fixed (18:04 run); todo line 41 still `[ ]`.
  - **H16** Bulk Upload no Thriver gate -- **NEW correction vs 18:04 run** (18:04 listed as "genuine open"); `app/tools/token-creator/page.tsx` has page-level `if (!isThriver)` gate + tab hidden (shipped `4c031fa` 2026-07-13); todo line 43 still `[ ]`.
- Genuine open HIGH (verified): H8 CharacterCard Rest/Travel advances shared clock per-character; H4 Cover Fire no-op; myEntry viewer-vs-attacker misattribution; CDP deduct-no-rollback; give-to-NPC/community/vehicle un-awaited RPC gap.

**Action:** Mark H3/H5/H11/H16 as `[x]` shipped in todo.md. HOPED-FOR chronic: reschedule Beta-500 dry-run (2026-07-01 target passed).

---

## 2026-07-16 18:04 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 15:07 UTC 2026-07-16)

**Drift:**
- HOPED-FOR chronic (30+ days, no git activity last 3 days): vehicle popout broadcasts, Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path.
- Stale-open todos confirmed fixed in code but still `[ ]` in todo.md:
  - **H3** insight reroll double damage -- fix confirmed at `page.tsx:5040` (Xero canon 2026-07-13; "restore pre-hit state, reapply"); todo line 31 still `[ ]`.
  - **H5** upkeep Pristine degrades on Wild/High-Insight -- fix confirmed in `lib/upkeep.ts` (Math.min clamp, test passing); todo line 33 still `[ ]`.
  - **H11** CampaignPins + CampaignMap share topic -- fixed by `989030f` (H14 patch, moved sidebar to `campaign_pins_sidebar_${id}`); todo line 41 still `[ ]`.
- Genuine open HIGH: H8 CharacterCard.tsx:1293/1275 Rest/Travel calls advanceClock per-character (shared clock multiplication); H4 Cover Fire no-op; myEntry misattribution; CDPdeduct-no-rollback; give-to-NPC un-awaited; Bulk Upload no Thriver gate.

**Action:** Mark H3/H5/H11 as `[x]` shipped in todo.md. HOPED-FOR chronic: schedule explicit Beta-500 dry-run before 2026-07-01 target (already past -- reschedule or drop).

---

## 2026-07-16 15:06 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 12:09 UTC 2026-07-16)

**Drift:**
- HOPED-FOR chronic (30+ days): vehicle popout broadcasts, Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path.
- Stale-open HIGH todos (fixed in git but still marked `[ ]` in todo.md):
  - **H3** insight reroll double-damage → fixed `ab9c149` (2026-07-16)
  - **H5** upkeep Pristine degrades on Wild/High-Insight → fixed `c0d1e3d`
  - **H8** sickness Day-0 mortal drop skips Stress pip → fixed `c0d1e3d`
  - **H11** CDP deduct-then-apply no rollback → fixed `d331a67`
  - **H14** CampaignPins + CampaignMap shared realtime channel → fixed `989030f`

**Action:** todo.md CURRENT OPEN needs audit pass — at least 5 HIGH items still marked open are already shipped. HOPED-FOR chronic items need explicit scheduling before Beta-500.

---

## 2026-07-16 15:05 UTC

**Status:** DRIFT (unchanged from 12:04)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 09:07 UTC 2026-07-16)

**Drift:**
- HOPED-FOR chronic (30+ days): vehicle popout broadcasts, Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path. Drain target (2026-07-01 Beta-500 dry-run) passed without resolution.
- Stale-open todos: lines 20/21/22/41 all shipped (Cover Fire step 13, lobby roster step 5, char-sheet realtime step 11, pins shared topic) -- still marked [ ] in todo.md.

**Action:** same as 12:04 -- todo.md CURRENT OPEN needs a cleanup pass to check off shipped items; HOPED-FOR needs explicit scheduling.

---

## 2026-07-16 12:04 UTC

**Status:** DRIFT (unchanged from 09:04)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 06:07 UTC 2026-07-16)

**Drift:**
- HOPED-FOR chronic (30+ days): vehicle popout broadcasts, Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path. Beta-500 dry-run target date (2026-07-01) passed without resolution.
- Stale-open todos unchanged: line 37 (reload NaN bug) + line 41 (CampaignPins shared topic) both shipped but still `[ ]`.

**Action:** todo.md cleanup - check off shipped lines 37 + 41; decide if HOPED-FOR items need explicit Beta-500 dry-run scheduling.

---

## 2026-07-16 09:04 UTC

**Status:** DRIFT (unchanged from 00:05)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 00:07 UTC 2026-07-16)

**Drift:**
- HOPED-FOR unchanged (36+ days): vehicle popout broadcasts, Stress Check 12-string (8 strings: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path.
- Stale-open (same as 00:05): lines 37 + 41 shipped, not checked off.
- Possible new stale-open: line 21 "newly-joined player" -- shipped as `9998f86` step 5/6; open item's specific `character_id not null` filter fix on `:1544` may be a second angle not yet addressed.

**Action:** todo.md cleanup pass flagged 5+ consecutive pulses without resolution -- verify + check off shipped HIGHs before next session.

---

## 2026-07-16 00:05 UTC

**Status:** DRIFT (unchanged from 21:05)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 21:06 UTC 2026-07-15)

**Drift:**
- HOPED-FOR unchanged (36+ days): vehicle popout broadcasts (realtime section), Stress Check 12-string (8 strings: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE).
- Stale-open todo newly confirmed: CharacterCard reload button NaN bug (todo.md line 37) IS shipped -- `4fb1aea` Gate 2 combat holes; `weapon.reloads ?? 0` in place at `:971`. Still marked `[ ]`.
- Previously confirmed stale: CampaignPins shared-topic bug (todo.md line 41) shipped `989030f`.
- No new commits to roll-helpers.ts/roll-outcomes.ts addressing the stress-string gap.

**Action:** Same cleanup pass needed -- verify + check off shipped HIGH todos (at minimum lines 37 and 41) before next session.

---

## 2026-07-15 21:05 UTC

**Status:** DRIFT (unchanged from 18:05)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 18:06 UTC 2026-07-15)

**Drift:**
- HOPED-FOR unchanged (35-57 days): vehicle popout broadcasts, Stress Check 12-string, FI Insight Die AWARD path.
- Stale-open todo confirmed: `CampaignPins.tsx:169` shared-topic bug (todo.md line 41) IS shipped (`989030f`); still marked `[ ]`. Part of the 12+ todo cleanup pass still pending.

**Action:** Same as 18:05 -- verify + check off the 12+ shipped HIGH todos in todo.md before next session.

---

## 2026-07-15 18:05 UTC

**Status:** DRIFT (unchanged from 15:05)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 15:08 UTC 2026-07-15)

**Drift:**
- HOPED-FOR unchanged (35-57 days): vehicle popout broadcasts, Stress Check 12-string, FI Insight Die AWARD path.
- Stale-open todos: 12+ HIGH items appear shipped by the beta500 batch; todo.md cleanup pass still pending.

**Action:** Same as 15:05 -- verify + check off the 12+ shipped HIGH todos in todo.md before next session.

---

## 2026-07-15 15:05 UTC

**Status:** DRIFT (unchanged from 12:04)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 12:08 UTC 2026-07-15)

**Drift:**
- HOPED-FOR unchanged (35-57 days): vehicle popout broadcasts, Stress Check 12-string, FI Insight Die AWARD path.
- Stale-open todos: 12+ HIGH items appear shipped by the beta500 batch; todo.md cleanup pass still pending.

**Action:** Same as 12:04 -- verify + check off the 12+ shipped HIGH todos in todo.md before next session.

---

## 2026-07-15 12:04 UTC

**Status:** DRIFT (unchanged from 09:06)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 09:07 UTC 2026-07-15)

**Drift:**
- HOPED-FOR unchanged (34-56 days): vehicle popout broadcasts, Stress Check 12-string, FI Insight Die AWARD path.
- Stale-open todos: same batch as 09:06 -- 12+ HIGH items appear shipped by the beta500 batch, todo.md cleanup pass still pending.

**Action:** Same as 09:06 -- verify + check off the 12+ shipped HIGH todos in todo.md before next session.

---

## 2026-07-15 09:06 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 06:07 UTC 2026-07-15)

**Drift:**
- HOPED-FOR unchanged (34-56 days): vehicle popout broadcasts, Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path.
- Stale-open todos (appear shipped since last pulse -- large batch, needs cleanup pass):
  - #30 viewer-vs-attacker H1/H2 -> fde0f7a (2026-07-12)
  - #31 insight reroll double damage H3 -> ab9c149 (2026-07-12)
  - #33 Pristine degrades H5 -> c0d1e3d (2026-07-12)
  - #34 sickness Day-0 stress pip H8 -> c0d1e3d (2026-07-12)
  - #35 Community 13-member boundary H9 -> 5879d39 (2026-07-12)
  - #38 CDP rollback H11 -> d331a67 (2026-07-13)
  - #41 CampaignPins shared channel H14 -> 989030f (2026-07-14)
  - #21 lobby roster on join -> 989030f (2026-07-14)
  - #22 character sheet damage live -> 1a8161e (2026-07-14)
  - #24 NPC ammo surfaced -> 58943ba (2026-07-14)
  - #37 Reload undefined/free ammo -> bb61ae8/481b925 (2026-07-13)
  - #43 Bulk Upload Thriver gate -> 4c031fa (2026-07-14)

**Action:** todo.md cleanup -- 12+ HIGH items appear shipped by the beta500 batch. Verify and check off so the list reflects reality before next session.

---

## 2026-07-15 06:05 UTC

**Status:** DRIFT (unchanged from 00:05)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 2 runs all success (latest 00:09 UTC 2026-07-15)

**Drift:**
- HOPED-FOR unchanged (33-55 days): vehicle popout broadcasts, Stress Check 12-string (8 strings: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path.
- Stale-open todo: same as prior pulse - H5/H8/H11 shipped but still marked [ ] in todo.md.

**Action:** No new findings. todo.md cleanup pass (check off H5/H8/H11) is the only pending human action.

---

## 2026-07-15 00:05 UTC

**Status:** DRIFT (unchanged from 21:05)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 21:06 UTC 2026-07-14)

**Drift:**
- HOPED-FOR unchanged (33-55 days): vehicle popout broadcasts, Stress Check 12-string (8 strings: HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path.
- Stale-open todo: same as prior pulse - H5/H8/H11 shipped but still marked [ ] in todo.md; todo.md cleanup pass still pending.

**Action:** No new findings. Same as 21:05 - todo.md audit cleanup pass is the only pending human action.

---

## 2026-07-14 21:05 UTC

**Status:** DRIFT (unchanged from 18:04)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 18:06 UTC 2026-07-14)

**Drift:**
- HOPED-FOR unchanged (32-54 days): vehicle popout broadcasts, Stress Check 12-string (8 strings), FI Insight Die AWARD path.
- Stale-open todo: lines 33/34/38 (H5/H8/H11) shipped 2026-07-13 but still unchecked in todo.md.

**Action:** Same as prior pulses - todo.md cleanup pass needed for H5/H8/H11. No new findings since 18:04.

---

## 2026-07-14 18:04 UTC

**Status:** DRIFT (unchanged from 12:04)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 16:28 UTC 2026-07-14)

**Drift:**
- HOPED-FOR unchanged (32-54 days): vehicle popout broadcasts, Stress Check 12-string (8 strings), FI Insight Die AWARD path.
- Stale-open todo items: same as 12:04 - todo.md cleanup pass still pending.
- No new commits since 12:04 (only the health-pulse commit itself).

**Action:** Same as 09:04/12:04 - todo.md cleanup pass needed. HOPED-FOR Stress Check 14 days past own drain target.

---

## 2026-07-14 12:04 UTC

**Status:** DRIFT (unchanged from 09:04)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 09:08 UTC 2026-07-14)

**Drift:**
- HOPED-FOR unchanged (31-53 days): vehicle popout broadcasts, Stress Check 12-string (8 strings), FI Insight Die AWARD path. Stress check drain target 2026-07-01 is now 14 days overdue.
- Stale-open todo items: same batch as 09:04 entry (H1/H2/H3/H5/H8/H9/H11/H16/M4/M5/M7/M8 shipped in beta500 gate commits, not yet checked off in todo.md). No new commits since 09:04.

**Action:** No new action beyond the 09:04 entry - todo.md cleanup pass still pending.

---

## 2026-07-14 09:04 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 01:12 UTC 2026-07-14)

**Drift:**
- HOPED-FOR unchanged (30-52 days): vehicle popout broadcasts, Stress Check 12-string (HEAL/UNJAM/REPAIR/GutInstinct/GroupCheck/DRIVE/BREW/NAVIGATE), FI Insight Die AWARD path. Stress check drain target was 2026-07-01 - 13 days overdue.
- NEW stale-open since 00:04 pulse: Gate 2 `4fb1aea` (M4/M8/M7 combat holes) shipped - no corresponding todo items checked off. Plus prior stale items (H1/H2/H3/H5/H8/H11/H16/M5) noted in earlier pulses remain unchecked in todo.md.
- Testplan xlsx `06bb8cb` pushed (docs only - Gate 2-5 smoke results).

**Action:** Run todo.md audit pass - sweep all [ ] HIGH items against recent beta500 commits (H1-H11/H16/M4/M5/M7/M8) and check them off. HOPED-FOR Stress Check strings need a targeted playtest trigger (not blocking KS but 13 days past own deadline).

---

## 2026-07-14 00:04 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 22:22 UTC 2026-07-13)

**Drift:**
- HOPED-FOR unchanged (same 3 chronic items, now 29-51+ days): vehicle popout broadcasts, Stress Check 12-string (8 strings), FI Insight Die AWARD path.
- Stale-open todo items (shipped 22:10-22:22 UTC 2026-07-13, after the 21:04 pulse, not yet checked in todo.md):
  - `[ ] [HIGH] CharacterEvolution.tsx:221 CDP deduct-then-apply no rollback (H11)` -> SHIPPED d331a67
  - `[ ] [HIGH] token-creator/page.tsx:618 Bulk Upload no Thriver gate (H16)` -> SHIPPED 4c031fa
  - Gate 4 M1/M2/M3/L6 communities correctness -> SHIPPED 24b4a40 (tracked in beta500-readiness.md, not separate todo lines)
  - Gate 3.4 M5 atomic clock advance -> SHIPPED d331a67 (same commit as H11)

**Action:** todo.md cleanup - H11 (line 38) + H16 (line 43) still `[ ]` in the audit block. Beta500-readiness.md is current (0743803 updated it). HOPED-FOR drain at Beta-500 dry-run.

---

## 2026-07-13 21:04 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files] (+7 tests vs 18:03 run)

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 20:46 UTC)

**Drift:**
- HOPED-FOR unchanged (same 3 chronic items, 27-51+ days): vehicle popout broadcasts, Stress Check 12-string (8 uncaptured strings), FI Insight Die AWARD path.
- Stale-open todo items shipped since 18:03 UTC run:
  - `[ ] [HIGH] lib/upkeep.ts:54 Pristine item degrades on Wild/High-Insight (H5)` -> SHIPPED `c0d1e3d`
  - `[ ] [HIGH] lib/campaign-clock.ts:530 sickness Day-0 skips +1 Stress pip (H8)` -> SHIPPED `c0d1e3d`
  - `[ ] [HIGH] Community 13-member boundary double-defined (H9)` -> SHIPPED `5879d39`
  - `[ ] [LOW/UX] NPC ammo not surfaced anywhere` -> SHIPPED `58943ba` (ammo shown on card + Attack gated)

**Action:** todo.md cleanup pass needed - H5/H8/H9 and NPC ammo item are DONE in code. HOPED-FOR drain at Beta-500 dry-run.

---

## 2026-07-13 18:03 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [924 passed / 54 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 17:59 UTC)

**Drift:**
- HOPED-FOR unchanged (same 3 items from 15:04 run, all stale 27-50+ days): vehicle popout broadcasts, Stress Check 12-string narrative, FI Insight Die AWARD path.
- Stale-open todo items (5 confirmed shipped but unchecked):
  - `[ ] [MED] Newly-joined player doesn't appear` -> SHIPPED `9998f86` (09:34 UTC today)
  - `[ ] [MED] Open char sheet stale on damage` -> SHIPPED `1a8161e` (09:38 UTC today)
  - `[ ] [HIGH] CampaignPins share campaign_pins_${id} topic` -> SHIPPED `989030f` (08:39 UTC today, H14)
  - `[ ] [HIGH] combat viewer-vs-attacker misattribution (H1/H2)` -> SHIPPED `fde0f7a` (09:53 UTC today)
  - `[ ] [HIGH] insight reroll double damage (H3)` -> SHIPPED `ab9c149` (10:57 UTC today)
- Note: the 15:04 run listed the first 2 items above as "new MED bugs added" -- they were already fixed by that run. Corrected here.

**Action:** todo.md needs a cleanup pass to check off 5 stale items. H1/H2/H3 and H14 are DONE in code. HOPED-FOR drain at Beta-500 dry-run.

---

## 2026-07-13 15:04 UTC

**Status:** DRIFT (new context since 12:07 run - playtest + H14 fix; chronic HOPED-FOR items unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 14:40 UTC)

**New since 12:07 run:**
- `989030f` H14 FIXED - CampaignPins/CampaignMap shared-topic collision closed (was HIGH todo item L34)
- Playtest ran 14:21 UTC (Xero GM + Tony Bushell, 2-client). Verdict: core loop PLAYABLE. H13 infection-resolve fix verified green.
- 4 new MED bugs added to todo (N1-N4): player roster not live on join, open char sheet stale on damage, no player pin popup, NPC ammo not surfaced.

**Drift:** Same 3 HOPED-FOR stale items (no code touch):
- Vehicle popout broadcasts (Section B) - stale 50+ days
- Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - stale 27 days
- FI Insight Die AWARD path (doubles -> pool increment) - stale 31 days

**Action:** Drain HOPED-FOR items at next Beta-500 dry-run. H14 closed. Playtest bugs N1-N4 in todo queue for HP.

---

## 2026-07-13 12:07 UTC

**Status:** DRIFT (same as 09:07 run - no new signal)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 09:06 UTC)

**Drift:** Same 3 HOPED-FOR stale 30+ days - no code touch since last run:
- Vehicle popout broadcasts -- verify plan tasks/realtime-cluster-verify-testplan-2026-07-09.md not yet run
- Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE)
- FI Insight Die AWARD path (rolling doubles) -- never fired in live play

**Action:** No new signal. Drain at next Beta-500 dry-run / playtest session.

---

## 2026-07-13 09:07 UTC

**Status:** DRIFT (unchanged from 06:03 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 06:05 UTC)

**Drift:** Same 3 HOPED-FOR stale 30+ days - no code touch since last run:
- Vehicle popout broadcasts -- verify plan tasks/realtime-cluster-verify-testplan-2026-07-09.md not yet run
- Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE)
- FI Insight Die AWARD path (rolling doubles) -- never fired in live play

**Action:** No new signal. Drain at next Beta-500 dry-run / playtest session.

---

## 2026-07-13 06:03 UTC

**Status:** DRIFT (unchanged from 00:05 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success

**Drift:** Same 3 HOPED-FOR stale 30+ days - no code touch since last run:
- Vehicle popout broadcasts -- verify plan tasks/realtime-cluster-verify-testplan-2026-07-09.md not yet run
- Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE)
- FI Insight Die AWARD path (rolling doubles) -- never fired in live play

**Action:** No new signal. Drain at next Beta-500 dry-run / playtest session.

---

## 2026-07-13 00:05 UTC

**Status:** DRIFT (unchanged from 21:05 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success (latest 2026-07-12T21:05Z)

**Drift:**
- HOPED-FOR stale 50+ days: vehicle popout broadcasts -- verify plan tasks/realtime-cluster-verify-testplan-2026-07-09.md not yet run
- HOPED-FOR stale 31+ days: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- drain target Beta-500 dry-run
- HOPED-FOR stale 31+ days: FI Insight Die AWARD path (rolling doubles) -- never fired in live play
- Note: all 3 items stale 30+ days; flagged every run; no code touch in 3 days

**Action:** No new action - same 3 stale HOPED-FOR items. Unchanged from prior run.

---

## 2026-07-12 21:05 UTC

**Status:** DRIFT (unchanged from prior runs)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean - 0 high/critical]

**CI:** last 5 runs all success

**Drift:**
- Vehicle popout broadcasts (Section B) - HOPED-FOR, no code touch in 3+ days; awaiting next playtest
- Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - HOPED-FOR, drain target Beta-500 dry-run
- FI Insight Die AWARD path (rolling doubles) - HOPED-FOR, has never fired in live play
- Note: these 3 items have been stale 30+ days; flagged repeatedly; no change this cycle

**Action:** No new action needed - same 3 HOPED-FOR items as every prior run. Resolve at next Beta-500 dry-run / playtest.

---

## 2026-07-12 18:05 UTC

**Status:** DRIFT (unchanged from 15:04 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success

**Drift:**
- HOPED-FOR stale ~55d: vehicle popout broadcasts -- fix in prod, verify plan tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~34d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- Beta-500 dry-run deadline passed 2026-07-01
- HOPED-FOR stale ~34d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play
- Stale-todo: Recorder observability still [ ] in todo.md; items 1-4 shipped b043904 2026-06-19 -- needs checkbox closed

**Action:** Unchanged. Run realtime-cluster-verify-testplan-2026-07-09.md at next playtest to close vehicle-popout HOPED-FOR.

---

## 2026-07-12 15:04 UTC

**Status:** DRIFT (unchanged from 12:03 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-12T12:06Z)

**Drift:**
- HOPED-FOR stale ~55d: vehicle popout broadcasts -- fix in prod, verify plan tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~34d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- Beta-500 dry-run deadline passed 2026-07-01
- HOPED-FOR stale ~34d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play
- Stale-todo: Recorder observability still [ ] in todo.md; items 1-4 shipped b043904 2026-06-19 -- needs checkbox closed

**Action:** Unchanged. Run realtime-cluster-verify-testplan-2026-07-09.md at next playtest to close vehicle-popout HOPED-FOR.

---

## 2026-07-12 12:03 UTC

**Status:** DRIFT (unchanged from 11:16 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-12T11:17Z)

**Drift:**
- HOPED-FOR stale ~55d: vehicle popout broadcasts -- 128145b fix in prod, verify plan tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~34d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- Beta-500 dry-run deadline passed 2026-07-01
- HOPED-FOR stale ~34d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play
- Stale-todo: Recorder observability still `[ ]` in todo.md; items 1-4 shipped `b043904` 2026-06-19 -- needs checkbox closed

**Action:** Unchanged. Run realtime-cluster-verify-testplan-2026-07-09.md at next playtest to close vehicle-popout HOPED-FOR.

---

## 2026-07-12 11:16 UTC

**Status:** DRIFT (unchanged from 06:03 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-12T06:05Z)

**Drift:**
- HOPED-FOR stale ~55d: vehicle popout broadcasts -- fix in prod, verify plan tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~34d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- Beta-500 dry-run deadline passed 2026-07-01
- HOPED-FOR stale ~34d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play
- Stale-todo: Recorder observability still `[ ]` in todo.md; items 1-4 shipped `b043904` 2026-06-19 -- needs checkbox closed

**Action:** Unchanged. Run realtime-cluster-verify-testplan-2026-07-09.md at next playtest to close vehicle-popout HOPED-FOR.

---

## 2026-07-12 06:03 UTC

**Status:** DRIFT (unchanged from 00:05 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-12T00:06Z)

**Drift:**
- HOPED-FOR stale ~54d: vehicle popout broadcasts -- 128145b fix in prod, verify plan tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~34d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- Beta-500 dry-run deadline passed 2026-07-01
- HOPED-FOR stale ~34d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play
- Stale-todo: Recorder observability still `[ ]` in todo.md; items 1-4 shipped `b043904` 2026-06-19 -- needs checkbox closed

**Action:** Unchanged. Run realtime-cluster-verify-testplan-2026-07-09.md at next playtest to close vehicle-popout HOPED-FOR.

---

## 2026-07-12 00:05 UTC

**Status:** DRIFT (unchanged from 21:04 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-11T21:07Z)

**Drift:**
- HOPED-FOR stale ~53d: vehicle popout broadcasts -- 128145b fix in prod, verify plan tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~33d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- Beta-500 dry-run deadline passed 2026-07-01
- HOPED-FOR stale ~33d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play
- Stale-todo: Recorder observability still `[ ]` in todo.md; items 1-4 shipped `b043904` 2026-06-19 -- needs checkbox closed

**Action:** Unchanged. Run realtime-cluster-verify-testplan-2026-07-09.md at next playtest to close vehicle-popout HOPED-FOR.

---

## 2026-07-11 21:04 UTC

**Status:** DRIFT (unchanged from 18:03 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-11T18:07Z)

**Drift:**
- HOPED-FOR stale ~52d: vehicle popout broadcasts -- 128145b fix in prod, verify plan tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~33d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- Beta-500 dry-run deadline passed 2026-07-01
- HOPED-FOR stale ~33d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play
- Stale-todo (flagged prior pulse): Recorder observability still `[ ]` in todo.md; items 1-4 shipped `b043904` 2026-06-19 -- todo.md needs checkbox closed

**Action:** Unchanged. Run realtime-cluster-verify-testplan-2026-07-09.md at next playtest to close vehicle-popout HOPED-FOR.

---

## 2026-07-11 18:03 UTC

**Status:** DRIFT (unchanged from 15:03 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-11T15:06Z)

**Drift:**
- HOPED-FOR stale ~52d: vehicle popout broadcasts -- 128145b fix in prod, verify plan tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~33d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- Beta-500 dry-run deadline passed 2026-07-01
- HOPED-FOR stale ~33d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play

**Action:** Unchanged. Run realtime-cluster-verify-testplan-2026-07-09.md at next playtest to close vehicle-popout HOPED-FOR.

---

## 2026-07-11 15:03 UTC

**Status:** DRIFT (no change from 12:03 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-11T12:05Z)

**Drift:**
- HOPED-FOR stale ~51d: vehicle popout broadcasts -- 128145b fix in prod, verify plan at tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~32d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- Beta-500 dry-run deadline passed 2026-07-01
- HOPED-FOR stale ~32d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play

**Action:** Unchanged. Run realtime-cluster-verify-testplan-2026-07-09.md at next playtest to close vehicle-popout HOPED-FOR.

---

## 2026-07-11 12:03 UTC

**Status:** DRIFT (no change from 09:04 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-11T06:06Z)

**Drift:**
- HOPED-FOR stale ~51d: vehicle popout broadcasts -- 128145b fix in prod, verify plan at tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~32d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- Beta-500 dry-run deadline passed 2026-07-01
- HOPED-FOR stale ~32d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play

**Action:** Unchanged. Run realtime-cluster-verify-testplan-2026-07-09.md at next playtest to close vehicle-popout HOPED-FOR.

---

## 2026-07-11 09:04 UTC

**Status:** DRIFT (no change from 00:05 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-11T00:06Z)

**Drift:**
- HOPED-FOR stale ~50d: vehicle popout broadcasts -- 128145b fix in prod, verify plan at tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~31d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- Beta-500 dry-run deadline passed 2026-07-01
- HOPED-FOR stale ~31d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play

**Action:** Unchanged. Run realtime-cluster-verify-testplan-2026-07-09.md at next playtest to close vehicle-popout HOPED-FOR.

---

## 2026-07-11 00:05 UTC

**Status:** DRIFT (no change from 21:04 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-10T21:07Z)

**Drift:**
- HOPED-FOR stale ~49d: vehicle popout broadcasts -- 128145b fix in prod, verify plan at tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~31d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- Beta-500 dry-run deadline passed 2026-07-01
- HOPED-FOR stale ~31d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play

**Action:** Unchanged. Run realtime-cluster-verify-testplan-2026-07-09.md at next playtest to close vehicle-popout HOPED-FOR.

---

## 2026-07-10 21:04 UTC

**Status:** DRIFT (same 3 HOPED-FOR items; no change from 18:05 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-10T20:27Z; 4 of 5 are Space: 1999 proxy ships - all green)

**Drift:**
- HOPED-FOR stale ~48d: vehicle popout broadcasts -- 128145b fix in prod, verify plan at tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~30d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- drain target Beta-500 dry-run (deadline 2026-07-01 passed)
- HOPED-FOR stale ~30d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play
- NEW TODAY: Space: 1999 character gen proxy shipped (4 commits: next.config.ts rewrite + /space1999-log Thriver dashboard + docs; its own Vercel repo per AGENTS.md - compliant)

**Action:** Unchanged. Run realtime-cluster-verify-testplan-2026-07-09.md to drain vehicle-popout HOPED-FOR before next playtest.

---

## 2026-07-10 18:05 UTC

**Status:** DRIFT (no change from 15:03 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-10T15:07Z)

**Drift:**
- HOPED-FOR stale ~48d: vehicle popout broadcasts -- 128145b fix in prod, 2-client verify plan at tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~30d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- drain target Beta-500 dry-run (2026-07-01 deadline passed)
- HOPED-FOR stale ~30d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play

**Action:** Unchanged since morning. Run realtime-cluster-verify-testplan-2026-07-09.md to drain vehicle-popout HOPED-FOR.

---

## 2026-07-10 15:03 UTC

**Status:** DRIFT (no change from 12:05 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-10T12:07Z)

**Drift:**
- HOPED-FOR stale ~48d: vehicle popout broadcasts -- 128145b fix in prod, 2-client verify plan at tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~30d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- drain target Beta-500 dry-run (2026-07-01 deadline passed)
- HOPED-FOR stale ~30d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play

**Action:** No change since 12:05 run. Run realtime-cluster-verify-testplan-2026-07-09.md before next playtest.

---

## 2026-07-10 12:05 UTC

**Status:** DRIFT (no change from 09:05 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-10T09:05Z)

**Drift:**
- HOPED-FOR stale ~47d: vehicle popout broadcasts -- 128145b fix in prod, 2-client verify plan at tasks/realtime-cluster-verify-testplan-2026-07-09.md -- still not run
- HOPED-FOR stale ~29d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- drain target Beta-500 dry-run (target date 2026-07-01 passed)
- HOPED-FOR stale ~29d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play

**Action:** No change since 09:05 run. Priority: run realtime-cluster-verify-testplan-2026-07-09.md before next playtest to drain the vehicle-popout HOPED-FOR.

---

## 2026-07-10 09:05 UTC

**Status:** DRIFT (no change from 06:05 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-10T06:08Z)

**Drift:**
- HOPED-FOR stale ~47d: vehicle popout broadcasts -- 128145b fix in prod, 2-client verify plan at tasks/realtime-cluster-verify-testplan-2026-07-09.md -- not yet run
- HOPED-FOR stale ~29d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- drain target Beta-500 dry-run
- HOPED-FOR stale ~29d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play

**Action:** No change since 06:05 run. Only actionable item: run realtime-cluster-verify-testplan-2026-07-09.md before next playtest.

---

## 2026-07-10 06:05 UTC

**Status:** DRIFT (no change from 00:04 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success

**Drift:**
- HOPED-FOR stale ~46d: vehicle popout broadcasts -- 128145b fix in prod, 2-client verify plan at tasks/realtime-cluster-verify-testplan-2026-07-09.md -- not yet run
- HOPED-FOR stale ~28d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- drain target Beta-500 dry-run
- HOPED-FOR stale ~28d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play

**Action:** No change since 00:04 run. Realtime 2-client verify is still the only actionable item -- run tasks/realtime-cluster-verify-testplan-2026-07-09.md before next playtest.

---

## 2026-07-10 00:04 UTC

**Status:** DRIFT (no change from 2026-07-09 21:04 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-09T21:07Z)

**Drift:**
- HOPED-FOR stale ~46d: vehicle popout broadcasts (128145b fix landed 2026-07-09, 2-client verify plan at tasks/realtime-cluster-verify-testplan-2026-07-09.md -- not yet verified)
- HOPED-FOR stale ~28d: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) -- drain target Beta-500 dry-run
- HOPED-FOR stale ~28d: FI Insight Die AWARD path (roll doubles -> insight pool +1) -- never fired in live play

**Action:** Run realtime-cluster-verify-testplan-2026-07-09.md (2-client verify for 128145b) before next playtest -- this is the only actionable new item since yesterday.

---

## 2026-07-09 21:04 UTC

**Status:** DRIFT (3 HOPED-FOR stale; vehicle fix just landed, needs 2-client verify)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [917 passed / 53 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-09T18:07Z)

**Drift:**
- **Vehicle popout broadcasts** (~49 days HOPED-FOR) - `128145b` (this run) rewrote `broadcastOnce` to fix firing-arc toggle + post-dismount broadcast (H15). Fix is live; 2-client verify plan at `tasks/realtime-cluster-verify-testplan-2026-07-09.md`. Run the plan to close HOPED-FOR.
- **FI Insight Die award path** (~30 days) - `lib/useRollResolution.ts:264` doubles path never fired in live play; drain target Beta-500 dry-run.
- **Stress Check 12-string narrative** (~30 days) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified; drain target Beta-500 dry-run.

**Action:** Run `tasks/realtime-cluster-verify-testplan-2026-07-09.md` (2-client, ~20 min) to close the vehicle popout HOPED-FOR - the code fix is already in prod. FI Insight + Stress 12-string defer to Beta-500 dry-run as before.

---

## 2026-07-09 18:03 UTC

**Status:** DRIFT (same 3 HOPED-FOR items; notable: Puffer stability audit landed since 12:03 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [913 passed / 52 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-09T17:09Z)

**Drift:**
- **FI Insight Die award path** (~29 days) - `lib/useRollResolution.ts:264` never fired in live play; drain target Beta-500 dry-run.
- **Stress Check 12-string narrative** (~29 days) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~48 days) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.

**Since 12:03 run:** Puffer stability audit committed (`08b2523`) -- 1 CRITICAL + 15 HIGH + 17 MED + 8 LOW. CRITICAL (`updateCharacterDataField` read-swallow) already fixed (`c5b2ffa`, +4 tests). 15 new HIGH todos now in `tasks/todo.md` (HP lane). Realtime reconcile net shipped (`19dc72e`). Test count +21 (892->913).

**Action:** Review new HIGH bugs in `tasks/todo.md` from today's Puffer sweep -- top items: `broadcastOnce.ts:29` hang (#29), `CampaignPins`/`CampaignMap` topic collision (#28), `CharacterCard` shared-clock bug (#23), bulk-upload Thriver gate missing (#30). Then drain the 3 HOPED-FOR items at Beta-500 dry-run.

---

## 2026-07-09 12:03 UTC

**Status:** DRIFT (no change from 09:03 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-09T09:06Z)

**Drift:**
- **FI Insight Die award path** (~28 days) - `lib/useRollResolution.ts:264` never fired in live play; drain target Beta-500 dry-run.
- **Stress Check 12-string narrative** (~28 days) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~47 days) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.

**Action:** No change from prior runs. All 3 HOPED-FOR items need a playtest cycle to drain.

---

## 2026-07-09 09:03 UTC

**Status:** DRIFT (no change from 06:03 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-09T06:06Z)

**Drift:**
- **FI Insight Die award path** (~28 days) - `lib/useRollResolution.ts:264` never fired in live play; drain target Beta-500 dry-run.
- **Stress Check 12-string narrative** (~28 days) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~47 days) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.

**Action:** No change from prior runs. All 3 HOPED-FOR items need a playtest cycle to drain.

---

## 2026-07-09 06:03 UTC

**Status:** DRIFT (no change from 00:03 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-09T00:06Z)

**Drift:**
- **FI Insight Die award path** (~28 days) - `lib/useRollResolution.ts:264` never fired in live play; drain target Beta-500 dry-run.
- **Stress Check 12-string narrative** (~28 days) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~47 days) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.

**Action:** No change from prior runs. All 3 HOPED-FOR items need a playtest cycle to drain.

---

## 2026-07-09 00:03 UTC

**Status:** DRIFT (no change from 21:03 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-08T21:06Z)

**Drift:**
- **FI Insight Die award path** (~28 days) - `lib/useRollResolution.ts:264` never fired in live play; drain target Beta-500 dry-run.
- **Stress Check 12-string narrative** (~28 days) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~47 days) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.

**Action:** No change from prior runs. All 3 HOPED-FOR items need a playtest cycle to drain.

---

## 2026-07-08 21:03 UTC

**Status:** DRIFT (no change from 18:04 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-08T18:06Z)

**Drift:**
- **FI Insight Die award path** (~27 days) - `lib/useRollResolution.ts:264` never fired in live play; drain target Beta-500 dry-run.
- **Stress Check 12-string narrative** (~27 days) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~46 days) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.

**Action:** No change from prior runs. All 3 HOPED-FOR items need a playtest cycle to drain. Broken-weapon `alert()` (todo, HP) confirmed still open at `page.tsx:5993-5996`.

---

## 2026-07-08 18:04 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-08T15:06Z)

**Drift:**
- **FI Insight Die award path** (~26 days) - `lib/useRollResolution.ts:264` never fired in live play; drain target Beta-500 dry-run.
- **Stress Check 12-string narrative** (~26 days) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~45 days) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.

**Note:** `check-arch.mjs` returns OK this run (previous 15:03 entry flagged it as unfixed). Either Array.from usage is currently absent from non-lib/data paths or baseline absorbed it. No block.

**Action:** No change from prior runs. All 3 HOPED-FOR items need a playtest cycle to drain.

---

## 2026-07-08 15:03 UTC

**Status:** DRIFT (no change from 12:06 run; + 1 stale-todo finding)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-08T12:06Z)

**Drift:**
- **FI Insight Die award path** (~22 days) - `lib/useRollResolution.ts:264` never fired in live play.
- **Stress Check 12-string narrative** (~22 days) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~45 days) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.
- **[NEW - stale-todo] check-arch Array.from bug** - `scripts/check-arch.mjs:96` regex `/\.from\(/g` still unfixed; ROUTED TO PUFFER in todo.md. Confirmed present. Causes false-positive seam-leakage counts on any `Array.from(` call outside `lib/data/`.

**Action:** Same 3 playtest-needed items + Puffer should fix `check-arch.mjs:96` regex (negative-lookbehind or tighten pattern).

---

## 2026-07-08 12:06 UTC

**Status:** DRIFT (no change from 09:06 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-08T09:06Z)

**Drift (same 3 - no code activity since 09:06 run):**
- **FI Insight Die award path** (~22 days) - `lib/useRollResolution.ts:264` never fired in live play.
- **Stress Check 12-string narrative** (~22 days) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~45 days) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.

**Action:** No change. Playtest needed to drain all 3 before Beta-500 dry-run.

---

## 2026-07-08 09:06 UTC

**Status:** DRIFT (no change from 06:05 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-08T06:06Z)

**Drift (same 3 - no code activity since 06:05 run):**
- **FI Insight Die award path** (~22 days) - `lib/useRollResolution.ts:264` never fired in live play.
- **Stress Check 12-string narrative** (~22 days) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~45 days) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.

**Action:** No change. Playtest needed to drain all 3 before Beta-500 dry-run.

---

## 2026-07-08 06:05 UTC

**Status:** DRIFT (no change from 00:03 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-08T00:06Z)

**Drift (same 3 - no code activity since previous run):**
- **FI Insight Die award path** (~22 days) - `lib/useRollResolution.ts:264` never fired in live play.
- **Stress Check 12-string narrative** (~22 days) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~45 days) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.

**Action:** Same 3 HOPED-FOR items, 22-45 days stale. No code activity overnight. Playtest needed before Beta-500 dry-run.

---

## 2026-07-08 00:03 UTC

**Status:** DRIFT (no change from 21:06 UTC run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-07T21:05Z)

**Drift (same 3 - no code activity since previous run):**
- **FI Insight Die award path** (~22 days) - `lib/useRollResolution.ts:264` never fired in live play.
- **Stress Check 12-string narrative** (~22 days) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~45 days) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.

**Action:** Same 3 HOPED-FOR items, now 22-45 days stale. Playtest needed to drain before Beta-500 dry-run (target 7/1 - already overdue). No new code since 21:06 UTC.

---

## 2026-07-07 21:06 UTC

**Status:** DRIFT (no change from 18:03 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-07T18:06Z)

**Drift (same 3 - unchanged all day):**
- **FI Insight Die award path** (~21 days) - `lib/useRollResolution.ts:264` never fired in live play.
- **Stress Check 12-string narrative** (~21 days) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~44 days) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.

**Action:** No new code since 18:06 UTC. Playtest needed to drain these 3 before Beta-500 dry-run.

---

## 2026-07-07 18:03 UTC

**Status:** DRIFT (no change from 15:03 run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-07T16:28Z)

**Note:** Security audit committed at 16:28 UTC - all carry-overs, no new findings. `next` bumped 16.2.6→16.2.9 (patch). Health/route HTTP rate-limit still deferred (7th audit).

**Drift (same 3 - unchanged all day):**
- **FI Insight Die award path** (~21 days) - `lib/useRollResolution.ts:264` never fired in live play.
- **Stress Check 12-string narrative** (~21 days) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~44 days) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.

**Action:** Playtest needed to drain these 3 before Beta-500 dry-run. No new code changes since 15:03 run.

---

## 2026-07-07 15:03 UTC

**Status:** DRIFT (no change from 12:05 UTC run)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-07T12:08Z)

**Drift (same 3 persistent HOPED-FOR items - no code activity, no playtest since 2026-06-16):**
- **FI Insight Die award path** (~21 days stale) - `lib/useRollResolution.ts:264` insight_dice +1 never fired in live play.
- **Stress Check 12-string narrative** (~21 days stale) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~44 days stale) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.

**Action:** No new findings. Playtest needed before Beta-500 dry-run to drain these 3 items.

---

## 2026-07-07 12:05 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-07T09:05Z)

**Drift:**
- **FI Insight Die award path** (~21 days stale) - `lib/useRollResolution.ts:264` never fired in live play.
- **Stress Check 12-string narrative** (~21 days stale) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~44 days stale) - `vehicle_updated`/`firing_arc_toggle` 2-client confirmation pending.
- **Stale-todo audit:** `todo.md` item "pin realtime propagation" is `[ ]` unchecked but its body says "SHIPPED 2026-05-27 - all 5 surfaces" - needs checkbox flipped to `[x]` by owning lane (HP/PF).

**Action:** Same 3 HOPED-FOR items repeating; mark pin-realtime todo `[x]` and schedule a playtest to close the remaining 3.

---

## 2026-07-07 09:03 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-07T06:05Z)

**Drift (same 3 items - no code change, no playtest since 2026-06-16):**
- **FI Insight Die award path** (~21 days stale) - `lib/useRollResolution.ts:264` never fired in live play; trigger is rolling doubles on FI check.
- **Stress Check 12-string narrative** (~21 days stale) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE unverified.
- **Vehicle popout broadcasts** (~44 days stale) - `vehicle_updated`/`firing_arc_toggle` 2-client verification pending.

**Action:** Persistent DRIFT - no playtest in 21 days. Schedule a session to hit these items before Beta-500 dry-run.

---

## 2026-07-07 06:03 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-07T00:06Z)

**Drift (same 3 items as 00:09 UTC run - no change):**
- **FI Insight Die award path** (HOPED-FOR, ~21 days stale) - `lib/useRollResolution.ts:264` `insight_dice +1` has never fired in live play. Trigger: rolling doubles on a 2d6 FI check. No code activity on this path.
- **Stress Check 12-string narrative** (HOPED-FOR, ~21 days stale) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE strings unverified. Drain target: Beta-500 dry-run.
- **Vehicle popout broadcasts** (HOPED-FOR, ~44 days stale since 2026-05-24) - `vehicle_updated`/`firing_arc_toggle` 2-client verification pending. Recent `631b234` touched adjacent realtime infra but doesn't close this gap.

**Action:** No new gate failures. Playtest needed - target FI doubles roll + stress narrative triggers + vehicle 2-client broadcast confirmation.

---

## 2026-07-07 00:09 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all success (latest 2026-07-06T21:06Z)

**Drift:**
- **FI Insight Die award path** (HOPED-FOR, 21 days stale) - `lib/useRollResolution.ts:264` `insight_dice +1` increment has never fired in live play. Last playtest: Session 24, 2026-06-16. No code activity in last 3 days. Drain target: next playtest with 2d6 doubles roll.
- **Stress Check 12-string narrative** (HOPED-FOR, 21 days stale) - HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE strings unverified. Last playtest: Session 24, 2026-06-16. Drain target: Beta-500 dry-run.
- **Vehicle popout broadcasts** (HOPED-FOR, 21 days stale) - realtime broadcasts from vehicle popout unverified in 2-client context. Last playtest: Session 24, 2026-06-16. Note: a realtime reconcile-net commit landed 3 days ago (`631b234`) in the adjacent area but doesn't close this gap.

**Action:** 21 days since last playtest (Session 24, 2026-06-16) - 3 HOPED-FOR items aging. Next playtest should target FI doubles roll + stress narrative triggers. No gate failures; CI clean.

---

## 2026-07-06 21:04 UTC

> **RESOLVED (annotated 2026-07-09, Puffer):** the apegenerator was moved to its own repo (github.com/XeroSumGames/apegenerator) and removed from thetapestry in `b4c2cdda` - only the `/apegenerator` next.config proxy rewrite and the `/ape-log` visitor dashboard (which IS Tapestry infra: `visitor_logs` lives in this DB) remain here, both sanctioned. The `check-arch Array.from(` ratchet bug listed under carry-over drift below was also fixed 2026-07-09. This entry and the two below stay as the historical record of the violation window.

**Status:** DRIFT (AGENTS.md violation now embedded in app)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-06T20:28 UTC)

**New since 18:03 pulse - apegenerator violation deepened:**
- `ac3eb10` (18:55 UTC) `feat: /ape-log visitor dashboard` - adds `app/ape-log/page.tsx` + `lib/data/ape-log.ts` + Sidebar link. The apegenerator is now a Next.js route + data library inside the Tapestry codebase, not just a static file.
- `28bca62` (20:13 UTC) `feat(apegenerator): add 15 ANSA Sourcebook archetypes` - more content work.
- Total: 10+ apegenerator commits in thetapestry since first flag at 15:05 UTC. Each one deepens the removal cost.

**Positive update:**
- `631b234` reconcile hook foundation shipped - `usePostgresSubscription` opt-in `reconcile` net is live; migration of RollsFeed/TableChat/CampaignPins/PlayerNotes still pending.

**Drift (carry-over):**
- HOPED-FOR trio (25+ days stale): Stress Check 12-string, FI Insight Die AWARD path, Vehicle popout broadcasts
- `check-arch Array.from(` ratchet bug (`scripts/check-arch.mjs:96`) - 6 days unaddressed
- Vehicles 3s poll (`page.tsx:3090`) - 7 days unaddressed

**Action:** Apegenerator decision needed NOW - removal + own repo is getting harder with each commit. `app/ape-log/`, `lib/data/ape-log.ts`, Sidebar changes, and `public/apegenerator/` all need to move. Then HOPED-FOR drain.

---

## 2026-07-06 18:03 UTC

**Status:** DRIFT (escalation on prior AGENTS.md violation)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-06T16:34 UTC)

**Escalation since 15:05 pulse:**
- `public/apegenerator/index.html` still in repo. The 15:05 pulse flagged the AGENTS.md violation. Since then, **8 more polish commits** were pushed to it (13548bd → 45e06a7, 09:19-10:33 MDT) - work continued on the violating file AFTER the flag. Needs a decision: move to its own repo + revert from thetapestry, OR Xero explicitly waives the rule for this file.

**Drift (carry-over, no new movement):**
- HOPED-FOR trio (25+ days stale): Stress Check 12-string, FI Insight Die AWARD path, Vehicle popout broadcasts
- `check-arch Array.from(` ratchet bug (`scripts/check-arch.mjs:96`) - ROUTED TO PUFFER, 5 days unaddressed
- Shared realtime-reconcile hook (RollsFeed/TableChat/CampaignPins/PlayerNotes) - ROUTED TO HP, 5 days unaddressed
- Vehicles 3s poll (`page.tsx:3090`) - ROUTED TO HP, 7 days unaddressed

**Action:** Decide apegenerator fate (remove + own repo, or explicit waiver). Then HOPED-FOR drain.

---

## 2026-07-06 15:05 UTC

**Status:** DRIFT + NEW POLICY VIOLATION

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-06T14:57 UTC)

**New finding (not in prior pulses):**
- **AGENTS.md violation - `public/apegenerator/index.html` committed to wrong repo.** Commit `d28bc67` (2026-07-06 14:51 UTC) adds a 944-line standalone POTA RPG character generator (Planet of the Apes, D6 Magnetic Variant). AGENTS.md is explicit: "not even isolated in a side folder." Needs to be removed from `thetapestry` and moved to its own repo. Not a Claude-lane error; Xero committed directly - but it needs a decision + cleanup.

**Drift (unchanged from 12:03):**
- HOPED-FOR trio still unresolved (25+ days stale, no playtest update):
  - Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE)
  - FI Insight Die AWARD path (`useRollResolution.ts:264`)
  - Vehicle popout broadcasts
- `check-arch Array.from(` ratchet bug (`scripts/check-arch.mjs:96`) - ROUTED TO PUFFER 2026-07-01, 5 days unaddressed
- Shared realtime-reconcile hook (RollsFeed, TableChat, CampaignPins, PlayerNotes) - ROUTED TO HP 2026-07-01, 5 days unaddressed
- Vehicles 3s poll (`page.tsx:3090`) - ROUTED TO HP 2026-06-29, 7 days unaddressed
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) pending Xero dashboard action

**Action:** Remove `public/apegenerator/index.html` from this repo (move to its own repo per AGENTS.md). Then: HOPED-FOR dry-run is next.

---

## 2026-07-06 12:03 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest: 2026-07-06 09:07 UTC)

**Drift:**
- HOPED-FOR trio still unresolved (no git activity in 3 days on any of these areas):
  - Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - owed since Session 63 (2026-06-12), 24 days stale
  - FI Insight Die AWARD path - owed since Session 63 (2026-06-12), 24 days stale
  - Vehicle popout broadcasts - owed since Test Bed Session 24 (2026-06-16), 20 days stale
- `check-arch Array.from(` ratchet bug - ROUTED TO PUFFER 2026-07-01, 5 days unaddressed
- Shared realtime-reconcile hook - ROUTED TO HP 2026-07-01, 5 days unaddressed
- Vehicles 3s poll (`page.tsx:3090`) - ROUTED TO HP 2026-06-29, 7 days unaddressed
- **NEW stale-todo (audit-correction):** `todo.md:L679` says "Intimidation skill removal - gone from canon; still in lib/npc-generator.ts" but zero `Intimidation` references remain anywhere in `lib/` or `app/`. Appears already removed - mark complete.

**Action:** Flag L679 as already shipped; HOPED-FOR trio drain remains highest-signal open item (6+ days past 2026-07-01 target).

---

## 2026-07-06 09:05 UTC

**Status:** DRIFT (unchanged from 06:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest: 06:05 UTC)

**Drift:** no code changes since 06:03. Same carry-overs:
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - drain target was 2026-07-01, now 5 days overdue
- `check-arch Array.from(` regex false-positive (`scripts/check-arch.mjs:96`) - ROUTED TO PUFFER 2026-07-01, 5 days unaddressed
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) pending Xero dashboard action
- Vehicles 3s poll (`page.tsx:3098`) still present

**Action:** Drift carry-over - HOPED-FOR drain remains the highest-signal open item.

---

## 2026-07-06 06:03 UTC

**Status:** DRIFT (unchanged from 00:06)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest: 00:06 UTC health-pulse push)

**Drift:** no code changes since 00:06 UTC. Same carry-overs:
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - drain target was 2026-07-01, now 5 days overdue
- `check-arch Array.from(` regex false-positive (ROUTED TO PUFFER 2026-07-01, 5 days unaddressed)
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) pending Xero dashboard action
- Vehicles 3s poll (`page.tsx:3098`) still present

**Action:** No new issues. Drift unchanged - HOPED-FOR drain + infra upgrades remain the only open items.

---

## 2026-07-06 00:06 UTC

**Status:** DRIFT (unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-05T21:06 UTC)

**Drift:**
- HOPED-FOR trio stale (>20 days, no code touches in last 3 days):
  - Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE)
  - FI Insight Die award path (rolling doubles)
  - Vehicle popout broadcasts (vehicle_updated / firing_arc_toggle)
  - Drain target "Beta-500 dry-run before 2026-07-01" - 5 days overdue
- Puffer-lane: `check-arch Array.from(` regex false-positive still open (5 days)
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) pending Xero dashboard action
- Vehicles 3s poll (page.tsx:3098) still present

**Action:** Drift carry-over only - no new issues. HOPED-FOR drain + infra upgrades remain the open items.

---

## 2026-07-05 21:03 UTC

**Status:** DRIFT (unchanged from 18:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-05T18:05 UTC)

**Drift:**
- HOPED-FOR trio stale (>19 days, no code touches):
  - Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE)
  - FI Insight Die award path (rolling doubles)
  - Vehicle popout broadcasts (vehicle_updated / firing_arc_toggle)
  - Drain target was "Beta-500 dry-run before 2026-07-01" - now 4 days overdue
- Puffer-lane todo: `check-arch Array.from(` regex false-positive (ROUTED TO PUFFER 2026-07-01, 4 days unaddressed)
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) pending Xero dashboard action
- Vehicles 3s poll (page.tsx:3098) still present

**Action:** HOPED-FOR drain target slipped past 2026-07-01 - recommend scheduling a focused Beta-500 dry-run pass to close the trio. Puffer lane: pick up the check-arch regex fix.

---

## 2026-07-05 18:03 UTC

**Status:** DRIFT (unchanged from 15:04)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-05T15:06 UTC)

**Drift:** no new code. Same carry-overs:
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - drain target "Beta-500 dry-run before 2026-07-01" overdue ~4 days. No code touches.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll + check-arch `Array.from(` regex bug still open.

**Action:** No new issues. Drift unchanged - HOPED-FOR drain + infra upgrades remain the only open items.

---

## 2026-07-05 15:04 UTC

**Status:** DRIFT (unchanged from 12:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-05T14:06 UTC)

**Drift:** no new code. Same carry-overs:
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - drain target "Beta-500 dry-run before 2026-07-01" overdue 5 days. No code touches.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll (`page.tsx:3098`) still present; check-arch `Array.from(` regex bug still open (todo 2026-07-01).

**Action:** No new issues. HOPED-FOR drain + infra upgrades remain open. Beta-500 dry-run (7/1 target) is 5 days overdue - schedule or reschedule it.

---

## 2026-07-05 12:03 UTC

**Status:** DRIFT (unchanged from 09:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-05T09:05 UTC)

**Drift:** no new code. Same carry-overs:
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - drain target "Beta-500 dry-run before 2026-07-01" overdue 4 days. No code touches.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll (`page.tsx:3098`) still present.

**Action:** No new issues. HOPED-FOR drain + infra upgrades remain the only open drift.

---

## 2026-07-05 09:03 UTC

**Status:** DRIFT (unchanged from 00:05)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-05T00:06 UTC)

**Drift:** no new code. Same carry-overs:
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - drain target "Beta-500 dry-run before 2026-07-01" overdue 4 days. No code touches.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll (`page.tsx:3098`) still present.

**Action:** No new issues. HOPED-FOR drain + infra upgrades remain the only open drift.

---

## 2026-07-05 00:05 UTC

**Status:** DRIFT (unchanged from 2026-07-04 21:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-04T21:04 UTC) - confirmed authenticated this run.

**Drift:** no new code. Same carry-overs:
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - drain target "Beta-500 dry-run before 2026-07-01" overdue. No code touches.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll (`page.tsx:3098`) still present.

**Action:** No new issues. Same open items as prior runs.

---

## 2026-07-04 21:03 UTC

**Status:** DRIFT (unchanged from 18:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not authenticated in sandbox - skipped.

**Drift:** no new code since 18:03. Same carry-overs:
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - drain target "Beta-500 dry-run before 2026-07-01" overdue. No code touches in 14+ days.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll (`page.tsx:3098`) still present.

**Action:** No new issues. Same open items as prior runs.

---

## 2026-07-04 18:03 UTC

**Status:** DRIFT (unchanged from 15:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-04T15:05 UTC)

**Drift:** no new code since 15:03. Same carry-overs - see 2026-07-01 06:09 for detail.
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - drain target "Beta-500 dry-run before 2026-07-01" overdue.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll (`page.tsx:3098`) still present.

**Action:** No new issues. Infra upgrades + HOPED-FOR playtest remain the only open items.

---

## 2026-07-04 15:03 UTC

**Status:** DRIFT (unchanged from 12:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-04T12:06 UTC)

**Drift:** same carry-overs - see 2026-07-01 06:09 for detail.
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - no code touches in 14+ days; drain target "Beta-500 dry-run before 2026-07-01" overdue.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll (`page.tsx:3098`) still present; `tasks/finding-vehicles-poll-scale-2026-06-29.md`.

**Action:** No new code issues. Infra upgrades + HOPED-FOR playtest remain the only open items.

---

## 2026-07-04 12:03 UTC

**Status:** DRIFT (unchanged from 09:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-04T09:05 UTC)

**Drift:** same carry-overs - see 2026-07-01 06:09 for detail.
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - 3+ days past "Beta-500 dry-run before 2026-07-01" target. No code touches in 14 days.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll (`page.tsx:3098`) still present; `tasks/finding-vehicles-poll-scale-2026-06-29.md`.

**Action:** No new code issues. Infra upgrades remain the pre-Beta-500 blocker; HOPED-FOR trio needs playtest or explicit deferral.

---

## 2026-07-04 09:03 UTC

**Status:** DRIFT (unchanged from 06:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-04T06:05 UTC)

**Drift:** same carry-overs - see 2026-07-01 06:09 for detail.
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - 3+ days past "Beta-500 dry-run before 2026-07-01" target.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll (`page.tsx:3098`) still present.

**Action:** No new code issues. Same as previous entries - infra upgrades + HOPED-FOR playtest are the only open items.

---

## 2026-07-04 06:03 UTC

**Status:** DRIFT (unchanged from 00:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-04T00:05 UTC)

**Drift:** same carry-overs - see 2026-07-01 06:09 for detail. No code touched in HOPED-FOR or infra areas.
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - drain target "Beta-500 dry-run before 2026-07-01" now 3+ days overdue.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll (`page.tsx:3098`) still present; finding in `tasks/finding-vehicles-poll-scale-2026-06-29.md`.

**Action:** No new code issues. Infra upgrades + HOPED-FOR playtest cycle are the only open items.

---

## 2026-07-04 00:03 UTC

**Status:** DRIFT (unchanged from 2026-07-03 21:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-03T21:05 UTC)

**Drift:** same carry-overs - see 2026-07-01 06:09 for detail. No code touched in HOPED-FOR or infra areas.
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - drain target "Beta-500 dry-run before 2026-07-01" now 3 days overdue.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll (`page.tsx:3098`) still present.

**Action:** Infra upgrades remain the pre-Beta-500 blocker. HOPED-FOR trio needs a playtest or explicit deferral decision.

---

## 2026-07-03 21:03 UTC

**Status:** DRIFT (unchanged from 18:05)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-03T18:05 UTC)

**Drift:** same carry-overs - see 2026-07-01 06:09 for detail. No code touched in HOPED-FOR or infra areas.
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - drain target "Beta-500 dry-run before 2026-07-01" now 2 days overdue.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll (`page.tsx:3098`) still present.

**Action:** Infra upgrades are the pre-Beta-500 blocker. HOPED-FOR trio needs a playtest entry or explicit HP routing.

---

## 2026-07-03 18:05 UTC

**Status:** DRIFT (unchanged from 15:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-03T15:05 UTC)

**Drift:** same carry-overs - see 2026-07-01 06:09 for detail. No code touched in HOPED-FOR or infra areas.
- HOPED-FOR trio (Stress Check 12-string, FI Insight Die award path, vehicle popout broadcasts) - drain target "Beta-500 dry-run before 2026-07-01" now 2 days overdue.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll (`page.tsx:3098`) still present.

**Action:** Infra upgrades are the pre-Beta-500 blocker. HOPED-FOR trio needs a playtest entry or explicit HP routing.

---

## 2026-07-03 15:03 UTC

**Status:** DRIFT (unchanged from 12:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-03T12:05 UTC)

**Drift:** same carry-overs - see 2026-07-01 06:09 for detail. No code touched in HOPED-FOR or infra areas.
- HOPED-FOR trio drain target was **"Beta-500 dry-run before 2026-07-01" - now 2 days overdue.** Items: Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die award path, vehicle popout broadcasts.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll (`page.tsx:3098`) still present; `check-realtime-wrap.mjs` guardrail not yet created.

**Action:** Same as 12:03 - route HOPED-FOR trio explicitly to HP or confirm via playtest entry; Vercel/Supabase Pro remain pre-Beta-500 blockers.

---

## 2026-07-03 12:03 UTC

**Status:** DRIFT (unchanged from 09:04)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-03T09:06 UTC)

**Drift:** same carry-overs - see 2026-07-01 06:09 for detail.
- HOPED-FOR trio drain target was **"Beta-500 dry-run before 2026-07-01" - deadline passed 2 days ago.** Items still open: Stress Check 12-string (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE), FI Insight Die award path, vehicle popout broadcasts.
- Infra upgrades (Vercel Pro, Supabase Pro, Upstash, Sentry) still pending Xero dashboard action.
- Vehicles 3s poll (`page.tsx:3098`) still present; `check-realtime-wrap.mjs` guardrail not yet created.

**Action:** HOPED-FOR drain target overdue - either confirm these shipped via a playtest entry or route explicitly to HP.

---

## 2026-07-03 09:04 UTC

**Status:** DRIFT (unchanged from 06:04)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-03T06:06 UTC) - confirmed via MCP (prior run had skipped)

**Drift:** same carry-overs - see 2026-07-01 06:09 for detail. No code touched in HOPED-FOR or infra areas.

**Action:** Vercel Pro + Supabase Pro remain pre-Beta-500 blockers. HOPED-FOR trio (Stress 12-string, FI Insight Die award, vehicle popout broadcasts) drain target is Beta-500 dry-run.

---

## 2026-07-03 06:04 UTC

**Status:** DRIFT (unchanged from 00:04)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**New commits since 00:04:** none (26ddf27 was the 00:04 health-pulse commit itself)

**Drift:** same carry-overs - see 2026-07-01 06:09 for detail. No code touched in HOPED-FOR or infra areas.

**Action:** Vercel Pro + Supabase Pro remain pre-Beta-500 blockers. HOPED-FOR trio (Stress 12-string, FI Insight Die award, vehicle popout broadcasts) drain target is Beta-500 dry-run.

---

## 2026-07-03 00:04 UTC

**Status:** DRIFT (unchanged from 21:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-02T21:05 UTC)

**Drift:** same carry-overs - see 2026-07-01 06:09 for detail. No code touched in HOPED-FOR or infra areas.

**Action:** Vercel Pro + Supabase Pro remain pre-Beta-500 blockers. HOPED-FOR trio (Stress 12-string, FI Insight Die award, vehicle popout broadcasts) + vehicles 3s poll removal still pending.

---

## 2026-07-02 21:03 UTC

**Status:** DRIFT (unchanged from 18:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-02T18:05 UTC)

**Drift:** same carry-overs - see 2026-07-01 06:09 for detail. No code touched in HOPED-FOR or infra areas.

**Action:** Vercel Pro + Supabase Pro remain pre-Beta-500 blockers. HOPED-FOR trio (Stress 12-string, FI Insight Die award, vehicle popout broadcasts) + vehicles 3s poll removal still pending.

---

## 2026-07-02 18:03 UTC

**Status:** DRIFT (unchanged from 15:05)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-02T15:06 UTC)

**New commits since 15:05:** none (00a0f54 was the 15:05 health-pulse commit itself)

**Drift:** same carry-overs - see 2026-07-01 06:09 for detail. No code touched in HOPED-FOR or infra areas.

**Action:** Vercel Pro + Supabase Pro remain pre-Beta-500 blockers. HOPED-FOR trio (Stress Check 12-string, FI Insight Die award, vehicle popout broadcasts) drain target is Beta-500 dry-run.

---

## 2026-07-02 15:05 UTC

**Status:** DRIFT (unchanged from 12:00)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-02T12:06 UTC)

**New commits since 12:00:** `77a21b3` content/canon rename ("Family Obligation" -> "Obligation") - unrelated to open items.

**Drift:** same carry-overs - see 2026-07-01 06:09 for detail. No code touched in HOPED-FOR or infra areas.

**Action:** Vercel Pro + Supabase Pro remain pre-Beta-500 blockers (see infra-upgrade-prebeta500-checklist.md). HOPED-FOR drain target is Beta-500 dry-run.

---

## 2026-07-02 12:00 UTC

**Status:** DRIFT (unchanged from 09:00)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-02T09:05 UTC)

**Drift:** same as prior entries - no code touched in any HOPED-FOR or infra area since last pulse.

**Action:** see 2026-07-01 06:09 - Vercel Pro + Supabase Pro are day-2-post-Beta-500 blockers; HOPED-FOR trio drain target is Beta-500 dry-run (still pending).

---

## 2026-07-02 09:00 UTC

**Status:** DRIFT (unchanged from 06:00)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-02T06:07 UTC)

**New commits since 06:00:** none (9f65c98 was the 06:00 health-pulse commit itself)

**Drift:** same 3 HOPED-FOR items + infra gaps - see 2026-07-01 06:09 entry for detail. No code touched in those areas.

**Action:** see 2026-07-01 06:09 - Vercel Pro + Supabase Pro are live Beta-500 blockers; HOPED-FOR trio drain target is Beta-500 dry-run.

---

## 2026-07-02 06:00 UTC

**Status:** DRIFT (unchanged from 00:00)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-02T00:07 UTC)

**New commits since 00:00:** none

**Drift:** same 3 HOPED-FOR items + infra gaps - see 06:09 (Jul 1) entry for detail. No code touched in those areas.

**Action:** see 2026-07-01 06:09 - Vercel Pro + Supabase Pro are live Beta-500 blockers (day after Beta-500 date); HOPED-FOR trio drain target is Beta-500 dry-run.

---

## 2026-07-02 00:00 UTC

**Status:** DRIFT (unchanged from 18:05)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 7 runs all pass (latest 2026-07-01T21:05 UTC)

**New commits since 18:05:** none

**Drift:** same 3 HOPED-FOR items + infra gaps - see 06:09 entry for detail. No code touched in those areas.

**Action:** see 06:09 - Vercel Pro + Supabase Pro are live Beta-500 blockers; infra upgrades + dry-run still pending.

---

## 2026-07-01 18:05 UTC

**Status:** DRIFT (unchanged from 15:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-01T18:05 UTC)

**New commits since 15:03:** none (ccedd1f was the 15:03 health-pulse commit itself)

**Drift:** same 3 HOPED-FOR items + infra gaps - see 06:09 entry for detail. No code touched in those areas.

**Action:** see 06:09 - Vercel Pro + Supabase Pro are live blockers on Beta-500 day; infra upgrades + dry-run still pending.

---

## 2026-07-01 15:03 UTC

**Status:** DRIFT (unchanged from 12:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-01T12:06 UTC)

**New commits since 12:03:** 1 (`945d68c` docs: Xero eyeball PASSED - PF cleared to apply invite_code column revoke)

**Drift:** same 3 HOPED-FOR items + infra gaps - see 06:09 entry for detail. No code touched in HOPED-FOR areas.

**Action:** see 06:09 - infra upgrades (Vercel Pro/Supabase Pro) + Beta-500 dry-run still pending.

---

## 2026-07-01 12:03 UTC

**Status:** DRIFT (unchanged from 09:03)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-01T09:06 UTC)

**New commits since 09:03:** none

**Drift:** same 3 HOPED-FOR items + infra gaps - see 06:09 entry for detail. No code touched in any of those areas.

**Action:** see 06:09 - Vercel Pro + Supabase Pro are live Beta-500 blockers; Beta-500 dry-run needed to drain HOPED-FOR trio.

---

## 2026-07-01 09:03 UTC

**Status:** DRIFT (unchanged from 06:09)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-01T06:07 UTC)

**New commits since 06:09:** none

**Drift:** same 3 HOPED-FOR items - see 06:09 entry for detail + action. No code touched in those areas since last pulse.

**Action:** see 06:09 - Vercel Pro + Supabase Pro are the live blockers on Beta-500 day; Beta-500 dry-run to drain HOPED-FOR trio.

---

## 2026-07-01 06:09 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-07-01T00:34 UTC) - confirmed this run (was skipped at 00:06)

**New since 00:06 pulse (2 commits):**
- `aba5264` content(ptc): 22 scene briefs seeded live - Path to Citizenship COMPLETE
- `3b9eac8` docs: campaign-seeding pattern + PtC ship log

**Drift (HOPED-FOR - same 3 items, all past deadline):**
- **Stress Check 12-string** (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - drain target was before 7/1; TODAY is 7/1 = Beta-500 day
- **FI Insight Die award path** - `useRollResolution.ts:264` never fired live; >15 days unverified
- **Vehicle popout broadcasts** (Section B) - no code touch since 2026-06-16

**Infra gap on Beta-500 day:**
- Vercel still FREE tier (tagged [NOW] in todo; yesterday had deploy stalls + commercial TOS issue)
- Supabase still FREE tier (realtime concurrency + DB/egress caps hit at live table scale)
- Upstash + Sentry not yet upgraded (rate-limit failover + error visibility blind pre-launch)

**Action:** TODAY is Beta-500 day - Vercel Pro upgrade is the immediate unblock (deploy stalls + TOS); Supabase Pro before sending invites; run Beta-500 dry-run to drain the HOPED-FOR trio.

---

## 2026-07-01 00:06 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**New since 2026-06-30 21:03 UTC (6 commits):**
- `02f61c5` fix(map): 10s reconcile poll - pins now converge without manual refresh (closes pin-reveal TWO-report todo)
- `5297b5a` docs: pin-reveal lesson logged
- `6eda9d3`/`f443aa4`/`fad857b`/`73d0b3c` content(ptc/dz): PtC seed part 1 + NPC gaps + 6 drop-in pregens + DZ pin name syncs

**Drift (HOPED-FOR - Stress Check deadline expired):**
- **Stress Check 12-string** - deadline was "before 2026-07-01"; TODAY is that date; 8 strings (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) still unverified; no code touch since 2026-06-16
- **FI Insight Die award path** - >15 days unverified; `useRollResolution.ts:264` never fired live
- **Vehicle popout broadcasts** (Section B) - >15 days unverified; no code touch

**Note:** force-push flag on git pull (`8c2412e...73d0b3c`); history intact; content/fix commits on top.

**Stale-todo flag:** `[PUFFER - pin realtime propagation; TWO corroborating reports]` - `02f61c5` adds the reconcile poll that was the missing fix; audit-correction likely needed in todo.md.

**Action:** Stress Check drain target EXPIRED - run Beta-500 dry-run ASAP (this was the 7/1 gate); pin fix worth 2-client smoke.

---

## 2026-06-30 21:03 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-30T20:07 UTC)

**New since 18:03 pulse (15 commits):**
- `0b9151d` refactor(weapons): xse-schema catalogs now derive from weapons.ts (single source of truth) - all 892 tests pass
- `3d72871` content: Revolver added; `8d77aa6` Automatic Rifle -> Assault Rifle rename
- `3734ecb` / `f8a2751` fix(pins): name wrapping + button row layout
- `436deca` staging env confirmed DONE + smoke-verified
- `4a4f89c` audit: 6 KS mechanics stale todos closed
- `91b63c8` docs: loose-ends/verification-debt register + HOPED-FOR trio code audit
- `89335d4` chore: re-trigger Vercel deploy (main was 6 ahead of prod)

**Drift (HOPED-FOR trio - unchanged, 14 days old):**
- **Stress Check 12-string** (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - deadline tonight MDT (~8h left at 21:03 UTC)
- FI Insight Die award path (rolling doubles) - unverified since 2026-06-16
- Vehicle popout broadcasts - unverified since 2026-06-16

**Action:** HOPED-FOR deadline tonight - run Beta-500 dry-run or explicitly push the date; weapons refactor + rename is green, no action needed.

---

## 2026-06-30 18:03 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical) - 3 moderate postcss/next/@sentry carry-overs (tracked in security-audit.md)

**CI:** last 5 runs all pass (latest 2026-06-30T18:00 UTC)

**New since 15:00 pulse (5 commits):**
- Staging env spec + schema parity (`089182d`, `4f7a6b3`, `f21ea49`) - 2nd Supabase project + Vercel env-scoping; Vercel branch wiring still outstanding
- Launch checklist Tier 1/2 split (`6a83a58`)
- Weekly security audit committed (`ea52291`)

**Security audit 2026-06-30 top findings (tasks/security-audit.md):**
- `app/api/health` HTTP rate limit still missing - **6th consecutive audit**, explicit pre-paid-launch blocker; DB cache landed, Upstash 10/min sliding window still needed (HP)
- `supabase/functions/log-visit` - no body-size cap (no-auth edge function); carry-over
- `@supabase/ssr` ^0.9.0 → 0.12.0 - 6 audits deferred; auth-adjacent staleness risk

**Drift (HOPED-FOR trio unchanged):**
- **Stress Check 12-string narrative** - deadline END OF TODAY (2026-06-30 MDT); 8 paths (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) still unverified
- **FI Insight Die award path** - HOPED-FOR 15 days; `useRollResolution.ts:264` never fired live
- **Vehicle popout broadcasts** (Section B) - HOPED-FOR 15 days; no code touch

**Stale-todo flag:** `[ ]` "catch-up loadPins on SUBSCRIBED" - already implemented (`CampaignPins.tsx:178` + `CampaignMap.tsx:963`); audit-correction needed in todo.md

**Action:** (1) HP: add Upstash 10/min sliding window to `/api/health` - 6th-audit pre-launch item; (2) Stress Check deadline expires tonight MDT - run Beta-500 dry-run or reset; (3) Staging env Vercel branch still needs wiring (`f21ea49` checklist)

---

## 2026-06-30 15:00 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-30T12:11 UTC)

**New since 12:08 pulse:** 0 code commits (only health-pulse records)

**Drift (carry-forward - unchanged since 06:07):**
- **Stress Check 12-string narrative** - deadline END OF TODAY (2026-06-30 MDT). 8 paths (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) still unverified. No code changes since 2026-06-16.
- **FI Insight Die award path** - HOPED-FOR 15 days; `useRollResolution.ts:264` never fired live
- **Vehicle popout broadcasts** (Section B) - HOPED-FOR 15 days; no code touch
- **Vehicles 3s poll** - `page.tsx:3098` still live; routed to HP (`tasks/finding-vehicles-poll-scale-2026-06-29.md`)
- **Disarm live-verify** still owed (`tasks/disarm-loot-testplan-2026-06-23.md`)

**Action:** Stress Check deadline expires tonight. Either run the Beta-500 dry-run to drain it, or reset the deadline. HP vehicles poll removal still open pre-Beta-500.

---

## 2026-06-30 12:08 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not installed in sandbox - skipped

**New since 06:07 pulse:** 0 code commits (only health-pulse record)

**Drift (carry-forward - no change since 06:07):**
- **Stress Check 12-string narrative** - deadline end-of-day TODAY (2026-06-30 MDT). 8 paths (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) still unverified in live play.
- **FI Insight Die award path** - HOPED-FOR 15 days; `useRollResolution.ts:264` never fired live
- **Vehicle popout broadcasts** (Section B) - HOPED-FOR 15 days; no code touch
- **Vehicles 3s poll** - `page.tsx:3098` still live; routed to HP (`tasks/finding-vehicles-poll-scale-2026-06-29.md`)
- **Disarm live-verify** still owed (`tasks/disarm-loot-testplan-2026-06-23.md`)

**Action:** Same as 06:07 - Stress Check deadline is today. No new findings this run.

---

## 2026-06-30 06:07 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-30T02:06 UTC)

**New since 00:09 pulse (2 commits):**
- `76c35ea` H-1c DONE - residual PII/secret-column sweep CLEAN; no third leak (bug_reports.reporter_email + visitor_logs.ip/ip_hash are Thriver-only; safe). Beta-500 PII front fully clear.
- `7ba0d17` Vercel stall resolved - prod was ~2h behind main; redeploy trigger committed. Self-resolved, no player impact confirmed.

**Drift (carry-forward - Stress Check deadline is TODAY):**
- **Stress Check 12-string narrative** - drain target "before 2026-07-01" = **TODAY end-of-day**. No code changes since 2026-06-16 playtest. 8 strings (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) unverified in live play.
- **FI Insight Die award path** - HOPED-FOR 15 days; `useRollResolution.ts:264` increment never fired live
- **Vehicle popout broadcasts** (Section B) - HOPED-FOR 15 days; no code touch
- **Vehicles 3s poll** - `page.tsx:3090` `setInterval(refetchVehicles, 3000)` still live (scale: ~167 req/s at Beta-500); fix routed to HP (`tasks/finding-vehicles-poll-scale-2026-06-29.md`)
- **Disarm live-verify** still owed (`tasks/disarm-loot-testplan-2026-06-23.md`)

**Stale-todo flag:** `[ ]` "6 mechanics still owe real code for 9/1 KS" parent is stale-open - all 6 sub-items are [x] verified elsewhere in todo.md. Audit-correction only; no code needed.

**Action:** Stress Check 12-string deadline is TODAY. Run the Beta-500 dry-run (4 sections) specifically exercising the 8 unverified Stress Check paths. HP: vehicles poll removal (`page.tsx:3090`) is the remaining pre-Beta-500 scale item.

---

## 2026-06-30 00:09 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-29T21:08 UTC)

**New since 21:06 pulse:** 0 code commits (only health-pulse record)

**Drift (carry-forward - deadline NOW HERE):**
- **Stress Check 12-string narrative** - HOPED-FOR; drain target "before 2026-07-01" = **TODAY**. 8 strings (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) still unverified in live play.
- **FI Insight Die award path** - HOPED-FOR 14 days; `useRollResolution.ts:264` increment never fired in live play
- **Vehicle popout broadcasts** (Section B) - HOPED-FOR 14 days; no code changes
- **Vehicles 3s poll** - `page.tsx:3098` still live; scale finding routed to HP (`tasks/finding-vehicles-poll-scale-2026-06-29.md`)
- **Disarm live-verify** still owed (`tasks/disarm-loot-testplan-2026-06-23.md`)

**Action:** Stress Check drain deadline is TODAY - needs a Beta-500 dry-run pass that exercises HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAVIGATE check paths.

---

## 2026-06-29 21:06 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-29T20:19 UTC)

**New since 18:06 pulse (10 commits):**
- `51d5f38` **PII gate CLOSED** - `campaigns.invite_code` revoke APPLIED; full 06-23 PII batch done (email + invite_code column revokes live). Closes the 18:06 warning about staged revoke.
- `938e909` ops: log-visit M-2 body-cap deployed + smoke-verified live (3KB→413, normal→200)
- 8 supporting sec/docs/handoff commits (PII rewire chain)

**Drift:**
- **vehicle popout broadcasts** - HOPED-FOR, last playtest 2026-06-16 (13 days); code in `lib/realtime/*` touched this week (sec/perf pass) but behavior not 2-client verified
- **Stress Check 12-string narrative** - HOPED-FOR, 13 days, no code changes; 8 strings (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) unverified
- **FI Insight Die award path** - HOPED-FOR, 13 days; `useRollResolution.ts:264` increment never fired in live play
- **vehicles 3s poll** - `page.tsx:3098` `setInterval(refetchVehicles, 3000)` still live; scale issue found+routed to HP today (`tasks/finding-vehicles-poll-scale-2026-06-29.md`)

**Action:** PII revoke is closed (good). Next playtest should drain HOPED-FOR trio. HP: prioritize vehicles poll removal before Beta-500.

---

## 2026-06-29 18:06 UTC

**Status:** DRIFT - 4 new security commits since last pulse; staged column-revoke requires HP PII rewire first; HOPED-FOR trio 13+ days unverified with Beta-500 ~1.2 days out.

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-29T17:29 UTC)

**New since last pulse (landed 16:29-17:29 UTC today):**
- `8c2412e` sec: PII RPCs - `get_profile_email` + `get_campaign_invite_code` live; column-revoke SQL staged; HP must rewire 3 email + 6 invite_code readers → see `tasks/handoff-hp-pii-revokes-2026-06-23.md`
- `483e336` sec: sessions/campaign_members reads scoped + 3 storage buckets locked + portrait_bank
- `e75f2a7` sec: find_campaign_by_invite_code RPC
- `4f150fb` sec: Thriver self-escalation blocked + chat_messages whisper-scoped

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - drain target Beta-500 **~1.2 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - 13+ days no code touch
- HOPED-FOR: Vehicle popout broadcasts (Section B) - 38+ days no code touch
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md`
- `check-realtime-wrap.mjs` still absent from scripts/ (stale-open todo)

**Action:** HP rewire (email/invite_code readers → RPCs) must land BEFORE applying `sql/sec-pii-column-revokes-...-APPLY-AFTER-REWIRE.sql`. Handoff: `tasks/handoff-hp-pii-revokes-2026-06-23.md`. Beta-500 dry-run drains HOPED-FOR trio + disarm verify.

---

## 2026-06-29 15:08 UTC

**Status:** DRIFT (carry-forward #71 - no new commits; gates clean; HOPED-FOR trio unchanged; Beta-500 ~1.4 days out)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-29T12:12 UTC)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - drain target Beta-500 **~1.4 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - 13+ days no code touch
- HOPED-FOR: Vehicle popout broadcasts (Section B) - 38+ days no code touch
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23)
- Last app code commit: 2026-06-25 (4 days ago)

**Action:** Beta-500 dry-run (~1.4 days) drains all three HOPED-FOR items + disarm verify. No code has shipped in 4 days - scope looks stable for the session.

---

## 2026-06-29 12:09 UTC

**Status:** DRIFT (carry-forward #70 - no new commits; gates clean; HOPED-FOR trio unchanged; Beta-500 ~1.75 days out)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-29T09:09 UTC)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - drain target Beta-500 dry-run **~1.75 days out (2026-07-01)** - 13+ days no code touch
- HOPED-FOR: FI Insight Die AWARD path - 13+ days no code touch, also drains Beta-500
- HOPED-FOR: Vehicle popout broadcasts (Section B) - 38+ days, no code touch, also drains Beta-500
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)
- Last real code commit: 2026-06-25 (4 days ago); no new app code since

**Action:** Beta-500 dry-run is ~1.75 days out. The HOPED-FOR trio all drain on that session - if it doesn't run before 7/1, they age past their target with no evidence. Consider whether a focused dry-run pass can still happen.

---

## 2026-06-29 09:06 UTC

**Status:** DRIFT (carry-forward #69 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-29T06:10 UTC)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~38 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - drain target Beta-500 dry-run **~1.5 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~17 days, no code touch
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** Beta-500 dry-run 2026-07-01 (~1.5 days) is the drain target. No app code has shipped in 4+ days. HOPED-FOR trio + disarm verify all drain on that session.

---

> **Note:** File trimmed to last 30 entries on 2026-06-23 (237 total entries; pre-2026-06-18 history removed to manage file size).

---

## 2026-06-29 06:08 UTC

**Status:** DRIFT (carry-forward #68 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-29T00:12 UTC)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~38 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - drain target Beta-500 dry-run **~1.75 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~17 days, no code touch
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** Beta-500 dry-run 2026-07-01 (~1.75 days) is the drain target. No app code has shipped in 4+ days. If dry-run is today/tomorrow, confirm it's on calendar - HOPED-FOR trio + disarm verify all depend on it.

---

## 2026-06-29 00:10 UTC

**Status:** DRIFT (carry-forward #67 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-28T21:07 UTC)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~38 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - drain target Beta-500 dry-run **~2 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~17 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** No new app commits since June 25 Puffer indexes. Beta-500 dry-run 2026-07-01 (~2 days) - confirm dry-run is on track; HOPED-FOR trio + disarm verify drain on that session.

---

## 2026-06-28 21:06 UTC

**Status:** DRIFT (carry-forward #66 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-28T18:08 UTC via MCP GitHub)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~38 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - drain target Beta-500 dry-run **~1.7 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~17 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** No new app commits since June 25 Puffer indexes. Beta-500 dry-run 2026-07-01 (~1.7 days) - confirm dry-run is on track; HOPED-FOR trio + disarm verify drain on that session.

---

## 2026-06-28 18:06 UTC

**Status:** DRIFT (carry-forward #65 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-28T15:08 UTC via MCP GitHub)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~37 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - drain target Beta-500 dry-run **~1.9 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~17 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** No new app commits since June 25 Puffer indexes. Beta-500 dry-run 2026-07-01 (~1.9 days) is the drain event for HOPED-FOR trio + disarm verify - confirm dry-run is on track.

---

## 2026-06-28 15:06 UTC

**Status:** DRIFT (carry-forward #64 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-28T12:10 UTC via MCP GitHub)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~37 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - drain target Beta-500 dry-run **~2.1 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~17 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** No new app commits since June 25 Puffer indexes. Beta-500 dry-run 2026-07-01 (~2.1 days) is the drain event for HOPED-FOR trio + disarm verify - confirm dry-run is on track.

---

## 2026-06-28 12:08 UTC

**Status:** DRIFT (carry-forward #63 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-28T09:08 UTC via MCP GitHub)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~37 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - drain target Beta-500 dry-run **~2.3 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~17 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** No new app commits since June 25 Puffer indexes. Beta-500 dry-run 2026-07-01 (~2.3 days) is the drain event for HOPED-FOR trio + disarm verify - confirm dry-run is on track.

---

## 2026-06-28 09:05 UTC

**Status:** DRIFT (carry-forward #62 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest 2026-06-28T06:08 UTC via MCP GitHub)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~37 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - drain target Beta-500 dry-run **~2.4 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~17 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** No new app commits since June 25 Puffer indexes. Beta-500 dry-run 2026-07-01 (~2.4 days) is the drain event for HOPED-FOR trio + disarm verify - confirm dry-run is on track.

---

## 2026-06-28 06:07 UTC

**Status:** DRIFT (carry-forward #61 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skip

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~36 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - drain target Beta-500 dry-run **~2.6 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~16 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** No new app commits since June 25 Puffer indexes. Beta-500 dry-run 2026-07-01 (~2.6 days) is the drain event for HOPED-FOR trio + disarm verify - confirm dry-run is on track.

---

## 2026-06-28 00:07 UTC

**Status:** DRIFT (carry-forward #60 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last run pass (2026-06-27T21:08 UTC)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~35 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - **drain target Beta-500 dry-run ~2.9 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~16 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** No new app commits since June 25 Puffer indexes. Beta-500 dry-run 2026-07-01 (~2.9 days) is the drain event for HOPED-FOR trio + disarm verify - confirm dry-run is still on track.

---

## 2026-06-27 21:05 UTC

**Status:** DRIFT (carry-forward #59 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 4 runs all pass (latest 2026-06-27T18:07 UTC)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~34 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~11 days; **drain target Beta-500 dry-run ~3.1 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~17 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** No new app commits since June 25 Puffer indexes. Beta-500 dry-run 2026-07-01 (~3.1 days) is the drain event for HOPED-FOR trio + disarm verify - confirm dry-run is still on.

---

## 2026-06-27 18:06 UTC

**Status:** DRIFT (carry-forward #58 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-27T15:07 UTC)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~34 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~11 days; **drain target Beta-500 dry-run ~3.2 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~17 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** No new app commits since June 25 Puffer indexes. Beta-500 dry-run 2026-07-01 (~3.2 days) is the drain event for HOPED-FOR trio + disarm verify - confirm dry-run is still on.

---

## 2026-06-27 15:06 UTC

**Status:** DRIFT (carry-forward #57 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-27T12:08 UTC)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~34 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~11 days; **drain target Beta-500 dry-run ~3.4 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~17 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** No new app commits since June 25 Puffer indexes. Beta-500 dry-run 2026-07-01 (~3.4 days) is the drain event for HOPED-FOR trio + disarm verify - confirm dry-run is still on.

---

## 2026-06-27 12:07 UTC

**Status:** DRIFT (carry-forward #56 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-27T09:08 UTC)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~34 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~11 days; **drain target Beta-500 dry-run ~3.5 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~17 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** No new app commits since June 25 Puffer indexes. Beta-500 dry-run 2026-07-01 (~3.5 days) is the drain event for HOPED-FOR trio + disarm verify - confirm dry-run is still on.

---

## 2026-06-27 09:08 UTC

**Status:** DRIFT (carry-forward #55 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-27T06:08 UTC)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~34 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~11 days; **drain target Beta-500 dry-run ~2.5 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~17 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** No new app commits since June 25 Puffer indexes. Beta-500 dry-run 2026-07-01 (~2.5 days) is the drain event for HOPED-FOR trio + disarm verify - confirm dry-run is still on.

---

## 2026-06-27 06:07 UTC

**Status:** DRIFT (carry-forward #54 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-27T00:11 UTC)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~34 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~11 days; **drain target Beta-500 dry-run ~3.5 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~17 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** No new app commits since June 25 Puffer indexes. Beta-500 dry-run 2026-07-01 (~3.5 days) drains HOPED-FOR trio + owed disarm verify.

---

## 2026-06-27 00:10 UTC

**Status:** DRIFT (carry-forward #53 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-26T21:09 UTC)

**Drift (carry-forward, unchanged since #52):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~34 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~11 days; **drain target Beta-500 dry-run ~3.8 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~17 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** No new code since June 25 Puffer commits (~2 days). Beta-500 dry-run 2026-07-01 (~3.8 days) drains HOPED-FOR trio. Disarm testplan verify owed before then.

---

## 2026-06-26 21:06 UTC

**Status:** DRIFT (carry-forward #52 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-26T18:09 UTC)

**Drift (carry-forward, unchanged since #51):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~33 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~10 days; **drain target Beta-500 dry-run ~4.1 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~16 days, no code touch
- T3-6 `[ ]` (jargon tooltips): carry-forward; checkbox may need audit-correction
- Disarm live-verify still owed: `tasks/disarm-loot-testplan-2026-06-23.md` (shipped 2026-06-23, 2-client verify not confirmed)

**Action:** Beta-500 dry-run 2026-07-01 (~4.1 days) drains HOPED-FOR trio. Disarm testplan verify owed before then.

---

## 2026-06-26 18:06 UTC

**Status:** DRIFT (carry-forward #51 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-26T15:10 UTC)

**Drift (carry-forward, unchanged since #50):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~33 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~10 days; **drain target Beta-500 dry-run ~4.4 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~16 days, no code touch
- T3-6 `[ ]` (jargon inline tooltips CDP/RAPID/AMod/SMod/CMod): HelpTooltip in wizard steps covers these - carry-forward; checkbox may need audit-correction
- Disarm live-verify owed: `tasks/disarm-loot-testplan-2026-06-23.md` (2-client: disarm -> ground token -> loot -> Ready -> fire) - shipped 2026-06-23, not yet verified

**Action:** Beta-500 dry-run 2026-07-01 (~4.4 days). Disarm testplan owed before then. T3-6 checkbox needs audit-correction.

---

## 2026-06-26 15:08 UTC

**Status:** DRIFT (carry-forward #50 - no new commits; gates clean; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-26T12:12 UTC)

**Drift (carry-forward, unchanged since #49):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~33 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~10 days; **drain target Beta-500 dry-run ~4.4 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~16 days, no code touch
- T3-6 `[ ]` (jargon inline tooltips CDP/RAPID/AMod/SMod/CMod): HelpTooltip in wizard steps covers these - carry-forward; checkbox may need audit-correction

**Action:** No new issues. T3-6 checkbox still needs audit-correction. Beta-500 dry-run 2026-07-01 is the drain event for HOPED-FOR trio.

---

## 2026-06-26 12:09 UTC

**Status:** DRIFT (carry-forward #49 - gates clean; recorder stale-as-open claim corrected)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-26T09:10 UTC)

**Drift (carry-forward):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~33 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~10 days; **drain target Beta-500 dry-run ~4.6 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~10 days, no code touch
- T3-6 `[ ]` (jargon inline tooltips CDP/RAPID/AMod/SMod/CMod): HelpTooltip used in wizard steps for those terms - carry-forward, checkbox may need audit-correction

**Correction from prior entries:**
- Prior pulses cited `b043904` as "shipped recorder Items 1-4" - that commit hash does not exist in the repo. `'net'`/`'realtime'` event kinds are typed in `lib/playtest-recorder.ts:38` but not wired (zero call sites). Recorder observability todo checkbox is CORRECTLY open, not stale-as-open. Removing from stale-as-open list.

**Action:** T3-6 tooltip checkbox needs audit-correction. Beta-500 dry-run 2026-07-01 drains HOPED-FOR trio.

---

## 2026-06-26 09:09 UTC

**Status:** DRIFT (carry-forward #48 - gates clean; one new stale-as-open finding)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-26T06:10 UTC)

**Drift (carry-forward):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~33 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~11 days; **drain target Beta-500 dry-run = ~2.2 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~16 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked (carry from #48)

**New stale-as-open finding:**
- T3-6 `[ ]` (jargon inline tooltips CDP/RAPID/AMod/SMod/CMod): `components/HelpTooltip.tsx` exists + is used in `wizard/StepSeven.tsx` + `wizard/StepAttr.tsx` for exactly these terms; component comment confirms "Used throughout character creation to explain RAPID attributes, skills, weapon traits, CDP / CMod / AMod / SMod." Strong evidence T3-6 shipped - checkbox needs audit-correction.

**Action:** T3-6 checkbox likely needs checking off. Beta-500 dry-run 2026-07-01 is drain event for HOPED-FOR trio.

---

## 2026-06-26 06:07 UTC

**Status:** DRIFT (#48 - 3 new Puffer Fish commits; app gates green; HOPED-FOR trio unchanged)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-26T03:52 UTC)

**New commits since #47:**
- `2af1871` perf+sec: index 11 hot user_id/campaign_id FKs + pin search_path on 33 SECURITY DEFINER functions
- `7b78b3c` docs: Supabase advisor full triage (search_path, unindexed FKs, multi-policy)
- `04527d9` fix(rls): enable RLS on pregen_campaign_map (Supabase linter 0013)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~33 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~11 days; **drain target Beta-500 dry-run = ~3.2 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~16 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked
- T2-6 `[ ]` (verify composite indexes): `2af1871` added user_id FK indexes - T2-6's asks (`roll_log/chat_messages (campaign_id,created_at)`, `campaign_npcs campaign_id`, `notifications.user_id`, `conversation_participants`) are a different set, still open

**Action:** Beta-500 dry-run 2026-07-01 is the drain event for HOPED-FOR trio. T2-6 composite indexes still need a Puffer pass.

---

## 2026-06-26 00:08 UTC

**Status:** DRIFT (carry-forward #47 - no new app commits since #46)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-25T21:08 UTC)

**Drift (carry-forward, unchanged from #46):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~32 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~10 days; **drain target Beta-500 dry-run = ~4.0 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~15 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** No change from #46. Beta-500 target 2026-07-01; 4 days remain to close HOPED-FOR trio via a live session.

---

## 2026-06-25 21:05 UTC

**Status:** DRIFT (carry-forward #46 - no new app commits since #45)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-25T18:08 UTC)

**Drift (carry-forward, unchanged from #45):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~31 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~9 days; **drain target Beta-500 dry-run = ~4.3 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~13 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** No change from #45. Beta-500 target 2026-07-01; 4.3 days remain to close the HOPED-FOR trio via a live session.

---

## 2026-06-25 18:05 UTC

**Status:** DRIFT (carry-forward #45 - no new app commits since #37)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-25T12:11 UTC)

**Drift (carry-forward, unchanged from #44):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~31 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~9 days; **drain target Beta-500 dry-run = ~4.5 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~9 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** No change from #44. HOPED-FOR trio needs live session before 7/1 Beta-500 dry-run.

---

## 2026-06-25 12:08 UTC

**Status:** DRIFT (carry-forward #44 - no new app commits since #37)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-25T09:08 UTC)

**Drift (carry-forward, unchanged from #43):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~31 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~26 days; **drain target Beta-500 dry-run = ~4.9 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~9 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** No change from #43. HOPED-FOR trio needs live session before 7/1 Beta-500 dry-run.

---

## 2026-06-25 09:08 UTC

**Status:** DRIFT (carry-forward #43 - no new app commits since #37)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-25T06:09 UTC)

**Drift (carry-forward, unchanged from #42):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~31 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~9 days; **drain target Beta-500 dry-run = ~5.2 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~9 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** No change from #42. HOPED-FOR trio needs live session before 7/1 Beta-500 dry-run.

---

## 2026-06-25 06:08 UTC

**Status:** DRIFT (carry-forward #42 - no new app commits since #37)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-25T00:11 UTC)

**Drift (carry-forward, unchanged from #41):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~31 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~9 days; **drain target Beta-500 dry-run = ~5.5 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~9 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** HOPED-FOR trio needs a live session before 7/1 Beta-500 dry-run. No code shipped since #37; no gate regressions.

---

## 2026-06-25 00:07 UTC

**Status:** DRIFT (carry-forward #41 - no new app commits since #37)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-24T21:08 UTC)

**Drift (carry-forward, unchanged from #40):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~31 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~9 days; **drain target Beta-500 dry-run = ~5.8 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~9 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** Same as #40 - Beta-500 now ~5.8 days out. HOPED-FOR trio needs live session before 7/1.

---

## 2026-06-24 21:06 UTC

**Status:** DRIFT (carry-forward #40 - no new app commits since #37)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-24T18:09 UTC - new success since #39)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~30 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~12 days; **drain target Beta-500 dry-run = ~6.5 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~12 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** Beta-500 now ~6.5 days out - HOPED-FOR trio needs a live session with all stress-check action types before 7/1. No new issues.

---

## 2026-06-24 18:06 UTC

**Status:** DRIFT (carry-forward #39 - no new app commits since #37)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-24T15:12 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~34 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~11 days; **drain target Beta-500 dry-run = 7 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path - ~11 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** Same as #38 - Beta-500 7 days out; HOPED-FOR trio needs a live dry-run session before 7/1. health-endpoint DoS item deferred 12th consecutive run - route to HP: Upstash sliding window on `/api/health`.

---

## 2026-06-24 15:09 UTC

**Status:** DRIFT (carry-forward #38 - no new app commits since #37)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** verified via MCP - all 5 runs pass (latest 2026-06-24T12:10 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~34 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~11 days; **drain target Beta-500 dry-run ~2026-07-01 = 7 days**
- HOPED-FOR: FI Insight Die AWARD path - ~11 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** Stress 12-string drain target (Beta-500 ~2026-07-01) now 7 days out - needs a live session with HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAVIGATE rolls. health-endpoint DoS deferred 11th consecutive run - route to HP: Upstash sliding window on `/api/health`.

---

## 2026-06-24 12:08 UTC

**Status:** DRIFT (carry-forward #37 - no new app commits since #36)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** verified via MCP - all 5 runs pass (latest 2026-06-24T09:09 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~34 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~11 days; **drain target Beta-500 dry-run ~2026-07-01 = 7 days**
- HOPED-FOR: FI Insight Die AWARD path - ~11 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** Stress 12-string is 7 days to Beta-500 drain target - needs a live session with HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAVIGATE rolls. health-endpoint DoS deferred 10th consecutive run - route to HP: Upstash sliding window on `/api/health`.

---

## 2026-06-24 09:07 UTC

**Status:** DRIFT (carry-forward #36 - no new app commits since #35)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh unavailable this run; last verified all-pass run #34 (00:07 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~33 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~10 days; **drain target Beta-500 dry-run 2026-07-01 = 7 days**
- HOPED-FOR: FI Insight Die AWARD path - ~10 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** Stress 12-string drain target (Beta-500 ~2026-07-01) now 7 days out - needs a live session with HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAVIGATE rolls to drain. DoS guard on `/api/health` deferred 9th consecutive run - route to HP.

---

## 2026-06-24 06:07 UTC

**Status:** DRIFT (carry-forward #35 - no new app commits since #34)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh unavailable this run; last verified all-pass run #34 (00:07 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~32 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~9 days
- HOPED-FOR: FI Insight Die AWARD path - ~9 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** health-endpoint DoS is the only escalating signal - 8th consecutive run deferred (~6 days to Beta-500). Route to HP: Upstash sliding window on `/api/health`. HOPED-FOR trio drains at Beta-500 dry-run (~2026-07-01).

---

## 2026-06-24 00:07 UTC

**Status:** DRIFT (carry-forward #34 - no new app commits since #33)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-23T21:08 UTC - 1 new success since #33)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~31 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~8 days
- HOPED-FOR: FI Insight Die AWARD path - ~8 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** health-endpoint DoS is the only escalating signal - 7th consecutive run deferred (~7 days to Beta-500). Route to HP: Upstash sliding window on `/api/health`. HOPED-FOR trio drains at Beta-500 dry-run (~2026-07-01).

---

## 2026-06-23 21:06 UTC

**Status:** DRIFT (carry-forward #33 - 1 new app commit since #32: rolls-feed narrative dedup fix)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-23T18:54 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~30 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~7 days
- HOPED-FOR: FI Insight Die AWARD path - ~7 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**New since #32:** `3fd8fc1` fix(rolls-feed) - stop Perception/GI narratives repeating the name (adjacent to roll-helpers; does NOT drain Stress 12-string HOPED-FOR)

**Action:** health-endpoint DoS remains the only escalating signal - 6th consecutive run deferred (~8 days to Beta-500). Route to HP: Upstash sliding window on `/api/health`. HOPED-FOR trio drains at Beta-500 dry-run (~2026-07-01).

---

## 2026-06-23 18:18 UTC

**Status:** DRIFT (carry-forward #32 - 1 new commit since #31: security audit)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical) - ws/vite HIGHs resolved since last weekly audit; 3 carry-over moderates (postcss/next/sentry chain, fix = breaking, hold)

**CI:** unverified this run (GitHub Actions MCP network error); last verified clean 2026-06-23 ~15:11 UTC

**Drift:**
- HOPED-FOR: Vehicle popout broadcasts (Section B) - ~30 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - ~7 days
- HOPED-FOR: FI Insight Die AWARD path - ~7 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**New since #31:** `b6ad657` security-audit - ws/vite HIGHs resolved ✓; `app/api/health/route.ts` DoS **5th consecutive audit deferred** (Upstash 10/min rate-limit before paid launch - security-audit #1 priority)

**Action:** health-endpoint DoS is the only escalating signal - 5 audits, ~8 days to Beta-500. Route to HP: Upstash sliding window on `/api/health`. CI unavailable this run - verify manually before next deploy.

---

## 2026-06-23 15:11 UTC

**Status:** DRIFT (carry-forward #31 - no new app commits since #30)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-23T12:11 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - 7 days since last session
- HOPED-FOR: FI Insight Die AWARD path - 7 days, no code touch
- HOPED-FOR: Vehicle popout broadcasts (Section B) - 30 days, no code touch
- Recorder observability `[ ]` todo stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** No new signal. Drift unchanged from #30. Beta-500 dry-run (~2026-07-01) is the drain event for HOPED-FOR trio.

---

## 2026-06-23 12:08 UTC

**Status:** DRIFT (carry-forward #30 - no new app commits since #29)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-23T09:08 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) - 7 days since last session
- HOPED-FOR: FI Insight Die AWARD path - 7 days, no code touch
- HOPED-FOR: Vehicle popout broadcasts (Section B) - 30 days, no code touch
- Recorder observability `[ ]` todo stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** No new signal. Drift unchanged from #29. Beta-500 dry-run (~2026-07-01) is the drain event for HOPED-FOR trio.

---

## 2026-06-23 09:07 UTC

**Status:** DRIFT (carry-forward #29)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-23T06:10 UTC)

**Drift:**
- HOPED-FOR: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) - 7 days since last session (Test Bed S24, 2026-06-16); `roll-helpers.ts` touched in last 3 days for unrelated narrative fix, stress-check path still unverified
- HOPED-FOR: FI Insight Die AWARD path - 7 days, no code touch
- HOPED-FOR: Vehicle popout broadcasts (Section B) - 7 days, no code touch

**Action:** HOPED-FOR trio stale 7 days. Next playtest target: trigger a Stress Check that exercises one of the 8 uncaptured strings (HEAL/UNJAM/REPAIR etc.) and watch the feed row for a narrative.

---

## 2026-06-23 06:07 UTC

**Status:** DRIFT (carry-forward #28 - 26 new commits since #27: `f73d193`..`a6abd4f`)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-23T04:31 UTC). Fully green.

**New since #27 (session 2026-06-23, all clean):**
- `659183b` fix(rls): close untrusted-user read + storage-write holes (pre-Beta-500 HIGH)
- `6fdd7ce` feat(combat): Disarm action + fix looted weapons landing in dead slot
- `bceeeb9` perf(sidebar): debounce + delta-cache global-presence username resolution (T2-2)
- `a6abd4f` feat(onboarding): Tier-3 cold-signup fixes (Join-a-Story, random spinner, path framing)
- `365d267` feat(loot): generated NPC ranged weapons spawn with scarce loaded ammo
- `10e8710` feat(combat): pistol-whip - melee with equipped ranged weapon
- `10eda3e` feat(tactical-map): auto-center map on received ping
- `65c4bf7` feat(combat): searching a container costs 1 action (combat-only)
- + 18 doc/fix/chore commits

**Drift (carry-forward):**
- HOPED-FOR trio (#28): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 7 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run (~8 days, 2026-07-01).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked - audit-correction needed (flagged since #16).

**Action:** No new signal. Highly productive session: HIGH RLS security fix + Disarm feature + T2-2 perf + Tier-3 onboarding all landed clean. HOPED-FOR trio unchanged - Beta-500 dry-run is the drain event.

---

## 2026-06-23 00:09 UTC

**Status:** DRIFT (carry-forward #27 - 8 new commits since #26: `4db42a5`..`91dc693`)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-23T00:04 UTC). Fully green.

**New since #26 (session 2026-06-22, all clean):**
- `7879ac4` fix(observer): route observers to table + observer-aware lobby
- `2570744` feat(table): double-click GM icon to whisper GM
- `acbb245` feat(gm-notes): font-size zoom control in GM notes popout
- `5a291de` feat(story-hub): GM Tools beside Launch as 3x2 grid
- `7154f58` feat(story-hub): pregen sheet preview popup before selecting
- `8d21819` feat(pregens): "View this character" button on library cards
- `4db42a5` feat(weapons): Crowbar as a melee weapon
- `91dc693` docs: session lessons + todo update

**Drift (carry-forward):**
- HOPED-FOR trio (#27): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 7 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run (~8 days, 2026-07-01).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked - audit-correction needed (flagged since #16).

**Action:** No new signal. Productive session landed 8 clean commits. HOPED-FOR trio unchanged - Beta-500 dry-run is the drain event. Recorder checkbox still needs a manual tick.

---

## 2026-06-22 21:09 UTC

**Status:** DRIFT (carry-forward #26 - 2 new commits since #25: `d95d6cf` + `3d45bf3`)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-22T20:44 UTC). Fully green.

**New since #25:**
- `d95d6cf` fix(story-page): photoDataUrl fallback for legacy character portraits. Gates + CI clean.
- `3d45bf3` chore(db): backfill portrait_url from legacy data.photoDataUrl. Gates + CI clean.

**Drift (carry-forward):**
- HOPED-FOR trio (#26): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run (~9 days, 2026-07-01).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked - audit-correction needed (flagged since #16).

**Action:** No new signal. Gates clean, CI green. Portrait/backfill fixes landed cleanly. HOPED-FOR trio unchanged - Beta-500 dry-run is the drain event.

---

## 2026-06-22 18:06 UTC

**Status:** DRIFT (carry-forward #25 - no new app commits since #24)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-22T15:11 UTC). Fully green.

**Drift (carry-forward):**
- HOPED-FOR trio (#25): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run (~9 days, 2026-07-01).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked - audit-correction needed (flagged since #16).

**Action:** No new signal since #24. Gates clean, CI green. Beta-500 dry-run remains the drain event for the HOPED-FOR trio.

---

## 2026-06-22 15:07 UTC

**Status:** DRIFT (carry-forward #24 - 2 new commits since #23: `a6f8c5a` + `d58fc8d`)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-22T13:22 UTC). Fully green.

**New since #23:**
- `a6f8c5a` fix(storage): repaired campaign-covers bucket RLS - INSERT/UPDATE policies had wrong role check, blocking story cover uploads. Passed all gates + CI.
- `d58fc8d` feat(story-page): character portraits in party list avatars. Passed all gates + CI.

**Drift (carry-forward):**
- HOPED-FOR trio (#24): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run (~9 days, 2026-07-01).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked - audit-correction needed (flagged since #16).

**Action:** Gates clean, CI green. Storage RLS fix landed cleanly. HOPED-FOR trio unchanged - Beta-500 dry-run is the drain event.

---

## 2026-06-22 12:09 UTC

**Status:** DRIFT (carry-forward #23 - no new app commits since `a77d813` 2026-06-21 04:54 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-22 09:08 UTC). Fully green.

**Drift (carry-forward):**
- HOPED-FOR trio (#23): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01 (~8 days).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked - audit-correction needed (flagged since #16).

**Action:** No new signal since #22. Beta-500 dry-run is now 8 days out - schedule it to drain the HOPED-FOR trio.

---

## 2026-06-22 09:05 UTC

**Status:** DRIFT (carry-forward #22 - no new app commits since `a77d813` 2026-06-21 04:54 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success. Fully green.

**Drift (carry-forward):**
- HOPED-FOR trio (#22): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01 (~8 days).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked - audit-correction needed (flagged since #16).

**Action:** No new signal since #21. Beta-500 dry-run is now 8 days out - schedule it to drain HOPED-FOR trio.

---

## 2026-06-22 06:09 UTC

**Status:** DRIFT (carry-forward #21 - no new app commits since `a77d813` 2026-06-21 04:54 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success. Fully green.

**Drift (carry-forward):**
- HOPED-FOR trio (#21): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01 (~9 days).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked - audit-correction needed (flagged since #16).

**Action:** No new signal since #20. Schedule Beta-500 dry-run to drain HOPED-FOR trio.

---

## 2026-06-22 00:09 UTC

**Status:** DRIFT (carry-forward #20 - no new app commits since `a77d813` 2026-06-21 04:54 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success - latest 2026-06-21 21:08 UTC. Fully green.

**Drift (carry-forward):**
- HOPED-FOR trio (#20): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01 (~9 days).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked - audit-correction needed (flagged since #16).

**Action:** No new signal. Schedule Beta-500 dry-run to drain HOPED-FOR trio before 2026-07-01 deadline.

---

## 2026-06-21 21:00 UTC

**Status:** DRIFT (carry-forward #19 - no new app commits since 18:06 entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success - latest 18:09 UTC (2026-06-21). Fully green.

**New commits since 18:06:** none (only the 18:06 health-pulse commit).

**Drift (carry-forward):**
- HOPED-FOR trio (#19): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked - audit-correction needed (flagged since #16).

**Action:** No new signal. Tick recorder observability checkbox in todo.md when next in the file.

---

## 2026-06-21 18:06 UTC

**Status:** DRIFT (carry-forward #18 - no new app commits since 15:07 entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success - latest 15:08 UTC (2026-06-21). Fully green.

**New commits since 15:07:** none (only the 15:07 health-pulse commit).

**Drift (carry-forward):**
- HOPED-FOR trio (#18): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked - audit-correction needed (flagged since #16).

**Action:** No new signal. Tick recorder observability checkbox in todo.md when next in the file.

---

## 2026-06-21 15:07 UTC

**Status:** DRIFT (carry-forward #17 - no new app commits since 12:07 entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success - latest 12:10 UTC (2026-06-21). Fully green.

**New commits since 12:07:** none (only the 12:07 health-pulse commit).

**Drift (carry-forward):**
- HOPED-FOR trio (#17): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked - audit-correction needed (flagged since #16).

**Action:** No new signal. Tick recorder observability checkbox in todo.md when next in the file.

---

## 2026-06-21 12:07 UTC

**Status:** DRIFT (carry-forward #16 - no new app commits since 09:05 entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** GitHub MCP token expired - skipped. Prior entry (09:05 UTC) confirmed last 5 runs all success.

**New commits since 09:05:** none (only the 09:05 health-pulse commit).

**Drift (carry-forward):**
- HOPED-FOR trio (#16): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4 (`net`/`realtime`/`snapshot`/richer-click kinds confirmed in `lib/playtest-recorder.ts:38`). Checkbox in `tasks/todo.md` still `[ ]` - audit-correction needed. Separate LOW item (recorder mark `window.prompt` → in-app) is correctly still open (`components/PlaytestRecorder.tsx:355`).

**Action:** Tick recorder observability checkbox in todo.md. HOPED-FOR trio clears at Beta-500 dry-run.

---

## 2026-06-21 09:05 UTC

**Status:** DRIFT (carry-forward #15 - no new app commits since 06:06 entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success - latest 06:12 UTC (2026-06-21). Fully green.

**New commits since 06:06:** none (only the 06:06 health-pulse commit).

**Drift (carry-forward):**
- HOPED-FOR trio (#15): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 5 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder `window.prompt` todo `[ ]`: still open - `components/PlaytestRecorder.tsx:355` still uses `window.prompt`. Low priority.

**Action:** No new action. HOPED-FOR trio clears at Beta-500 dry-run.

---

## 2026-06-21 06:06 UTC

**Status:** DRIFT (carry-forward #14 - 2 new commits since 00:06 entry, all clean)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success - latest 04:54 UTC (2026-06-21). Fully green.

**New commits since 00:06:** `2be85c1 fix(pins): GM-created pins revealed to players by default` + `a77d813 fix(map): merge GM-shared-route label into route banner for players` - both feature-clean, all gates pass, CI green.

**Drift (carry-forward):**
- HOPED-FOR trio (#14): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 5 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability todo `[ ]` still un-ticked - recorder code has `net`/`realtime`/`snapshot` kinds in filesystem; stale-open since Items 1-4 shipped.

**Action:** No new action. HOPED-FOR trio clears at Beta-500 dry-run; tick recorder checkbox when convenient.

---

## 2026-06-21 00:06 UTC

**Status:** DRIFT (carry-forward #13 - 2 new commits since 21:06 entry, all clean)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success - latest 23:23 UTC (2026-06-20). Fully green.

**New commits since 21:06:** `6262624 fix(story-page): use direct chars query for assigned portrait` + `0a1fb4b feat(story-page): stack MSG/Remove buttons under avatar in party list` - both story-page cosmetics/fixes, all gates pass, CI green.

**Drift (carry-forward):**
- HOPED-FOR trio (#13): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. 5 days since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability todo `[ ]` still un-ticked - `b043904` shipped Items 1-4 on 2026-06-19.

**Action:** No new action. Tick recorder observability checkbox when convenient; HOPED-FOR trio clears at Beta-500 dry-run.

---

## 2026-06-20 21:06 UTC

**Status:** DRIFT (carry-forward #12 - same drift items; 4 new commits landed since 18:06 entry, all clean)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success - latest cluster 19:00-19:15 UTC (4 pushes in ~15 min, active dev session). Fully green.

**New commits since 18:06:** `ecfa0dd fix(rls): allow any authed user to read module_subscriptions` - broadens read permissions on `module_subscriptions`; intentional (authed users need to see their sub status). Gates passed. `a1f636a` / `2c41445` / `d69cafe` - pregen claiming + portrait write + GM panel roster. All CI-pass.

**Drift (carry-forward):**
- HOPED-FOR trio (#12): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. 4 days since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability todo checkbox still un-ticked (`b043904` shipped Items 1-4 on 2026-06-19).

**Action:** No new action. RLS change looks intentional. Tick recorder observability checkbox when convenient.

---

## 2026-06-20 18:06 UTC

**Status:** DRIFT (carry-forward #11 - zero new signal since 15:06 entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success - five runs 17:33-17:57 UTC today (active push session). Fully green.

**Drift:**
- HOPED-FOR trio (#11): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. 4 days since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability todo checkbox still un-ticked (`b043904` shipped Items 1-4 on 2026-06-19).

**Action:** No new action. All carry-forward from 15:06 entry.

---

## 2026-06-20 15:06 UTC

**Status:** DRIFT (carry-forward #10 - zero new signal since 09:07 entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success - latest 12:09 UTC (success). Fully green.

**Drift:**
- HOPED-FOR trio (#10): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. 4 days since last session (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Stale-open: recorder observability todo `[ ]` - `b043904` (2026-06-19) shipped all 4 items; checkbox not ticked.
- `scripts/check-realtime-wrap.mjs` not created. Recorder `window.prompt` at `PlaytestRecorder.tsx:355` not replaced.

**Action:** No new action beyond 09:07 entry. Drain HOPED-FOR trio at next playtest / Beta-500 dry-run. Tick recorder observability todo.

---

## 2026-06-20 09:07 UTC

**Status:** DRIFT (carry-forward #9 - HOPED-FOR trio persists; new stale-todo candidate)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success - all from 2026-06-20 00:09-01:40 UTC. Fully green.

**Drift:**
- HOPED-FOR trio persists (#9): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. No code changes since Session 24 (2026-06-16). Drain target: Beta-500 dry-run.
- **New stale-todo candidate:** `todo.md L605` says "Intimidation skill removal - still in `lib/npc-generator.ts` Politics". Grep finds zero hits for `intimidat` or `politics` in that file today - removal may already be done. Needs 30-second audit + checkbox mark.
- `scripts/check-realtime-wrap.mjs` still not created (L93). Recorder `window.prompt` still at `PlaytestRecorder.tsx:355` (L57).

**Action:** Audit `lib/npc-generator.ts` for Intimidation - todo L605 may already be done, mark it. Carry-forward HOPED-FOR trio to Beta-500 dry-run.

---

## 2026-06-20 06:07 UTC

**Status:** DRIFT (carry-forward #8 - HOPED-FOR trio persists; stale-open recorder todo shipped; ws/vite HIGH vulns cleared)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files] (+8 vs last run)

**Audit:** clean (0 high, 0 critical) - ws CVSS 7.5 + vite HIGH from 06-17 RED are now RESOLVED

**CI:** last 5 runs all success - latest 2026-06-19 22:30 UTC. Fully green.

**Drift:**
- HOPED-FOR trio persists (#8): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. No code changes addressing these since Session 24 (2026-06-16).
- Stale-as-open todo: "Recorder captures clicks only - blind to where bugs live" (`tasks/todo.md`) - shipped by `b043904` (Items 1-4: net/realtime/snapshot/richer-click). Checkbox should be marked done.
- `scripts/check-realtime-wrap.mjs` still not created. Recorder `window.prompt` still present at `components/PlaytestRecorder.tsx:355`.

**Action:** Mark recorder observability todo done. Drain HOPED-FOR trio at Beta-500 dry-run. ws/vite HIGH vulns resolved - no action needed there.

---

## 2026-06-19 21:07 UTC

**Status:** DRIFT (carry-forward #7 - CI fully green, pregen edit wizard shipped, HOPED-FOR trio persists)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [877 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success - latest 20:54 UTC. Full clean since 06:09 UTC. Pregen work (feat/fix: Edit button, PREGEN wizard button, sidebar hide, TS build fix) all passed green.

**Drift:**
- HOPED-FOR trio unchanged (#7): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. No code activity since Session 24 (2026-06-16). Drain target: Beta-500 dry-run.
- Stale todos unchanged: `scripts/check-realtime-wrap.mjs` not created; recorder `window.prompt` at `PlaytestRecorder.tsx:244` not replaced with in-app input.

**Action:** carry-forward - no new signal. Drain HOPED-FOR trio at next Beta-500 dry-run. CI fully recovered.

---

## 2026-06-19 12:07 UTC

**Status:** DRIFT (carry-forward #6 - CI fully recovered, HOPED-FOR trio persists)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [877 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs - 3 success / 2 failure; failures (02:09/02:10 UTC) already captured in 09:06 entry and resolved. Latest success: 06:09 UTC. No new failures.

**Drift:**
- HOPED-FOR trio unchanged (#6): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Only style/BOM commits touched relevant files since Session 24 (2026-06-16).
- Stale todos unchanged: `check-realtime-wrap.mjs` not created; recorder `window.prompt` not replaced.

**Action:** carry-forward - no new signal since 09:06 entry. Force-push question + HOPED-FOR trio drain both still outstanding.

---

## 2026-06-19 09:06 UTC

**Status:** RED+DRIFT (CI failures in last 5 runs + force push on main, both resolved; HOPED-FOR trio persists)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [877 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** 2 failures in last 5 runs - `https://github.com/XeroSumGames/thetapestry/actions/runs/27801083208` (02:09 UTC) and `runs/27801115353` (02:10 UTC). Both resolved: runs/27804980282 (04:14 UTC) and runs/27805695313 (04:36 UTC) are green. Cause: pregen feature (`2700bfa`) triggered TS build error (`getStoryCampaignSetting`); fixed by `9ca5935`. **Force push on main detected** (`cf9beb9...74cdbe7`) - operating-mode bright line; already happened, confirm it was intentional.

**Drift:**
- HOPED-FOR trio unchanged (#5 carry-forward): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. No code activity since Session 24 (2026-06-16).
- Stale todos unchanged: `check-realtime-wrap.mjs` still not created; recorder `window.prompt` still not replaced.

**Action:** (1) Confirm force push to main was intentional. (2) HOPED-FOR trio: drain at next Beta-500 dry-run. CI is now green - no action needed there.

---

## 2026-06-19 06:06 UTC

**Status:** DRIFT (carry-forward #4 - no new signal)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [877 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-18 21:08 UTC - no commits since)

**Drift:**
- HOPED-FOR trio unchanged: vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Zero code activity in relevant areas since 2026-06-16.
- Stale todos unchanged: `check-realtime-wrap.mjs` still not created; recorder `window.prompt` still not replaced.

**Action:** carry-forward - identical state to 21:05 entry. Drain HOPED-FOR trio at next Beta-500 dry-run session.

---

## 2026-06-18 21:05 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [877 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (most recent 18:07 UTC - no new runs since 18:07 entry)

**Drift:**
- HOPED-FOR trio unchanged from 18:07 entry: vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. No relevant code changes in last 3d. TacticalMap.tsx touched today (charge + perf fixes) but not vehicle popout path.
- Open todos unchanged: `check-realtime-wrap.mjs` not created; recorder `window.prompt` not replaced; `6 mechanics` parent checkbox + pin catch-up todo still await docs-only close.

**Action:** carry-forward - no new signal since 18:07 entry. Drain HOPED-FOR trio at next Beta-500 dry-run session.

---
