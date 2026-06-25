# Health Pulse

Autonomous status checks every 3 hours (00:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 UTC). Newest first. Silent runs (all-green, no drift) are NOT logged here - absence = healthy.

When you see a new entry: open it, take the action listed, then leave the entry in place as a historical record.

---

> **Note:** File trimmed to last 30 entries on 2026-06-23 (237 total entries; pre-2026-06-18 history removed to manage file size).

---

## 2026-06-25 06:08 UTC

**Status:** DRIFT (carry-forward #42 — no new app commits since #37)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-25T00:11 UTC)

**Drift (carry-forward, unchanged from #41):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) — ~31 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) — ~9 days; **drain target Beta-500 dry-run = ~5.5 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path — ~9 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** HOPED-FOR trio needs a live session before 7/1 Beta-500 dry-run. No code shipped since #37; no gate regressions.

---

## 2026-06-25 00:07 UTC

**Status:** DRIFT (carry-forward #41 — no new app commits since #37)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-24T21:08 UTC)

**Drift (carry-forward, unchanged from #40):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) — ~31 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) — ~9 days; **drain target Beta-500 dry-run = ~5.8 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path — ~9 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** Same as #40 — Beta-500 now ~5.8 days out. HOPED-FOR trio needs live session before 7/1.

---

## 2026-06-24 21:06 UTC

**Status:** DRIFT (carry-forward #40 — no new app commits since #37)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-24T18:09 UTC — new success since #39)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) — ~30 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) — ~12 days; **drain target Beta-500 dry-run = ~6.5 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path — ~12 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** Beta-500 now ~6.5 days out — HOPED-FOR trio needs a live session with all stress-check action types before 7/1. No new issues.

---

## 2026-06-24 18:06 UTC

**Status:** DRIFT (carry-forward #39 — no new app commits since #37)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** all 5 runs pass (latest 2026-06-24T15:12 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) — ~34 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) — ~11 days; **drain target Beta-500 dry-run = 7 days out (2026-07-01)**
- HOPED-FOR: FI Insight Die AWARD path — ~11 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** Same as #38 — Beta-500 7 days out; HOPED-FOR trio needs a live dry-run session before 7/1. health-endpoint DoS item deferred 12th consecutive run — route to HP: Upstash sliding window on `/api/health`.

---

## 2026-06-24 15:09 UTC

**Status:** DRIFT (carry-forward #38 — no new app commits since #37)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** verified via MCP — all 5 runs pass (latest 2026-06-24T12:10 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) — ~34 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) — ~11 days; **drain target Beta-500 dry-run ~2026-07-01 = 7 days**
- HOPED-FOR: FI Insight Die AWARD path — ~11 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** Stress 12-string drain target (Beta-500 ~2026-07-01) now 7 days out — needs a live session with HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAVIGATE rolls. health-endpoint DoS deferred 11th consecutive run — route to HP: Upstash sliding window on `/api/health`.

---

## 2026-06-24 12:08 UTC

**Status:** DRIFT (carry-forward #37 — no new app commits since #36)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** verified via MCP — all 5 runs pass (latest 2026-06-24T09:09 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) — ~34 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) — ~11 days; **drain target Beta-500 dry-run ~2026-07-01 = 7 days**
- HOPED-FOR: FI Insight Die AWARD path — ~11 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** Stress 12-string is 7 days to Beta-500 drain target — needs a live session with HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAVIGATE rolls. health-endpoint DoS deferred 10th consecutive run — route to HP: Upstash sliding window on `/api/health`.

---

## 2026-06-24 09:07 UTC

**Status:** DRIFT (carry-forward #36 — no new app commits since #35)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh unavailable this run; last verified all-pass run #34 (00:07 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) — ~33 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) — ~10 days; **drain target Beta-500 dry-run 2026-07-01 = 7 days**
- HOPED-FOR: FI Insight Die AWARD path — ~10 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** Stress 12-string drain target (Beta-500 ~2026-07-01) now 7 days out — needs a live session with HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAVIGATE rolls to drain. DoS guard on `/api/health` deferred 9th consecutive run — route to HP.

---

## 2026-06-24 06:07 UTC

**Status:** DRIFT (carry-forward #35 — no new app commits since #34)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh unavailable this run; last verified all-pass run #34 (00:07 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) — ~32 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) — ~9 days
- HOPED-FOR: FI Insight Die AWARD path — ~9 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** health-endpoint DoS is the only escalating signal — 8th consecutive run deferred (~6 days to Beta-500). Route to HP: Upstash sliding window on `/api/health`. HOPED-FOR trio drains at Beta-500 dry-run (~2026-07-01).

---

## 2026-06-24 00:07 UTC

**Status:** DRIFT (carry-forward #34 — no new app commits since #33)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-23T21:08 UTC — 1 new success since #33)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) — ~31 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) — ~8 days
- HOPED-FOR: FI Insight Die AWARD path — ~8 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** health-endpoint DoS is the only escalating signal — 7th consecutive run deferred (~7 days to Beta-500). Route to HP: Upstash sliding window on `/api/health`. HOPED-FOR trio drains at Beta-500 dry-run (~2026-07-01).

---

## 2026-06-23 21:06 UTC

**Status:** DRIFT (carry-forward #33 — 1 new app commit since #32: rolls-feed narrative dedup fix)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-23T18:54 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Vehicle popout broadcasts (Section B) — ~30 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) — ~7 days
- HOPED-FOR: FI Insight Die AWARD path — ~7 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**New since #32:** `3fd8fc1` fix(rolls-feed) — stop Perception/GI narratives repeating the name (adjacent to roll-helpers; does NOT drain Stress 12-string HOPED-FOR)

**Action:** health-endpoint DoS remains the only escalating signal — 6th consecutive run deferred (~8 days to Beta-500). Route to HP: Upstash sliding window on `/api/health`. HOPED-FOR trio drains at Beta-500 dry-run (~2026-07-01).

---

## 2026-06-23 18:18 UTC

**Status:** DRIFT (carry-forward #32 — 1 new commit since #31: security audit)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical) — ws/vite HIGHs resolved since last weekly audit; 3 carry-over moderates (postcss/next/sentry chain, fix = breaking, hold)

**CI:** unverified this run (GitHub Actions MCP network error); last verified clean 2026-06-23 ~15:11 UTC

**Drift:**
- HOPED-FOR: Vehicle popout broadcasts (Section B) — ~30 days, no code touch
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) — ~7 days
- HOPED-FOR: FI Insight Die AWARD path — ~7 days, no code touch
- Recorder observability `[ ]` stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**New since #31:** `b6ad657` security-audit — ws/vite HIGHs resolved ✓; `app/api/health/route.ts` DoS **5th consecutive audit deferred** (Upstash 10/min rate-limit before paid launch — security-audit #1 priority)

**Action:** health-endpoint DoS is the only escalating signal — 5 audits, ~8 days to Beta-500. Route to HP: Upstash sliding window on `/api/health`. CI unavailable this run — verify manually before next deploy.

---

## 2026-06-23 15:11 UTC

**Status:** DRIFT (carry-forward #31 — no new app commits since #30)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-23T12:11 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) — 7 days since last session
- HOPED-FOR: FI Insight Die AWARD path — 7 days, no code touch
- HOPED-FOR: Vehicle popout broadcasts (Section B) — 30 days, no code touch
- Recorder observability `[ ]` todo stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** No new signal. Drift unchanged from #30. Beta-500 dry-run (~2026-07-01) is the drain event for HOPED-FOR trio.

---

## 2026-06-23 12:08 UTC

**Status:** DRIFT (carry-forward #30 — no new app commits since #29)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-23T09:08 UTC)

**Drift (carry-forward, unchanged):**
- HOPED-FOR: Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV) — 7 days since last session
- HOPED-FOR: FI Insight Die AWARD path — 7 days, no code touch
- HOPED-FOR: Vehicle popout broadcasts (Section B) — 30 days, no code touch
- Recorder observability `[ ]` todo stale-as-open: `b043904` shipped Items 1-4, checkbox unchecked

**Action:** No new signal. Drift unchanged from #29. Beta-500 dry-run (~2026-07-01) is the drain event for HOPED-FOR trio.

---

## 2026-06-23 09:07 UTC

**Status:** DRIFT (carry-forward #29)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [892 passed / 49 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-23T06:10 UTC)

**Drift:**
- HOPED-FOR: Stress Check 12-string narrative (HEAL/UNJAM/REPAIR/Gut Instinct/Group Check/DRIVE/BREW/NAVIGATE) — 7 days since last session (Test Bed S24, 2026-06-16); `roll-helpers.ts` touched in last 3 days for unrelated narrative fix, stress-check path still unverified
- HOPED-FOR: FI Insight Die AWARD path — 7 days, no code touch
- HOPED-FOR: Vehicle popout broadcasts (Section B) — 7 days, no code touch

**Action:** HOPED-FOR trio stale 7 days. Next playtest target: trigger a Stress Check that exercises one of the 8 uncaptured strings (HEAL/UNJAM/REPAIR etc.) and watch the feed row for a narrative.

---

## 2026-06-23 06:07 UTC

**Status:** DRIFT (carry-forward #28 — 26 new commits since #27: `f73d193`..`a6abd4f`)

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
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked — audit-correction needed (flagged since #16).

**Action:** No new signal. Highly productive session: HIGH RLS security fix + Disarm feature + T2-2 perf + Tier-3 onboarding all landed clean. HOPED-FOR trio unchanged — Beta-500 dry-run is the drain event.

---

## 2026-06-23 00:09 UTC

**Status:** DRIFT (carry-forward #27 — 8 new commits since #26: `4db42a5`..`91dc693`)

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
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked — audit-correction needed (flagged since #16).

**Action:** No new signal. Productive session landed 8 clean commits. HOPED-FOR trio unchanged — Beta-500 dry-run is the drain event. Recorder checkbox still needs a manual tick.

---

## 2026-06-22 21:09 UTC

**Status:** DRIFT (carry-forward #26 — 2 new commits since #25: `d95d6cf` + `3d45bf3`)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-22T20:44 UTC). Fully green.

**New since #25:**
- `d95d6cf` fix(story-page): photoDataUrl fallback for legacy character portraits. Gates + CI clean.
- `3d45bf3` chore(db): backfill portrait_url from legacy data.photoDataUrl. Gates + CI clean.

**Drift (carry-forward):**
- HOPED-FOR trio (#26): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run (~9 days, 2026-07-01).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked — audit-correction needed (flagged since #16).

**Action:** No new signal. Gates clean, CI green. Portrait/backfill fixes landed cleanly. HOPED-FOR trio unchanged — Beta-500 dry-run is the drain event.

---

## 2026-06-22 18:06 UTC

**Status:** DRIFT (carry-forward #25 — no new app commits since #24)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-22T15:11 UTC). Fully green.

**Drift (carry-forward):**
- HOPED-FOR trio (#25): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run (~9 days, 2026-07-01).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked — audit-correction needed (flagged since #16).

**Action:** No new signal since #24. Gates clean, CI green. Beta-500 dry-run remains the drain event for the HOPED-FOR trio.

---

## 2026-06-22 15:07 UTC

**Status:** DRIFT (carry-forward #24 — 2 new commits since #23: `a6f8c5a` + `d58fc8d`)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-22T13:22 UTC). Fully green.

**New since #23:**
- `a6f8c5a` fix(storage): repaired campaign-covers bucket RLS — INSERT/UPDATE policies had wrong role check, blocking story cover uploads. Passed all gates + CI.
- `d58fc8d` feat(story-page): character portraits in party list avatars. Passed all gates + CI.

**Drift (carry-forward):**
- HOPED-FOR trio (#24): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run (~9 days, 2026-07-01).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked — audit-correction needed (flagged since #16).

**Action:** Gates clean, CI green. Storage RLS fix landed cleanly. HOPED-FOR trio unchanged — Beta-500 dry-run is the drain event.

---

## 2026-06-22 12:09 UTC

**Status:** DRIFT (carry-forward #23 — no new app commits since `a77d813` 2026-06-21 04:54 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-22 09:08 UTC). Fully green.

**Drift (carry-forward):**
- HOPED-FOR trio (#23): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01 (~8 days).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked — audit-correction needed (flagged since #16).

**Action:** No new signal since #22. Beta-500 dry-run is now 8 days out — schedule it to drain the HOPED-FOR trio.

---

## 2026-06-22 09:05 UTC

**Status:** DRIFT (carry-forward #22 — no new app commits since `a77d813` 2026-06-21 04:54 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success. Fully green.

**Drift (carry-forward):**
- HOPED-FOR trio (#22): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01 (~8 days).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked — audit-correction needed (flagged since #16).

**Action:** No new signal since #21. Beta-500 dry-run is now 8 days out — schedule it to drain HOPED-FOR trio.

---

## 2026-06-22 06:09 UTC

**Status:** DRIFT (carry-forward #21 — no new app commits since `a77d813` 2026-06-21 04:54 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success. Fully green.

**Drift (carry-forward):**
- HOPED-FOR trio (#21): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01 (~9 days).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked — audit-correction needed (flagged since #16).

**Action:** No new signal since #20. Schedule Beta-500 dry-run to drain HOPED-FOR trio.

---

## 2026-06-22 00:09 UTC

**Status:** DRIFT (carry-forward #20 — no new app commits since `a77d813` 2026-06-21 04:54 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success — latest 2026-06-21 21:08 UTC. Fully green.

**Drift (carry-forward):**
- HOPED-FOR trio (#20): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01 (~9 days).
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked — audit-correction needed (flagged since #16).

**Action:** No new signal. Schedule Beta-500 dry-run to drain HOPED-FOR trio before 2026-07-01 deadline.

---

## 2026-06-21 21:00 UTC

**Status:** DRIFT (carry-forward #19 — no new app commits since 18:06 entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success — latest 18:09 UTC (2026-06-21). Fully green.

**New commits since 18:06:** none (only the 18:06 health-pulse commit).

**Drift (carry-forward):**
- HOPED-FOR trio (#19): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked — audit-correction needed (flagged since #16).

**Action:** No new signal. Tick recorder observability checkbox in todo.md when next in the file.

---

## 2026-06-21 18:06 UTC

**Status:** DRIFT (carry-forward #18 — no new app commits since 15:07 entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success — latest 15:08 UTC (2026-06-21). Fully green.

**New commits since 15:07:** none (only the 15:07 health-pulse commit).

**Drift (carry-forward):**
- HOPED-FOR trio (#18): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked — audit-correction needed (flagged since #16).

**Action:** No new signal. Tick recorder observability checkbox in todo.md when next in the file.

---

## 2026-06-21 15:07 UTC

**Status:** DRIFT (carry-forward #17 — no new app commits since 12:07 entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success — latest 12:10 UTC (2026-06-21). Fully green.

**New commits since 12:07:** none (only the 12:07 health-pulse commit).

**Drift (carry-forward):**
- HOPED-FOR trio (#17): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4. Checkbox in `tasks/todo.md` still unchecked — audit-correction needed (flagged since #16).

**Action:** No new signal. Tick recorder observability checkbox in todo.md when next in the file.

---

## 2026-06-21 12:07 UTC

**Status:** DRIFT (carry-forward #16 — no new app commits since 09:05 entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** GitHub MCP token expired — skipped. Prior entry (09:05 UTC) confirmed last 5 runs all success.

**New commits since 09:05:** none (only the 09:05 health-pulse commit).

**Drift (carry-forward):**
- HOPED-FOR trio (#16): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 6 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability `[ ]` todo stale-as-open: `b043904` (2026-06-19) shipped Items 1-4 (`net`/`realtime`/`snapshot`/richer-click kinds confirmed in `lib/playtest-recorder.ts:38`). Checkbox in `tasks/todo.md` still `[ ]` — audit-correction needed. Separate LOW item (recorder mark `window.prompt` → in-app) is correctly still open (`components/PlaytestRecorder.tsx:355`).

**Action:** Tick recorder observability checkbox in todo.md. HOPED-FOR trio clears at Beta-500 dry-run.

---

## 2026-06-21 09:05 UTC

**Status:** DRIFT (carry-forward #15 — no new app commits since 06:06 entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success — latest 06:12 UTC (2026-06-21). Fully green.

**New commits since 06:06:** none (only the 06:06 health-pulse commit).

**Drift (carry-forward):**
- HOPED-FOR trio (#15): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 5 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder `window.prompt` todo `[ ]`: still open — `components/PlaytestRecorder.tsx:355` still uses `window.prompt`. Low priority.

**Action:** No new action. HOPED-FOR trio clears at Beta-500 dry-run.

---

## 2026-06-21 06:06 UTC

**Status:** DRIFT (carry-forward #14 — 2 new commits since 00:06 entry, all clean)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success — latest 04:54 UTC (2026-06-21). Fully green.

**New commits since 00:06:** `2be85c1 fix(pins): GM-created pins revealed to players by default` + `a77d813 fix(map): merge GM-shared-route label into route banner for players` — both feature-clean, all gates pass, CI green.

**Drift (carry-forward):**
- HOPED-FOR trio (#14): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Day 5 since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability todo `[ ]` still un-ticked — recorder code has `net`/`realtime`/`snapshot` kinds in filesystem; stale-open since Items 1-4 shipped.

**Action:** No new action. HOPED-FOR trio clears at Beta-500 dry-run; tick recorder checkbox when convenient.

---

## 2026-06-21 00:06 UTC

**Status:** DRIFT (carry-forward #13 — 2 new commits since 21:06 entry, all clean)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success — latest 23:23 UTC (2026-06-20). Fully green.

**New commits since 21:06:** `6262624 fix(story-page): use direct chars query for assigned portrait` + `0a1fb4b feat(story-page): stack MSG/Remove buttons under avatar in party list` — both story-page cosmetics/fixes, all gates pass, CI green.

**Drift (carry-forward):**
- HOPED-FOR trio (#13): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. 5 days since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability todo `[ ]` still un-ticked — `b043904` shipped Items 1-4 on 2026-06-19.

**Action:** No new action. Tick recorder observability checkbox when convenient; HOPED-FOR trio clears at Beta-500 dry-run.

---

## 2026-06-20 21:06 UTC

**Status:** DRIFT (carry-forward #12 — same drift items; 4 new commits landed since 18:06 entry, all clean)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success — latest cluster 19:00–19:15 UTC (4 pushes in ~15 min, active dev session). Fully green.

**New commits since 18:06:** `ecfa0dd fix(rls): allow any authed user to read module_subscriptions` — broadens read permissions on `module_subscriptions`; intentional (authed users need to see their sub status). Gates passed. `a1f636a` / `2c41445` / `d69cafe` — pregen claiming + portrait write + GM panel roster. All CI-pass.

**Drift (carry-forward):**
- HOPED-FOR trio (#12): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. 4 days since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability todo checkbox still un-ticked (`b043904` shipped Items 1-4 on 2026-06-19).

**Action:** No new action. RLS change looks intentional. Tick recorder observability checkbox when convenient.

---

## 2026-06-20 18:06 UTC

**Status:** DRIFT (carry-forward #11 — zero new signal since 15:06 entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success — five runs 17:33–17:57 UTC today (active push session). Fully green.

**Drift:**
- HOPED-FOR trio (#11): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. 4 days since Session 24 (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Recorder observability todo checkbox still un-ticked (`b043904` shipped Items 1-4 on 2026-06-19).

**Action:** No new action. All carry-forward from 15:06 entry.

---

## 2026-06-20 15:06 UTC

**Status:** DRIFT (carry-forward #10 — zero new signal since 09:07 entry)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success — latest 12:09 UTC (success). Fully green.

**Drift:**
- HOPED-FOR trio (#10): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. 4 days since last session (2026-06-16). Drain target: Beta-500 dry-run before 2026-07-01.
- Stale-open: recorder observability todo `[ ]` — `b043904` (2026-06-19) shipped all 4 items; checkbox not ticked.
- `scripts/check-realtime-wrap.mjs` not created. Recorder `window.prompt` at `PlaytestRecorder.tsx:355` not replaced.

**Action:** No new action beyond 09:07 entry. Drain HOPED-FOR trio at next playtest / Beta-500 dry-run. Tick recorder observability todo.

---

## 2026-06-20 09:07 UTC

**Status:** DRIFT (carry-forward #9 — HOPED-FOR trio persists; new stale-todo candidate)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success — all from 2026-06-20 00:09–01:40 UTC. Fully green.

**Drift:**
- HOPED-FOR trio persists (#9): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. No code changes since Session 24 (2026-06-16). Drain target: Beta-500 dry-run.
- **New stale-todo candidate:** `todo.md L605` says "Intimidation skill removal — still in `lib/npc-generator.ts` Politics". Grep finds zero hits for `intimidat` or `politics` in that file today — removal may already be done. Needs 30-second audit + checkbox mark.
- `scripts/check-realtime-wrap.mjs` still not created (L93). Recorder `window.prompt` still at `PlaytestRecorder.tsx:355` (L57).

**Action:** Audit `lib/npc-generator.ts` for Intimidation — todo L605 may already be done, mark it. Carry-forward HOPED-FOR trio to Beta-500 dry-run.

---

## 2026-06-20 06:07 UTC

**Status:** DRIFT (carry-forward #8 — HOPED-FOR trio persists; stale-open recorder todo shipped; ws/vite HIGH vulns cleared)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [885 passed / 48 files] (+8 vs last run)

**Audit:** clean (0 high, 0 critical) — ws CVSS 7.5 + vite HIGH from 06-17 RED are now RESOLVED

**CI:** last 5 runs all success — latest 2026-06-19 22:30 UTC. Fully green.

**Drift:**
- HOPED-FOR trio persists (#8): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. No code changes addressing these since Session 24 (2026-06-16).
- Stale-as-open todo: "Recorder captures clicks only - blind to where bugs live" (`tasks/todo.md`) — shipped by `b043904` (Items 1-4: net/realtime/snapshot/richer-click). Checkbox should be marked done.
- `scripts/check-realtime-wrap.mjs` still not created. Recorder `window.prompt` still present at `components/PlaytestRecorder.tsx:355`.

**Action:** Mark recorder observability todo done. Drain HOPED-FOR trio at Beta-500 dry-run. ws/vite HIGH vulns resolved — no action needed there.

---

## 2026-06-19 21:07 UTC

**Status:** DRIFT (carry-forward #7 — CI fully green, pregen edit wizard shipped, HOPED-FOR trio persists)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [877 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success — latest 20:54 UTC. Full clean since 06:09 UTC. Pregen work (feat/fix: Edit button, PREGEN wizard button, sidebar hide, TS build fix) all passed green.

**Drift:**
- HOPED-FOR trio unchanged (#7): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. No code activity since Session 24 (2026-06-16). Drain target: Beta-500 dry-run.
- Stale todos unchanged: `scripts/check-realtime-wrap.mjs` not created; recorder `window.prompt` at `PlaytestRecorder.tsx:244` not replaced with in-app input.

**Action:** carry-forward — no new signal. Drain HOPED-FOR trio at next Beta-500 dry-run. CI fully recovered.

---

## 2026-06-19 12:07 UTC

**Status:** DRIFT (carry-forward #6 — CI fully recovered, HOPED-FOR trio persists)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [877 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs — 3 success / 2 failure; failures (02:09/02:10 UTC) already captured in 09:06 entry and resolved. Latest success: 06:09 UTC. No new failures.

**Drift:**
- HOPED-FOR trio unchanged (#6): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Only style/BOM commits touched relevant files since Session 24 (2026-06-16).
- Stale todos unchanged: `check-realtime-wrap.mjs` not created; recorder `window.prompt` not replaced.

**Action:** carry-forward — no new signal since 09:06 entry. Force-push question + HOPED-FOR trio drain both still outstanding.

---

## 2026-06-19 09:06 UTC

**Status:** RED+DRIFT (CI failures in last 5 runs + force push on main, both resolved; HOPED-FOR trio persists)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [877 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** 2 failures in last 5 runs — `https://github.com/XeroSumGames/thetapestry/actions/runs/27801083208` (02:09 UTC) and `runs/27801115353` (02:10 UTC). Both resolved: runs/27804980282 (04:14 UTC) and runs/27805695313 (04:36 UTC) are green. Cause: pregen feature (`2700bfa`) triggered TS build error (`getStoryCampaignSetting`); fixed by `9ca5935`. **Force push on main detected** (`cf9beb9...74cdbe7`) — operating-mode bright line; already happened, confirm it was intentional.

**Drift:**
- HOPED-FOR trio unchanged (#5 carry-forward): vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. No code activity since Session 24 (2026-06-16).
- Stale todos unchanged: `check-realtime-wrap.mjs` still not created; recorder `window.prompt` still not replaced.

**Action:** (1) Confirm force push to main was intentional. (2) HOPED-FOR trio: drain at next Beta-500 dry-run. CI is now green — no action needed there.

---

## 2026-06-19 06:06 UTC

**Status:** DRIFT (carry-forward #4 — no new signal)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [877 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (latest 2026-06-18 21:08 UTC — no commits since)

**Drift:**
- HOPED-FOR trio unchanged: vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. Zero code activity in relevant areas since 2026-06-16.
- Stale todos unchanged: `check-realtime-wrap.mjs` still not created; recorder `window.prompt` still not replaced.

**Action:** carry-forward — identical state to 21:05 entry. Drain HOPED-FOR trio at next Beta-500 dry-run session.

---

## 2026-06-18 21:05 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [877 passed / 48 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all success (most recent 18:07 UTC — no new runs since 18:07 entry)

**Drift:**
- HOPED-FOR trio unchanged from 18:07 entry: vehicle popout broadcasts, Stress 12-string narrative (HEAL/UNJAM/REPAIR/GI/Group/DRIVE/BREW/NAV), FI Insight Die award path. No relevant code changes in last 3d. TacticalMap.tsx touched today (charge + perf fixes) but not vehicle popout path.
- Open todos unchanged: `check-realtime-wrap.mjs` not created; recorder `window.prompt` not replaced; `6 mechanics` parent checkbox + pin catch-up todo still await docs-only close.

**Action:** carry-forward — no new signal since 18:07 entry. Drain HOPED-FOR trio at next Beta-500 dry-run session.

---
