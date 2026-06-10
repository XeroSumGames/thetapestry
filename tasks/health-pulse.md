# Health Pulse

Autonomous status checks every 3 hours (00:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 UTC). Newest first. Silent runs (all-green, no drift) are NOT logged here - absence = healthy.

When you see a new entry: open it, take the action listed, then leave the entry in place as a historical record.

---

## 2026-06-10 21:09 UTC

**Status:** DRIFT (run 66 — carry-over; 4 HOPED-FOR remain; gates + CI all green)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [855 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (latest 2026-06-10T19:16Z)

**Drift:**
- HOPED-FOR >22d (carry-over): Tier-2 Recruit (all phases), P3 Q4-b Advantages, FI streamline (Insight Die spend + single-modal), Stress Check 12-string narrative lock. No commits to these areas since last pulse. Drain target: Beta-500 dry-run before 2026-07-01.
- `combat-flow Phase A "Start Combat"` E2E regression still open (routed to HP 2026-06-01, 9d). New commit `3de44a9` drafted grapple-family E2E spec (PARKED) and rerouted Phase A finding — does not fix it.

**Action:** 4 HOPED-FOR items >22d; Beta-500 target is 21 days out. Schedule the dry-run playtest — it's the only drain path.

---

## 2026-06-10 18:10 UTC

**Status:** DRIFT (run 65 — 2 carry-over findings RESOLVED since run 64; 4 HOPED-FOR remain)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [855 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (latest 2026-06-10T17:12Z)

**Drift:**
- HOPED-FOR >22d (carry-over): Tier-2 Recruit (all phases), P3 Q4-b Advantages, FI streamline (Insight Die spend + single-modal), Stress Check 12-string narrative lock. 0 commits to these areas in 3 days. Drain target: Beta-500 dry-run before 2026-07-01.

**Resolved since run 64:**
- gm-notes XSS trap: FIXED `03453dd` — dangerouslySetInnerHTML replaced with React fragment; avatar upload now routes through `prepareUpload`. +2 tests.
- AUDIT M1 stale-open: CLOSED `207f624` — duplicate todo entry checked off.

**Action:** schedule Beta-500 dry-run — the 4 HOPED-FOR items are 22d old, Beta-500 target is 2026-07-01, and a playtest is the only drain path.

---

## 2026-06-10 15:12 UTC

**Status:** DRIFT (carry-over run 64 — same findings as runs 55-63, no resolution)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (latest 2026-06-10T12:15Z)

**Drift:**
- HOPED-FOR >21d: Tier-2 Recruit (all phases), P3 Q4-b Advantages, FI streamline (Insight Die spend + single-modal), Stress Check 12-string narrative lock. 0 commits to these areas in 3 days. Drain target: Beta-500 dry-run before 2026-07-01.
- AUDIT M1 stale-open: `prepareUpload('tactical-maps')` already shipped at `scene-controls-popout/page.tsx:384`. Todo checkbox needs manual close — no code work needed.
- gm-notes XSS carry-over: `app/gm-notes-popout/page.tsx:694` dangerouslySetInnerHTML still present (no sanitizer). No live vector today; fix before any DB-sourced title reaches this path.

**Action:** carry-over — no new fires. Priority: gm-notes XSS fix (Hunt & Peck) + close AUDIT M1 todo + schedule Beta-500 dry-run to drain HOPED-FOR backlog.

---

## 2026-06-10 12:13 UTC

**Status:** DRIFT (carry-over run 63 — same findings as runs 55-62, no resolution)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (latest 2026-06-10T09:09Z)

**Drift:**
- HOPED-FOR >21d: Tier-2 Recruit (all phases), P3 Q4-b Advantages, FI streamline (Insight Die spend + single-modal), Stress Check 12-string narrative lock. 0 commits to these areas in 3 days. Drain target: Beta-500 dry-run before 2026-07-01.
- AUDIT M1 stale-open: `prepareUpload('tactical-maps')` already shipped at `scene-controls-popout/page.tsx:384`. Todo checkbox needs manual close — no code work needed.
- gm-notes XSS carry-over: `app/gm-notes-popout/page.tsx:694` dangerouslySetInnerHTML still present (no sanitizer). No live vector today; fix before any DB-sourced title reaches this path.

**Action:** carry-over — no new fires. Priority: gm-notes XSS fix (Hunt & Peck) + close AUDIT M1 todo + schedule Beta-500 dry-run to drain HOPED-FOR backlog.

---

## 2026-06-10 09:09 UTC

**Status:** DRIFT (carry-over run 62 — same findings as runs 55-61, no resolution)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (latest 2026-06-10T06:13Z)

**Drift:**
- HOPED-FOR >21d: Tier-2 Recruit (all phases), P3 Q4-b Advantages, FI streamline (Insight Die spend + single-modal), Stress Check 12-string narrative lock. 0 commits to these areas in 3 days. Drain target: Beta-500 dry-run before 2026-07-01.
- AUDIT M1 stale-open: `prepareUpload('tactical-maps')` already shipped at `scene-controls-popout/page.tsx:384`. Todo checkbox needs manual close — no code work needed.
- gm-notes XSS carry-over: `app/gm-notes-popout/page.tsx:694` dangerouslySetInnerHTML still present (no sanitizer). No live vector today; fix before any DB-sourced title reaches this path.

**Action:** carry-over — no new fires. Priority: gm-notes XSS fix (Hunt & Peck) + close AUDIT M1 todo + schedule Beta-500 dry-run to drain HOPED-FOR backlog.

---

## 2026-06-10 06:11 UTC

**Status:** DRIFT (carry-over run 61 — same findings as runs 55-60, no resolution)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 4 runs all success (2026-06-10T00:13 / 2026-06-09T21:10 / 18:08 / 16:26)

**Drift:**
- HOPED-FOR >21d (no playtest evidence since 2026-05-30 drain pass): Tier-2 Recruit flow, P3 Q4-b Advantages, FI streamline (Insight Die spend + single-modal), Stress Check 12-string narrative set. No git touches in last 3 days on any of these paths. Fresh drain target: next Beta-500 dry-run before 2026-07-01.
- AUDIT M1 stale-open: `app/scene-controls-popout/page.tsx:384` already has `prepareUpload('tactical-maps', file)` — todo item should be closed. No action needed in code; todo needs a human strike-through.
- gm-notes XSS carry-over (flagged 2026-06-09 security audit): `dangerouslySetInnerHTML` with no DOMPurify/sanitize still present in gm-notes component. Unresolved.

**Action:** no new fires; persistent drift unchanged. Next needed move: schedule Beta-500 dry-run to drain HOPED-FOR backlog + close AUDIT M1 todo manually.

---

## 2026-06-10 00:12 UTC

**Status:** DRIFT (carry-over run 60)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [0 high, 0 critical]

**CI:** last 5 runs all pass (latest 2026-06-09T21:10Z)

**Drift:**
- HOPED-FOR >21d: Tier-2 Recruit (all phases), P3 Q4-b Advantages, FI streamline (Insight Die spend + single-modal flow), Stress Check 12-string narrative lock. 0 recent commits. Drain target: Beta-500 dry-run before 2026-07-01.
- AUDIT M1 stale-open: `prepareUpload('tactical-maps')` shipped at `scene-controls-popout/page.tsx:384`. Flip checkbox.
- gm-notes XSS trap carry-over: `app/gm-notes-popout/page.tsx:694` dangerouslySetInnerHTML — no live vector today; fix before any caller passes a DB-sourced title.

**Action:** carry-over — no new findings. Prioritize gm-notes XSS fix (Hunt & Peck) + Beta-500 dry-run to drain HOPED-FOR.

---

## 2026-06-09 21:07 UTC

**Status:** DRIFT (carry-over run 59)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [0 high, 0 critical]

**CI:** last 5 runs all pass (latest 18:08 UTC)

**Drift:**
- HOPED-FOR >21d: Tier-2 Recruit (all phases), P3 Q4-b Advantages, FI streamline (Insight Die spend + single-modal flow), Stress Check 12-string narrative lock. 0 recent commits. Drain target: Beta-500 dry-run before 2026-07-01.
- AUDIT M1 stale-open: `prepareUpload('tactical-maps')` shipped at `scene-controls-popout/page.tsx:384`. Flip checkbox.
- gm-notes XSS trap carry-over: `app/gm-notes-popout/page.tsx:694` dangerouslySetInnerHTML — flagged NEW in 18:06 run + security-audit 2026-06-09. No live vector today; fix before any caller passes a DB-sourced title.

**Action:** carry-over — no new findings. Prioritize gm-notes XSS fix (Hunt & Peck) + Beta-500 dry-run to drain HOPED-FOR.

---

## 2026-06-09 18:06 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [0 high, 0 critical]

**CI:** last 5 runs all pass (latest 16:26 UTC)

**Drift:**
- HOPED-FOR >21d (no playtest evidence): Tier-2 Recruit (all phases), P3 Q4-b Advantages, FI streamline (Insight Die spend + single-modal flow), Stress Check 12-string narrative lock. Fresh drain target: Beta-500 dry-run before 2026-07-01.
- AUDIT M1 stale-open: `scene-controls-popout/page.tsx` `prepareUpload('tactical-maps')` IS SHIPPED (line 384). Close the todo.
- **NEW (security-audit 2026-06-09 16:23 UTC):** `app/gm-notes-popout/page.tsx:694` — `dangerouslySetInnerHTML` with prop-passed `title`; no live XSS today (all callers use static strings), but API is a trap if a DB value ever flows in. Fix: replace with React text node + sibling span. Logged in `tasks/security-audit.md`.

**Action:** close AUDIT M1 todo (already shipped); review gm-notes-popout XSS trap before next caller adds a DB-sourced title string.

---

## 2026-06-09 15:06 UTC

**Status:** DRIFT (carry-over run 57)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all pass (latest 2026-06-09T12:10:00Z)

**Drift:**
- **HOPED-FOR >21d (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages, FI Insight Die spend + single-modal flow, Stress Check 12-string narrative lock. 0 commits in last 3 days. Drain target: Beta-500 dry-run before 2026-07-01.
- **Stale-as-open (todo.md):** `AUDIT M1` — `prepareUpload('tactical-maps')` live at `scene-controls-popout/page.tsx:384` + `tactical-maps` registered in `lib/safe-upload.ts:36`. Mark done.

**Action:** same carry-over — schedule Beta-500 dry-run before 7/1 to drain HOPED-FOR; flip AUDIT M1 checkbox when convenient.

---

## 2026-06-09 12:09 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed]

**Audit:** npm audit [clean]

**CI:** last 5 runs all pass (latest: 2026-06-09T09:08 UTC)

**Drift:**
- HOPED-FOR - Tier-2 Recruit (Phase A/B/C) - no git touch in 3+ days, no playtest signal. Still unverified.
- HOPED-FOR - P3 Q4-b Advantages (GM grant dialog + player tab + Use button + C3 broadcast) - no git touch in 3+ days. Unit-tested only.
- HOPED-FOR - FI streamline Phase 2/3 (single-modal flow + Insight Die spend) - no git touch in 3+ days. No multi-player table coverage.
- HOPED-FOR - Stress Check 12-string narrative lock (across 10 roll types) - no git touch in 3+ days. Unit-tested only.
- STALE-OPEN todo `[MEDIUM][HP] AUDIT M1` - `prepareUpload('tactical-maps', file)` is live at `app/scene-controls-popout/page.tsx:384` AND `tactical-maps` is registered in `lib/safe-upload.ts:36`. Both halves of the fix are shipped. Mark done.

**Action:** Mark AUDIT M1 todo done (already shipped). HOPED-FOR drain target = next Beta-500 dry-run playtest before 2026-07-01.

---

## 2026-06-09 09:06 UTC

**Status:** DRIFT (carry-over run 56)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (most recent 2026-06-09T06:08:56Z)

**Drift:**
- **HOPED-FOR >21d unplaytested (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages, FI Insight Die spend + single-modal flow, Stress Check 12-string narrative lock. 0 commits to these areas in last 3 days. Drain target: Beta-500 dry-run before 2026-07-01.
- **Stale-as-open #1 (todo.md):** `AUDIT M1` — `prepareUpload('tactical-maps')` confirmed live at `scene-controls-popout/page.tsx` + `tactical-maps` registered in `lib/safe-upload.ts`. Checkbox flip owed.
- **Stale-as-open #2 (todo.md):** `#2 BLOCKER characters cross-user write` — SQL fix file exists, debug-handoff shows GREEN (closed 2026-05-25). Mark `[x]`.

**Action:** same carry-over — schedule Beta-500 dry-run before 7/1 to drain HOPED-FOR; flip 2 stale checkboxes in todo.md when convenient.

---

## 2026-06-09 06:06 UTC

**Status:** DRIFT (carry-over run 55)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (most recent 2026-06-09T00:09:22Z)

**Drift:**
- **HOPED-FOR >10d unplaytested (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages, FI Insight Die spend + single-modal flow, Stress Check 12-string narrative lock. 0 commits to these areas since 2026-06-01. Drain target: Beta-500 dry-run before 2026-07-01.
- **Stale-as-open #1 (todo.md):** `AUDIT M1` — `prepareUpload('tactical-maps')` confirmed live at `scene-controls-popout/page.tsx` + `tactical-maps` registered in `lib/safe-upload.ts`. Checkbox flip owed.
- **Stale-as-open #2 (todo.md):** `#2 BLOCKER characters cross-user write` — SQL fix file exists, debug-handoff shows GREEN (closed 2026-05-25). Mark `[x]`.

**Action:** same carry-over — schedule Beta-500 dry-run before 7/1 to drain HOPED-FOR; flip 2 stale checkboxes in todo.md when convenient.

---

## 2026-06-09 00:07 UTC

**Status:** DRIFT (carry-over run 54)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (most recent 2026-06-08T21:08:16Z)

**Drift:**
- **HOPED-FOR >10d unplaytested (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages, FI Insight Die spend + single-modal flow, Stress Check 12-string narrative lock. 0 commits to these areas since 2026-06-01. Drain target: Beta-500 dry-run before 2026-07-01.
- **Stale-as-open #1 (todo.md):** `AUDIT M1` — `prepareUpload('tactical-maps')` confirmed live at `scene-controls-popout/page.tsx` + `tactical-maps` registered in `lib/safe-upload.ts:36`. Checkbox flip owed.
- **Stale-as-open #2 (todo.md):** `#2 BLOCKER characters cross-user write` — SQL fix file exists (`sql/characters-gm-write-rls-2026-05-24.sql`), debug-handoff shows GREEN. Mark `[x]`.

**Action:** same carry-over — schedule Beta-500 dry-run before 7/1 to drain HOPED-FOR; flip 2 stale checkboxes in todo.md when convenient.

---

## 2026-06-08 21:06 UTC

**Status:** DRIFT (carry-over run 53)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (most recent 2026-06-08T18:07:50Z)

**Drift:**
- **HOPED-FOR >9d unplaytested (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages, FI Insight Die spend + single-modal flow, Stress Check 12-string narrative lock. 0 commits to these areas since 2026-06-01. Drain target: Beta-500 dry-run before 2026-07-01.
- **Stale-as-open #1 (todo.md):** `AUDIT M1` — `prepareUpload('tactical-maps')` confirmed live at `scene-controls-popout/page.tsx` + `tactical-maps` registered in `lib/safe-upload.ts:36`. Checkbox flip owed.
- **Stale-as-open #2 (todo.md):** `#2 BLOCKER characters cross-user write` — SQL fix file exists (`sql/characters-gm-write-rls-2026-05-24.sql`), debug-handoff shows GREEN. Mark `[x]`.

**Action:** same carry-over — schedule Beta-500 dry-run before 7/1 to drain HOPED-FOR; flip 2 stale checkboxes in todo.md when convenient.

---

## 2026-06-08 18:07 UTC

**Status:** DRIFT (carry-over run 52)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (most recent 2026-06-08T15:12:56Z)

**Drift:**
- **HOPED-FOR >7d unplaytested (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages, FI Insight Die spend + single-modal flow, Stress Check 12-string narrative lock. 0 commits to these areas since 2026-06-01. Drain target: Beta-500 dry-run before 2026-07-01.
- **Stale-as-open #1 (todo.md):** `AUDIT M1` — `prepareUpload('tactical-maps')` confirmed live at `scene-controls-popout/page.tsx:384` + `tactical-maps` registered in `lib/safe-upload.ts:36`. Checkbox flip owed.
- **Stale-as-open #2 (todo.md):** `#2 BLOCKER characters cross-user write` — all 8 flows GREEN per debug-handoff (closed 2026-05-25). Mark `[x]`.

**Action:** same carry-over — schedule Beta-500 dry-run before 7/1 to drain HOPED-FOR; flip 2 stale checkboxes in todo.md when convenient.

---

## 2026-06-08 15:12 UTC

**Status:** DRIFT (carry-over run 51)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (most recent 2026-06-08T12:09:42Z)

**Drift:**
- **HOPED-FOR >21d unplaytested (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages, FI Insight Die spend + single-modal flow, Stress Check 12-string narrative lock. 0 commits to these areas in last 3 days. Drain target: Beta-500 dry-run before 2026-07-01.
- **Stale-as-open #1 (todo.md):** `AUDIT M1` — `prepareUpload('tactical-maps')` confirmed live at `scene-controls-popout/page.tsx:384` + `tactical-maps` registered in `lib/safe-upload.ts:36`. Checkbox flip owed.
- **Stale-as-open #2 (todo.md):** `#2 BLOCKER characters cross-user write` — all 8 flows GREEN per debug-handoff (closed 2026-05-25). Mark `[x]`.

**Action:** same carry-over — schedule Beta-500 dry-run before 7/1 to drain HOPED-FOR; flip 2 stale checkboxes in todo.md when convenient.

---

## 2026-06-08 15:07 UTC

**Status:** DRIFT (carry-over run 50)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (most recent 2026-06-08T09:07:37Z)

**Drift:**
- **HOPED-FOR >20d unplaytested (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages, FI Insight Die spend + single-modal flow, Stress Check 12-string narrative lock. 0 commits to these areas in last 3 days. Drain target: Beta-500 dry-run before 2026-07-01.
- **Stale-as-open #1 (todo.md):** `AUDIT M1` — `prepareUpload('tactical-maps')` confirmed live at `scene-controls-popout/page.tsx:384` + `tactical-maps` registered in `lib/safe-upload.ts:36`. Checkbox flip owed.
- **Stale-as-open #2 (todo.md):** `#2 BLOCKER characters cross-user write` — all 8 flows GREEN per debug-handoff (closed 2026-05-25). Mark `[x]`.

**Action:** same carry-over — schedule Beta-500 dry-run before 7/1 to drain HOPED-FOR; flip 2 stale checkboxes in todo.md when convenient.

---

## 2026-06-08 12:07 UTC

**Status:** DRIFT (carry-over run 49)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (most recent 2026-06-08T06:09:43Z)

**Drift:**
- **HOPED-FOR >20d unplaytested (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages, FI Insight Die spend + single-modal flow, Stress Check 12-string narrative lock. 0 commits to these areas in last 3 days. Drain target: Beta-500 dry-run before 2026-07-01.
- **Stale-as-open #1 (todo.md):** `AUDIT M1` — `prepareUpload('tactical-maps')` confirmed live at `scene-controls-popout/page.tsx:384` + `tactical-maps` registered in `lib/safe-upload.ts:36`. Checkbox flip owed.
- **Stale-as-open #2 (todo.md):** `#2 BLOCKER characters cross-user write` — all 8 flows GREEN per debug-handoff (closed 2026-05-25). Mark `[x]`.

**Action:** same carry-over — schedule Beta-500 dry-run before 7/1 to drain HOPED-FOR; flip 2 stale checkboxes in todo.md when convenient.

---

## 2026-06-08 09:07 UTC

**Status:** DRIFT (carry-over run 48)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (most recent 2026-06-08T00:08:44Z)

**Drift:**
- **HOPED-FOR >20d unplaytested (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages, FI Insight Die spend + single-modal flow, Stress Check 12-string narrative lock. 0 commits to these areas in last 3 days. Drain target: Beta-500 dry-run before 2026-07-01.
- **Stale-as-open #1 (todo.md):** `AUDIT M1` — `prepareUpload('tactical-maps')` confirmed live at `scene-controls-popout/page.tsx:384` + `tactical-maps` registered in `lib/safe-upload.ts:36`. Checkbox flip owed.
- **Stale-as-open #2 (todo.md):** `#2 BLOCKER characters cross-user write` — all 8 flows GREEN per debug-handoff (closed 2026-05-25). Mark `[x]`.

**Action:** same carry-over — schedule Beta-500 dry-run before 7/1 to drain HOPED-FOR; flip 2 stale checkboxes in todo.md when convenient.

---

## 2026-06-08 06:07 UTC

**Status:** DRIFT (carry-over run 47)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (most recent 2026-06-07T21:07:30Z)

**Drift:**
- **HOPED-FOR >20d unplaytested (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages, FI Insight Die spend + single-modal flow, Stress Check 12-string narrative lock. 0 commits to these areas in last 3 days. Drain target: Beta-500 dry-run before 2026-07-01.
- **Stale-as-open #1 (todo.md):** `AUDIT M1` — `prepareUpload('tactical-maps')` confirmed live at `scene-controls-popout/page.tsx`. Checkbox flip owed.
- **Stale-as-open #2 (todo.md):** `#2 BLOCKER characters cross-user write` — all 8 flows GREEN per debug-handoff. Mark `[x]`.

**Action:** same carry-over — schedule Beta-500 dry-run before 7/1 to drain HOPED-FOR; flip 2 stale checkboxes in todo.md when convenient.

---

## 2026-06-07 21:05 UTC

**Status:** DRIFT (carry-over run 46)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (most recent 2026-06-07T18:06:11Z)

**Drift:**
- **HOPED-FOR >21d unplaytested (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages, FI Insight Die spend + single-modal flow, Stress Check 12-string narrative lock. 0 commits to these areas in last 3 days. Drain target: Beta-500 dry-run before 2026-07-01.
- **Stale-as-open #1 (todo.md):** `AUDIT M1` stability-audit row still `[ ]` — `prepareUpload('tactical-maps')` is live at `scene-controls-popout/page.tsx:384`. Checkbox flip owed.
- **Stale-as-open #2 (todo.md):** `#2 BLOCKER characters cross-user write` stability-audit row still `[ ]` — all 8 flows verified GREEN in debug-handoff. Mark `[x]`.

**Action:** same carry-over — schedule Beta-500 dry-run before 7/1 to drain HOPED-FOR; flip 2 stale checkboxes in todo.md when convenient.

---

## 2026-06-07 18:05 UTC

**Status:** DRIFT (carry-over run 45)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (most recent 2026-06-07T15:08:20Z)

**Drift:**
- **HOPED-FOR >21d unplaytested (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages, FI Insight Die spend + single-modal flow, Stress Check 12-string narrative lock. 0 commits to these areas in last 3 days. Drain target: Beta-500 dry-run before 2026-07-01.
- **Stale-as-open #1 (todo.md):** `AUDIT M1` — `prepareUpload('tactical-maps')` confirmed wired at `scene-controls-popout/page.tsx`; already shipped. Checkbox flip owed.
- **Stale-as-open #2 (todo.md):** `#2 BLOCKER characters cross-user write` — SQL fix file exists (`sql/characters-gm-write-rls-2026-05-24.sql`); debug-handoff shows 8 flows verified. Confirm live application status and close.

**Action:** same carry-over — schedule Beta-500 dry-run to drain HOPED-FOR items before 7/1; close 2 stale todos.

---

## 2026-06-07 15:06 UTC

**Status:** DRIFT (carry-over run 44)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (most recent 2026-06-07T12:08:40Z)

**Drift:**
- **HOPED-FOR >19d unplaytested (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages, FI Insight Die spend + single-modal flow, Stress Check 12-string narrative lock. 0 commits to these areas in last 3 days. Drain target: Beta-500 dry-run before 2026-07-01.
- **Stale-as-open #1 (todo.md):** `AUDIT M1` — `prepareUpload('tactical-maps')` confirmed wired at `scene-controls-popout/page.tsx:384`; already marked `[x]` shipped above. Checkbox flip owed.
- **Stale-as-open #2 (todo.md):** `#2 BLOCKER characters cross-user write` — all 8 flows verified GREEN in debug-handoff. Mark `[x]`.

**Action:** same carry-over — schedule Beta-500 dry-run to drain HOPED-FOR items before 7/1; close 2 stale todos when convenient.

---

## 2026-06-07 12:07 UTC

**Status:** DRIFT (carry-over run 43)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (most recent 2026-06-07T09:07:25Z)

**Drift:**
- **HOPED-FOR >18d unplaytested (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages, FI Insight Die spend + single-modal flow, Stress Check 12-string narrative lock. No code activity on any of these surfaces in last 3 days. Drain target: Beta-500 dry-run before 2026-07-01.
- **Stale-as-open #1 (todo.md L50):** `AUDIT M1` — `prepareUpload('tactical-maps')` wired at `scene-controls-popout/page.tsx:384`; a separate todo entry explicitly marks it SHIPPED. Mark `[x]`.
- **Stale-as-open #2 (todo.md L95):** `#2 BLOCKER characters cross-user write` — all flows shipped + verified GREEN in debug-handoff. Mark `[x]`.

**Action:** same carry-over as prior 42 runs — schedule Beta-500 dry-run to drain HOPED-FOR items; close 2 stale todos when convenient.

---

## 2026-06-07 09:05 UTC

**Status:** DRIFT (carry-over run 42)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high, 0 critical]

**CI:** last 5 runs all success (most recent 2026-06-07T06:08:14Z via GitHub MCP)

**Drift:**
- **HOPED-FOR >18d unplaytested (debug-handoff §3):** Tier-2 Recruit (Phase A/B/C approach flags + morale-tick drainer + modal gates), P3 Q4-b Advantages (unit-tested, never 2-client playtested), FI streamline (Insight Die spend + single-modal flow), Stress Check 12-string narrative lock + narrative polish across 10 roll types. No git activity on any of these surfaces in the last 3 days. Fresh drain target is Beta-500 dry-run before 2026-07-01.
- **Stale-as-open #1 (todo.md L50):** `[MEDIUM][HP] AUDIT M1 - close security carry-over` — `prepareUpload('tactical-maps', file)` IS wired at `app/scene-controls-popout/page.tsx:384`; a separate todo entry (L31) explicitly marks AUDIT M1 SHIPPED. Checkbox needs `[x]`.
- **Stale-as-open #2 (todo.md L95):** `#2 BLOCKER - characters cross-user write data-loss CLASS` parent checkbox open — all sub-entries show `[x]` shipped (GM policy, RPC, client rewire, E2E un-fixme). Parent checkbox needs `[x]`.

**Action:** HOPED-FOR items now >18 days without playtest signal — flag for Xero: schedule a Beta-500 dry-run session soon to drain these or accept them as untested pre-KS risk. Stale todos are cosmetic; update checkboxes when convenient.

---

## 2026-06-07 06:07 UTC

**Status:** DRIFT (carry-over — 41st consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all success (latest: 2026-06-07T00:08Z, via GitHub MCP)

**Drift:**
- HOPED-FOR (>8 days since 2026-05-30 drain pass, no playtest signal): Tier-2 Recruit (A/B/C), P3 Q4-b Advantages, FI Insight Die spend, Stress 12-string narrative lock. Drain target: Beta-500 dry-run before 2026-07-01.
- Stale `[ ]` AUDIT M1: `prepareUpload('tactical-maps')` wired at `scene-controls-popout/page.tsx:384`. Mark `[x]`.
- Stale `[ ]` #2 BLOCKER characters: all 8 flows shipped + verified (debug-handoff GREEN). Mark `[x]`.

**Action:** close 2 stale todos (AUDIT M1 + #2 BLOCKER); schedule Beta-500 dry-run to drain HOPED-FOR.

---

## 2026-06-07 00:08 UTC

**Status:** DRIFT (carry-over — 40th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all success (latest: 2026-06-06T21:07Z, via GitHub MCP)

**Drift:**
- HOPED-FOR (>19 days, no playtest signal): Tier-2 Recruit (A/B/C), P3 Q4-b Advantages, FI Insight Die spend, Stress 12-string narrative lock. Drain target: Beta-500 dry-run before 2026-07-01.
- Stale `[ ]` AUDIT M1: `prepareUpload('tactical-maps')` wired at `scene-controls-popout/page.tsx:384`. Mark `[x]`.
- Stale `[ ]` #2 BLOCKER characters: all 8 flows shipped + verified (debug-handoff GREEN). Mark `[x]`.

**Action:** close 2 stale todos (AUDIT M1 + #2 BLOCKER); schedule Beta-500 dry-run to drain HOPED-FOR.

---

## 2026-06-06 21:05 UTC

**Status:** DRIFT (carry-over — 39th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all success (latest: 2026-06-06T18:06Z, via GitHub MCP)

**Drift:**
- HOPED-FOR (>19 days, no playtest signal): Tier-2 Recruit (A/B/C), P3 Q4-b Advantages, FI Insight Die spend, Stress 12-string narrative lock. Drain target: Beta-500 dry-run before 2026-07-01.
- Stale `[ ]` AUDIT M1: `prepareUpload('tactical-maps')` wired at `scene-controls-popout/page.tsx:384`. Mark `[x]`.
- Stale `[ ]` #2 BLOCKER characters: all 8 flows shipped + verified (debug-handoff GREEN). Mark `[x]`.

**Action:** close 2 stale todos (AUDIT M1 + #2 BLOCKER); schedule Beta-500 dry-run to drain HOPED-FOR.

---

## 2026-06-06 18:05 UTC

**Status:** DRIFT (carry-over — 38th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all success (latest: 2026-06-06T15:07Z, via GitHub MCP)

**Drift:**
- HOPED-FOR (>19 days, no playtest signal): Tier-2 Recruit (A/B/C), P3 Q4-b Advantages, FI Insight Die spend, Stress 12-string narrative lock. Drain target: Beta-500 dry-run before 2026-07-01.
- Stale `[ ]` AUDIT M1: `prepareUpload('tactical-maps')` wired at `scene-controls-popout/page.tsx:384`. Mark `[x]`.
- Stale `[ ]` #2 BLOCKER characters: all 8 flows shipped + verified (debug-handoff GREEN). Mark `[x]`.

**Action:** close 2 stale todos (AUDIT M1 + #2 BLOCKER); schedule Beta-500 dry-run to drain HOPED-FOR.

---

## 2026-06-06 15:05 UTC

**Status:** DRIFT (carry-over — 37th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all success (latest: 2026-06-06T12:07Z, via GitHub MCP)

**Drift:**
- HOPED-FOR (>19 days, no playtest signal): Tier-2 Recruit (A/B/C), P3 Q4-b Advantages, FI Insight Die spend, Stress 12-string narrative lock. Drain target: Beta-500 dry-run before 2026-07-01.
- Stale `[ ]` AUDIT M1: `prepareUpload('tactical-maps')` wired at `scene-controls-popout/page.tsx:384`. Mark `[x]`.
- Stale `[ ]` #2 BLOCKER characters: all 8 flows shipped + verified (debug-handoff GREEN). Mark `[x]`.

**Action:** close 2 stale todos (AUDIT M1 + #2 BLOCKER); schedule Beta-500 dry-run to drain HOPED-FOR.

---

## 2026-06-06 12:06 UTC

**Status:** DRIFT (carry-over — 36th consecutive run; no new findings; 2 stale todos now code-confirmed shipped)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all success (MCP GitHub; gh CLI not in sandbox)

**Drift:**
- HOPED-FOR (>18 days, no playtest coverage): Tier-2 Recruit (Phase A/B/C), P3 Q4-b Advantages (grant/use/feed), FI streamline (Insight Die + single-modal), Stress Check 12-string narrative lock. Target: next Beta-500 dry-run before 2026-07-01.
- **STALE TODO #1 — AUDIT M1 confirmed shipped:** `app/scene-controls-popout/page.tsx:384` already calls `prepareUpload('tactical-maps', file)` and `tactical-maps` is registered. Todo `[ ]` is stale — needs `[x]` in `tasks/todo.md`.
- **STALE TODO #2 — #2 BLOCKER characters RLS confirmed shipped:** `give_item_to_character` RPC is wired at `table/page.tsx:6930`; debug-handoff confirms GREEN (all 8 flows resolved 2026-05-25). Todo `[ ]` is stale — needs `[x]` in `tasks/todo.md`.

**Action:** Mark AUDIT M1 and #2 BLOCKER characters todos done in `tasks/todo.md`; then HOPED-FOR items need next playtest to drain.

---

## 2026-06-06 09:04 UTC

**Status:** DRIFT (carry-over — 35th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh CLI not in sandbox — skipped

**Drift:** carry-over from 06:05 entry — 6 HOPED-FOR items still unplaytested (>7 days); 2 stale todos (#2 BLOCKER characters + AUDIT M1) still marked `[ ]` despite being shipped/resolved.

**Action:** same as 06:05 — schedule Beta-500 dry-run; close the 2 stale todos.

---

## 2026-06-06 06:05 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** clean (0 high, 0 critical)

**CI:** last 5 runs all pass (latest: 2026-06-06T00:07Z)

**Drift:**
- HOPED-FOR items - all 6 still unplaytested, >7 days since 2026-05-30 drain pass:
  - Tier-2 Recruit (Phase A/B/C approach flags, morale-tick, locked-approach gates)
  - P3 Q4-b Advantages (GM grant dialog, player tab, Use button, Award-on-feed, C3 broadcast)
  - FI streamline (Insight Die spend + single-modal flow - no multi-player table hit)
  - Stress Check 12-string narrative lock (unit-tested, never playtested as a set)
  - Vehicle popout broadcasts (Phase B - awaiting full ride at next playtest)
  - Combat-flow Phase B (initiative-bar ordering + action decrement - awaiting 4 HP testids)
- Stale todo item 28: `img_scale` fix CODE SHIPPED 2026-05-27 — awaiting Xero 2-client visual eyeball for 10 days. Close it or confirm it's still pending.

**Action:** Schedule Beta-500 dry-run to drain HOPED-FOR list (target ≤7/1). Close todo item 28 if the visual eyeball already happened.

---

## 2026-06-06 00:06 UTC

**Status:** DRIFT (carry-over — 34th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-05T21:09Z)

**Drift:**
- Carry-over (>18 days): 4 HOPED-FOR items (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish) — drain target is Beta-500 dry-run before 2026-07-01.
- Carry-over: AUDIT M1 `[ ]` todo stale-as-shipped — `prepareUpload('tactical-maps', file)` wired at `scene-controls-popout:384`. Mark `[x]`.
- Carry-over: `#2 BLOCKER characters cross-user write` `[ ]` todo stale-as-shipped — debug-handoff marks GREEN (all 8 flows resolved 2026-05-25). Mark `[x]`.

**Action:** close 2 stale todos (AUDIT M1 + #2 BLOCKER characters); schedule Beta-500 dry-run playtest to drain HOPED-FOR list.

---

## 2026-06-05 21:06 UTC

**Status:** DRIFT (carry-over — 33rd consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-05T18:06Z)

**Drift:**
- Carry-over (>17 days): 4 HOPED-FOR items (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish) — drain target is Beta-500 dry-run before 2026-07-01.
- Carry-over: AUDIT M1 `[ ]` todo stale-as-shipped — `prepareUpload('tactical-maps', file)` wired at `scene-controls-popout:384`. Mark `[x]`.
- Carry-over: `#2 BLOCKER characters cross-user write` `[ ]` todo stale-as-shipped — debug-handoff marks GREEN (all 8 flows resolved 2026-05-25). Mark `[x]`.

**Action:** close 2 stale todos (AUDIT M1 + #2 BLOCKER characters); schedule Beta-500 dry-run playtest to drain HOPED-FOR list.

---

## 2026-06-05 18:05 UTC

**Status:** DRIFT (carry-over — 32nd consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-05T15:07Z)

**Drift:**
- Carry-over (>10 days): 4 HOPED-FOR items (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish) — drain target is Beta-500 dry-run before 2026-07-01.
- Carry-over: AUDIT M1 `[ ]` todo stale-as-shipped — `prepareUpload('tactical-maps', file)` wired at `scene-controls-popout:384`. Mark `[x]`.
- Carry-over: `#2 BLOCKER characters cross-user write` `[ ]` todo stale-as-shipped — debug-handoff marks GREEN (all 8 flows resolved 2026-05-25). Mark `[x]`.

**Action:** close 2 stale todos (AUDIT M1 + #2 BLOCKER characters); schedule Beta-500 dry-run playtest to drain HOPED-FOR list.

---

## 2026-06-05 15:05 UTC

**Status:** DRIFT (carry-over — 31st consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-05T12:06Z)

**Drift:**
- Carry-over (>10 days): 4 HOPED-FOR items (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish) — drain target is Beta-500 dry-run before 2026-07-01.
- Carry-over: AUDIT M1 `[ ]` todo stale-as-shipped — `prepareUpload('tactical-maps', file)` wired at `scene-controls-popout:384`. Mark `[x]`.
- Carry-over: `#2 BLOCKER characters cross-user write` `[ ]` todo stale-as-shipped — debug-handoff marks GREEN (all 8 flows resolved 2026-05-25). Mark `[x]`.

**Action:** close 2 stale todos (AUDIT M1 + #2 BLOCKER characters); schedule Beta-500 dry-run playtest to drain HOPED-FOR list.

---

## 2026-06-05 12:05 UTC

**Status:** DRIFT (carry-over — 30th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-05T09:07Z)

**Drift:**
- Carry-over (>9 days): 4 HOPED-FOR items (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish) — drain target is Beta-500 dry-run before 2026-07-01.
- Carry-over: AUDIT M1 `[ ]` todo stale-as-shipped — `prepareUpload('tactical-maps', file)` wired at `scene-controls-popout:384`. Mark `[x]`.
- Carry-over: `#2 BLOCKER characters cross-user write` `[ ]` todo stale-as-shipped — debug-handoff marks GREEN (all 8 flows resolved 2026-05-25). Mark `[x]`.

**Action:** close 2 stale todos (AUDIT M1 + #2 BLOCKER characters); schedule Beta-500 dry-run playtest to drain HOPED-FOR list.

---

## 2026-06-05 09:05 UTC

**Status:** DRIFT (carry-over — 29th consecutive run; 1 new stale-todo finding)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-05T06:07Z)

**Drift:**
- Carry-over (>8 days): 4 HOPED-FOR items (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish) — drain target is Beta-500 dry-run before 2026-07-01.
- Carry-over: AUDIT M1 `[ ]` todo stale-as-shipped — `prepareUpload('tactical-maps', file)` wired at `scene-controls-popout:384` + `tactical-maps` in `lib/safe-upload.ts`. Mark `[x]`.
- NEW: `#2 BLOCKER characters cross-user write` `[ ]` todo stale-as-shipped — debug-handoff marks GREEN (all 8 flows resolved 2026-05-25); `give_item_to_character` RPC live at `table/page.tsx:6930` + `InventoryPanel.tsx:178`. Mark `[x]`.

**Action:** close 2 stale todos (AUDIT M1 + #2 BLOCKER characters); schedule Beta-500 dry-run playtest to drain HOPED-FOR list.

---

## 2026-06-05 06:05 UTC

**Status:** DRIFT (carry-over — 28th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-05T00:06Z)

**Drift:**
- Carry-over (>7 days): 4 HOPED-FOR items (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish) — drain target is Beta-500 dry-run before 2026-07-01.
- Carry-over: AUDIT M1 `[ ]` todo stale-as-shipped — `prepareUpload('tactical-maps', file)` already wired at `scene-controls-popout:384`. Mark `[x]` in `tasks/todo.md`.

**Action:** no new code issues; housekeeping only — close AUDIT M1 todo + schedule playtest to drain HOPED-FOR list.

---

## 2026-06-05 00:05 UTC

**Status:** DRIFT (carry-over — 27th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-04T21:05Z)

**Drift:**
- Carry-over (unresolved, now >6 days): 4 HOPED-FOR items (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish) — drain target is Beta-500 dry-run before 2026-07-01.
- Carry-over: AUDIT M1 `[ ]` todo stale-as-shipped — `prepareUpload('tactical-maps', file)` already wired at `scene-controls-popout:384`. Mark `[x]` in `tasks/todo.md`.

**Action:** no new code issues; housekeeping only — close AUDIT M1 todo + schedule playtest to drain HOPED-FOR list.

---

## 2026-06-04 21:05 UTC

**Status:** DRIFT (carry-over — 26th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not installed in sandbox — skipped

**Drift:**
- Carry-over (unresolved, now >5 days): 4 HOPED-FOR items (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish) — drain target is Beta-500 dry-run before 2026-07-01.
- Carry-over: AUDIT M1 `[ ]` todo stale-as-shipped — `prepareUpload('tactical-maps', file)` already wired at `scene-controls-popout:384`. Mark `[x]` in `tasks/todo.md`.

**Action:** no new code issues; housekeeping only — close AUDIT M1 todo + schedule playtest to drain HOPED-FOR list.

---

## 2026-06-04 18:05 UTC

**Status:** DRIFT (carry-over — 25th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-04T15:06Z)

**Drift:**
- Carry-over (unresolved, now >5 days): 4 HOPED-FOR items (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish) — drain target is Beta-500 dry-run before 2026-07-01.
- Carry-over: AUDIT M1 `[ ]` todo stale-as-shipped — `prepareUpload('tactical-maps', file)` already wired at `scene-controls-popout:384`. Mark `[x]` in `tasks/todo.md`.

**Action:** no new code issues; housekeeping only — close AUDIT M1 todo + schedule playtest to drain HOPED-FOR list.

---

## 2026-06-04 15:05 UTC

**Status:** DRIFT (carry-over — 24th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-04T12:07Z)

**Drift:**
- Carry-over (unresolved, now >5 days): 4 HOPED-FOR items (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish) — no playtest evidence; drain target is the Beta-500 dry-run before 2026-07-01.
- Carry-over: AUDIT M1 `[ ]` todo "close security carry-over at scene-controls-popout:316" is stale-as-shipped — `prepareUpload('tactical-maps', file)` is already wired at `:384`. Mark `[x]` in `tasks/todo.md`.

**Action:** no new code issues; stale DRIFT items are housekeeping only — close AUDIT M1 todo + schedule playtest to drain HOPED-FOR list.

---

## 2026-06-04 12:05 UTC

**Status:** DRIFT (carry-over — 23rd consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-04T09:06Z)

**Drift:**
- Carry-over (unresolved, now >5 days): 4 HOPED-FOR items (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish) — no playtest evidence; drain target is the Beta-500 dry-run before 2026-07-01.
- Carry-over: AUDIT M1 `[ ]` todo "close security carry-over at scene-controls-popout:316" is stale-as-shipped — `prepareUpload('tactical-maps', file)` is already wired at `:384`. Mark `[x]` in `tasks/todo.md`.

**Action:** no new code issues; stale DRIFT items are housekeeping only — close AUDIT M1 todo + schedule playtest to drain HOPED-FOR list.

---

## 2026-06-04 09:04 UTC

**Status:** DRIFT (carry-over — 22nd consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-04T06:06Z)

**Drift:**
- Carry-over (unresolved since 12:05 2026-06-03): 4 HOPED-FOR items >5 days old (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish); AUDIT M1 todo stale-as-shipped.
- No new findings — only health-pulse commits since last run.

**Action:** same as prior entries — next Beta-500 dry-run drains HOPED-FOR; mark AUDIT M1 done in todo.md.

---

## 2026-06-04 06:04 UTC

**Status:** DRIFT (carry-over — 21st consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-04T00:05Z)

**Drift:**
- Carry-over (unresolved since 12:05 2026-06-03): 4 HOPED-FOR items >5 days old (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish); AUDIT M1 todo stale-as-shipped.
- No new findings — only health-pulse commits since last run.

**Action:** same as prior entries — next Beta-500 dry-run drains HOPED-FOR; mark AUDIT M1 done in todo.md.

---

## 2026-06-04 00:05 UTC

**Status:** DRIFT (carry-over — 20th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 4 runs all SUCCESS (latest: 2026-06-03T21:06Z)

**Drift:**
- Carry-over (unresolved since 12:05 2026-06-03): 4 HOPED-FOR items >5 days old (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish); AUDIT M1 todo stale-as-shipped.
- No new findings — only health-pulse commits since last run.

**Action:** same as prior entries — next Beta-500 dry-run drains HOPED-FOR; mark AUDIT M1 done in todo.md.

---

## 2026-06-03 21:07 UTC

**Status:** DRIFT (carry-over — 19th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-03T18:06Z)

**Drift:**
- Carry-over (unresolved since 12:05 2026-06-03): 4 HOPED-FOR items >4 days old (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish); AUDIT M1 todo stale-as-shipped.
- No new findings — only health-pulse commits since last run.

**Action:** same as prior entries — next Beta-500 dry-run drains HOPED-FOR; mark AUDIT M1 done in todo.md.

---

## 2026-06-03 18:04 UTC

**Status:** DRIFT (carry-over — 18th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-03T15:07Z)

**Drift:**
- Carry-over (unresolved since 12:05 2026-06-03): 4 HOPED-FOR items >4 days old (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish); AUDIT M1 todo stale-as-shipped.
- No new findings — only health-pulse commits since last run.

**Action:** same as prior entries — next Beta-500 dry-run drains HOPED-FOR; mark AUDIT M1 done in todo.md.

---

## 2026-06-03 15:04 UTC

**Status:** DRIFT (carry-over — 17th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (latest: 2026-06-03T12:07Z)

**Drift:**
- Carry-over (unresolved since 12:05): 4 HOPED-FOR items >4 days old (Tier-2 Recruit / P3 Q4-b Advantages / FI Insight Die spend / Stress 12-string narrative polish); AUDIT M1 todo stale-as-shipped.
- No new findings — no commits since last run.

**Action:** same as 12:05 entry — next Beta-500 dry-run drains HOPED-FOR; mark AUDIT M1 done in todo.md.

---

## 2026-06-03 12:05 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed, 47 files]

**Audit:** npm audit [clean]

**CI:** last 5 runs all pass (latest: 2026-06-03T09:05)

**Drift:**
- HOPED-FOR (4 days old, no playtest update since 2026-05-30 drain pass):
  - Tier-2 Recruit: Phase A approach flags, Phase B morale-tick drainer + Escape Pending, Phase C modal locked-approach gates — no git activity in last 3 days on recruit area
  - P3 Q4-b Advantages: schema + library + GM grant dialog + player tab + Use button + Award-on-feed + C3 broadcast — no git activity in last 3 days on advantages area
  - FI streamline: Insight Die spend + single-modal flow — no git activity in last 3 days
  - Stress Check 12-string narrative lock + narrative polish (HEAL/UNJAM/REPAIR/Stabilize/Gut Instinct/Group Check/FI/DRIVE/BREW/NAVIGATE) — no git activity in last 3 days
- Stale-todo (shipped evidence found): AUDIT M1 (`app/scene-controls-popout/page.tsx`) — `prepareUpload('tactical-maps', file)` already at :384 AND `tactical-maps` registered in `lib/safe-upload.ts` BUCKETS. Todo appears fully shipped; audit-correction needed in todo.md.

**Action:** next Beta-500 dry-run playtest is the drain gate for the 4 HOPED-FOR items; mark AUDIT M1 done in todo.md.

---

## 2026-06-03 09:04 UTC

**Status:** DRIFT (carry-over — 16th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (last: 2026-06-03T06:07Z)

**Drift:**
- Carry-over (unresolved since prior runs): Confidence Ledger stale (§3 says 738/41 → live 853/47); stale `[ ]` todos at lines 43/50/95/150; HOPED-FOR >14 days (Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string).
- No new findings this run — action from 12:04 entry still stands.

**Action:** run `node scripts/refresh-ledger.mjs`; mark todo lines 43/50/95/150 `[x]` or update. No live blockers.

---

## 2026-06-03 06:07 UTC

**Status:** DRIFT (carry-over — 15th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (last: 2026-06-03T00:07Z)

**Drift:**
- Carry-over (unresolved since prior runs): Confidence Ledger stale (§3 says 738/41 → live 853/47); stale `[ ]` todos at lines 43/50/95/150; HOPED-FOR >14 days (Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string).
- No new findings this run — action from 12:04 entry still stands.

**Action:** run `node scripts/refresh-ledger.mjs`; mark todo lines 43/50/95/150 `[x]` or update. No live blockers.

---

## 2026-06-03 00:06 UTC

**Status:** DRIFT (carry-over — 14th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (last: 2026-06-02T21:05Z)

**Drift:**
- Carry-over (unresolved since 06:05): Confidence Ledger stale (§3 says 738/41 → live 853/47); stale `[ ]` todos at lines 43/50/95/150; HOPED-FOR >14 days (Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string).
- No new findings this run — action from 12:04 entry still stands.

**Action:** run `node scripts/refresh-ledger.mjs`; mark todo lines 43/50/95/150 `[x]` or update. No live blockers.

---

## 2026-06-02 21:03 UTC

**Status:** DRIFT (carry-over — 13th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (last: 2026-06-02T18:07Z)

**Drift:**
- Carry-over (unresolved since 06:05): Confidence Ledger stale (§3 says 738/41 → live 853/47); stale `[ ]` todos at lines 43/50/95/150; HOPED-FOR >14 days (Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string).
- No new findings this run — action from 12:04 entry still stands.

**Action:** run `node scripts/refresh-ledger.mjs`; mark todo lines 43/50/95/150 `[x]` or update. No live blockers.

---

## 2026-06-02 18:04 UTC

**Status:** DRIFT (carry-over — 12th consecutive run; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (last: 2026-06-02T16:26Z)

**Drift:**
- Carry-over (unresolved since 06:05): Confidence Ledger stale (§3 says 738/41 → live 853/47); stale `[ ]` todos at lines 43/50/95/150; HOPED-FOR >14 days (Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string).
- No new findings this run — action from 15:10 entry still stands.

**Action:** run `node scripts/refresh-ledger.mjs`; mark todo lines 43/50/95/150 `[x]` or update. No live blockers.

---

## 2026-06-02 15:10 UTC

**Status:** DRIFT (carry-over — 11th consecutive run; 1 new stale-todo finding)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (last: 2026-06-02T12:08Z)

**Drift:**
- **Carry-over (unresolved since 06:05+):** Confidence Ledger stale (debug-handoff §3 says 738/41 → live 853/47); stale `[ ]` todos at lines 43/50/95/150; HOPED-FOR >14 days (Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string).
- **NEW: `todo.md` E2E vehicle-check spec** — `e2e/vehicle-maintenance-checks.spec.ts` exists covering install+gather. Partially satisfies the `[ROUTED -> E2E lane] deterministic vehicle-check regression spec` open todo. Driving/brew/navigate/attack slice still open; partial stale-as-open (not marking done, just flagging partial coverage).
- **INFRA NOTE:** `npm ci --silent` left vitest absent in this sandbox run; a second plain `npm ci` restored it. CI (which uses its own env) ran green — no gate impact, but worth knowing if the silent flag ever runs in a new-clone context.

**Action:** same as 12:04 — run `node scripts/refresh-ledger.mjs`; mark todo lines 43/50/95/150 `[x]` or update. No live blockers.

---

## 2026-06-02 12:04 UTC

**Status:** DRIFT (carry-over x10 — 5 stale todos, 1 ledger drift; CORRECTION: prev runs mis-labelled characters RLS as live blocker — it is stale-as-done)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed / 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS

**Drift:**
- **Confidence Ledger stale:** debug-handoff §3 says 738/41 → live 853/47. Run `node scripts/refresh-ledger.mjs`.
- **`todo.md:95` #2 BLOCKER parent `[ ]` — stale-as-done (CORRECTION).** All 3 sub-items are `[x]`. debug-handoff §1 confirms `characters` cross-user writes GREEN (all 8 flows resolved 2026-05-25, e866df0). Previous runs flagged this as "live blocker 9 days no fix" — incorrect; fix shipped 2026-05-24/25. Mark parent `[x]`.
- **`todo.md:43` "6 mechanics still owe real code" `[ ]`** — Rest (`5ba32d1`/`bb67398`) + Vehicles-as-Cover (`f264f7b` 2026-06-01) shipped. 4 remain (Upkeep, Env Damage, Travel, Conditions). Update or split item.
- **`todo.md:50` AUDIT M1 `[ ]` — stale-as-done.** `prepareUpload('tactical-maps')` confirmed at `app/scene-controls-popout/page.tsx:384`. Mark `[x]`.
- **`todo.md:150` img_scale visual confirm `[ ]` — stale-as-done.** "awaiting Xero's 2-client eyeball" — 12-check gate ran ALL-PASS 2026-05-30 (debug-handoff §1 TacticalMap GREEN). Mark `[x]`.
- **HOPED-FOR (>14 days):** Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string — drain target Beta-500 before 2026-07-01.

**Action:** HP housekeeping — 4 stale `[ ]` todos to mark `[x]` + update the "6 mechanics" item + run `refresh-ledger.mjs`. No live blockers.

---

## 2026-06-02 09:04 UTC

**Status:** DRIFT (carry-over — 9th consecutive run; 1 new stale-as-done found; characters RLS BLOCKER now 9 days unaddressed)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed, 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS

**Drift:**
- **Confidence Ledger stale:** debug-handoff.md §3 says 738/41 → live 853/47. Run `node scripts/refresh-ledger.mjs`.
- **`todo.md:42` NEW stale-as-done:** Conditions Phase-2 body says "Pickup #4 marked DONE" but checkbox is `[ ]`. Mark `[x]`.
- **`todo.md:43` 6 mechanics partial:** items 1 (Rest - `5ba32d1`/`bb67398`) + 2 (Vehicles-as-Cover RDM - `f264f7b` 2026-06-01) shipped. 4 remain (Upkeep, Env Damage, Travel, Conditions). Update or split item.
- **`todo.md:50` AUDIT M1 duplicate:** stale `[ ]` — shipped + `[x]` at line 32. Delete or mark `[x]`.
- **`todo.md:95` characters RLS BLOCKER:** 9 days, 0 fix commits. Risk Register RED. GM loot/award/ration silently loses data for non-Thriver GMs. Pre-Beta-500 blocker.
- **`todo.md:150` img_scale visual confirm:** "awaiting Xero's 2-client eyeball" — 12-check gate ran ALL-PASS 2026-05-30 per debug-handoff §1. Mark done or update to track viewport-follow verify separately.
- **HOPED-FOR (>16 days):** Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string — drain target Beta-500 before 2026-07-01.

**Action:** characters RLS (line 95) is the only LIVE pre-beta BLOCKER — 9 days no fix. Everything else is housekeeping.

---

## 2026-06-02 06:05 UTC

**Status:** DRIFT (carry-over — 8th consecutive run; same 4 housekeeping items unresolved + 1 new stale-as-done)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed, 47 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (verified via GitHub MCP)

**Drift:**
- **4 carry-overs (unresolved 8 consecutive runs, no code changes since 21:04):**
  - Confidence Ledger: debug-handoff.md §3 says 738/41 → live 853/47. Run `node scripts/refresh-ledger.mjs`.
  - `todo.md:43` "6 mechanics still owe real code" still `[ ]` — Rest shipped; verify remaining 5.
  - `todo.md:95` #2 BLOCKER parent still `[ ]` — all 8 sub-flows CLOSED + GREEN in debug-handoff.
  - `todo.md:50` AUDIT M1 still `[ ]` — confirmed shipped at `b01b561` (`prepareUpload` at `:384`).
- **NEW stale-as-done: `todo.md:150`** img_scale todo says "awaiting Xero's 2-client VISUAL eyeball" — the 12-check 2-client gate ran ALL-PASS on 2026-05-30 (debug-handoff §1 TacticalMap entry). Condition satisfied; mark `[x]` or update to track the FOLLOW-UP (fit-to-panel-width) separately.
- **HOPED-FOR (16+ days):** Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string — drain target Beta-500 before 2026-07-01.

**Action:** HP — `node scripts/refresh-ledger.mjs`; mark todo lines 43, 95, 50, 150 `[x]` or update. (8 runs, escalating.)

---

## 2026-06-01 21:04 UTC

**Status:** DRIFT (carry-over — 7th consecutive run since 00:06; development active since 18:07)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [853 passed, 47 files] (+10 tests, +1 file since 18:07)

**Audit:** npm audit [clean — 0 high/critical]

**CI:** last 5 runs all SUCCESS (verified via GitHub MCP — first run with real CI data after 6 skipped runs)

**Drift:**
- **4 carry-overs (unresolved 7 runs — active commits added 10 tests but housekeeping skipped):**
  - Confidence Ledger: debug-handoff.md §3 says 738/41 → live now 853/47 (+115 tests, +6 files). Run `node scripts/refresh-ledger.mjs`.
  - `todo.md:37` "6 mechanics still owe real code" still `[ ]` — all 6 shipped. Mark `[x]`.
  - `todo.md:88` #2 BLOCKER parent still `[ ]` — all sub-flows closed + verified. Mark `[x]`.
  - `todo.md:44` AUDIT M1 still `[ ]` — `prepareUpload('tactical-maps')` confirmed at `:384`. Mark `[x]`.
- **HOPED-FOR (15+ days):** Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string — drain target Beta-500 before 2026-07-01.

**Action:** HP — 4 housekeeping tasks flagged every run since midnight (7 runs). Run `node scripts/refresh-ledger.mjs`; mark todo lines `[x]`. CI is clean.

---

## 2026-06-01 18:07 UTC

**Status:** DRIFT (carry-over — 6th consecutive run since 00:06; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [843 passed, 46 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh CLI unavailable in sandbox — skipped

**Drift:**
- **4 carry-overs (unresolved across all 6 runs today — escalating):**
  - Confidence Ledger: debug-handoff.md §3 says 738/41 → live 843/46. Run `node scripts/refresh-ledger.mjs`.
  - `todo.md:37` "6 mechanics still owe real code" still `[ ]` — all 6 shipped. Mark `[x]`.
  - `todo.md:88` #2 BLOCKER parent still `[ ]` — all sub-flows closed + verified. Mark `[x]`.
  - `todo.md:44` AUDIT M1 still `[ ]` — duplicate of `[x]` at line 32 (`b01b561` shipped). Mark `[x]`.
- **HOPED-FOR (15+ days):** Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string — drain target Beta-500 before 2026-07-01.

**Action:** HP — 4 housekeeping tasks flagged every run since midnight (6 runs). Needs human pickup today.

---

## 2026-06-01 15:07 UTC

**Status:** DRIFT (carry-over — 5th consecutive run since midnight; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [843 passed, 46 files] (+2 vs 12:05)

**Audit:** npm audit [clean — 0 high/critical]

**CI:** GitHub Actions status unavailable via MCP (no gh CLI equivalent in sandbox)

**Drift:**
- **4 carry-overs (unresolved since 00:06 — 5 runs):**
  - Confidence Ledger: debug-handoff.md §3 states 738/41 → live 843/46. Run `node scripts/refresh-ledger.mjs`.
  - `todo.md:37` "6 mechanics still owe real code" still `[ ]` — all 6 complete (Rest A+B+C shipped 2026-06-01). Mark `[x]`.
  - `todo.md:88` #2 BLOCKER parent still `[ ]` — all 8 sub-flows closed + verified. Mark `[x]`.
  - `todo.md:44` AUDIT M1 still `[ ]` — duplicate of closed `[x]` at line 32 (`b01b561` shipped). Mark `[x]`.
- **HOPED-FOR (14+ days):** Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string — drain target Beta-500 before 2026-07-01.

**Action:** HP — 4 housekeeping tasks flagged every run since midnight: `node scripts/refresh-ledger.mjs`; mark todo lines 37, 88, 44 `[x]`.

---

## 2026-06-01 12:05 UTC

**Status:** DRIFT (carry-over — 09:06 actions still pending; 4th consecutive run, no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [841 passed, 46 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** no open PRs; gh CLI unavailable in sandbox

**Drift:**
- **4 carry-overs (unresolved since 00:06 — 4 runs):**
  - Confidence Ledger: debug-handoff.md §3 still says 738/41 → live 841/46. Run `node scripts/refresh-ledger.mjs`.
  - `todo.md:37` "6 mechanics still owe real code" still `[ ]` — all 6 done. Mark `[x]`.
  - `todo.md:88` #2 BLOCKER parent still `[ ]` — all 8 sub-flows closed + verified. Mark `[x]`.
  - `todo.md:44` AUDIT M1 still `[ ]` — duplicate of closed `[x]` at line 32. Mark `[x]`.
- **HOPED-FOR (13+ days):** Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string — drain target Beta-500 before 2026-07-01.

**Action:** HP — 4 housekeeping tasks: run `node scripts/refresh-ledger.mjs`; mark todo lines 37, 88, 44 `[x]`. (Flagged every run since midnight; needs HP pickup.)

---

## 2026-06-01 09:06 UTC

**Status:** DRIFT (carry-over — 06:04 actions still pending; no new findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [841 passed, 46 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- **06:04 carry-overs (4 HP actions, still unresolved):**
  - Confidence Ledger: debug-handoff.md §3 still says 738/41 → live 841/46. Run `node scripts/refresh-ledger.mjs`.
  - `todo.md:37` "6 mechanics still owe real code" still `[ ]` — 6/6 done. Mark `[x]`.
  - `todo.md:88` #2 BLOCKER parent still `[ ]` — all 8 flows closed + verified. Mark `[x]`.
  - `todo.md:44` AUDIT M1 still `[ ]` — `b01b561` shipped `prepareUpload('tactical-maps')`. Mark `[x]`.
- **HOPED-FOR (unchanged, 14+ days):** Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string — drain target Beta-500 before 2026-07-01.

**Action:** HP — same 4 housekeeping actions from 06:04: run refresh-ledger.mjs; mark todo lines 37, 88, 44 `[x]`.

---

## 2026-06-01 06:04 UTC

**Status:** DRIFT (carry-overs from 00:06 still pending; 1 new stale todo)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [841 passed, 46 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- **00:06 carry-overs (3 HP actions, still unresolved):**
  - Confidence Ledger: debug-handoff.md §3 still says 738/41 → live is NOW 841/46 (escalated from 822/45). Run `node scripts/refresh-ledger.mjs`.
  - `todo.md:37` "6 mechanics still owe real code" still `[ ]` — all 6 done (5 shipped + Conditions Phase-2 = no-work). Mark `[x]`.
  - `todo.md:88` #2 BLOCKER parent still `[ ]` — all 8 sub-flows closed + E2E-verified. Mark `[x]`.
- **New stale todo:** `todo.md:44` `[ ]` AUDIT M1 — `b01b561` shipped `prepareUpload('tactical-maps')` at `:383`; confirmed in code. Duplicate of the closed `[x]` at line 32. Mark `[x]`.
- **HOPED-FOR (unchanged):** Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string — 13+ days, drain target Beta-500 before 2026-07-01. No urgency.

**Action:** HP — batch 4 housekeeping actions: run refresh-ledger.mjs; mark lines 37, 88, 44 `[x]`.

---

## 2026-06-01 00:06 UTC

**Status:** DRIFT (carry-over — 21:06 actions still pending)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [822 passed, 45 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- **21:06 carry-overs (3 HP actions, unresolved):**
  - Confidence Ledger: debug-handoff.md §3 still shows 738/41 → live 822/45. Run `node scripts/refresh-ledger.mjs`.
  - "6 mechanics" parent todo still `[ ]` — actually **6 of 6 done** (5 code-shipped + Conditions Phase-2 = no-real-work per verify-first finding). Mark `[x]`.
  - #2 BLOCKER parent todo still `[ ]` despite all 8 sub-flows closed (cross-user RLS + trade RPC). Mark `[x]`.
- **New since 21:06:** 1 commit `a7af4fa` docs(playtest) grapple modal routing to HP — properly filed `[ ]` in todo.
- **HOPED-FOR (unchanged):** Tier-2 Recruit / Advantages / FI Insight Die / Stress 12-string — 13+ days, drain target Beta-500 before 2026-07-01. No immediate action.

**Action:** HP — run refresh-ledger.mjs, mark "6 mechanics" `[x]`, mark #2 BLOCKER parent `[x]`.

---

## 2026-05-31 21:06 UTC

**Status:** DRIFT (carry-over — 18:06 actions not yet taken)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [822 passed, 45 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- **18:06 actions unresolved** — no new commits since that pulse. Three items still pending:
  - Confidence Ledger stale: debug-handoff.md §3 still shows 738/41 → actual 822/45. Run `node scripts/refresh-ledger.mjs` to update.
  - `todo.md:13` "6 mechanics still owe real code" still `[ ]` (5 of 6 shipped; annotate done).
  - `todo.md:64` #2 BLOCKER parent still `[ ]` despite all sub-items `[x]` ("characters-class fully covered end-to-end").
- HOPED-FOR (Tier-2 Recruit, Advantages, FI streamline, Stress 12-string): 12+ days, drain target Beta-500 before 2026-07-01. No urgency.

**Action:** Same as 18:06 — HP take the 3 checklist actions above when back at keyboard.

---

## 2026-05-31 18:06 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [822 passed, 45 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- **Confidence Ledger stale:** live suite 822/45; debug-handoff.md §3 still shows 738/41. 4 new test files landed since last refresh: `vehicle-cover` (12), `env-damage` (25), `upkeep` (33), `travel` (10); `roll-outcomes` grew 48→52. Run `scripts/refresh-ledger.mjs` to update §3.
- **5 of 6 KS mechanics shipped since 15:07 pulse:** `f264f7b` vehicles-as-cover (#2), `724a1e2` upkeep extract (#3), `1b5b958` env-damage/Falling+Drowning (#4), `e7b1e56` travel (#5). Combined with REST (#1) from before — 5 of 6 done. `todo.md:12` "6 mechanics still owe real code" is still `[ ]`.
- **Carry-over (15:07):** `todo.md:63` (#2 BLOCKER parent) + Upstash dup — still `[ ]`.
- HOPED-FOR (Tier-2 Recruit, Advantages, FI streamline, Stress 12-string): 12+ days old; drain target = Beta-500 dry-run before 2026-07-01. No action needed yet.

**Action:** HP — (1) run `node scripts/refresh-ledger.mjs` + commit to update debug-handoff.md §3 to 822/45; (2) annotate todo.md:12 with "5 of 6 shipped"; (3) mark `todo.md:63` #2 BLOCKER parent `[x]` + Upstash dup `[x]`.

---

## 2026-05-31 15:07 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [739 passed, 41 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- Previous 7 stale items (H2/H3/M2/M4/L78/L100/L175) RESOLVED since 12:06 pulse (`99ef1b1` + `ea5d234`). 2 new stale-as-done items found:
  - `todo.md:63` `#2 BLOCKER - characters cross-user write` — all sub-items `[x]`, last says "fully covered end-to-end", parent still `[ ]`
  - `todo.md:~232` `[HIGH] Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN` — done 2026-05-26 (CURRENT OPEN line 61 `[x]`), dup tracking item still `[ ]`
- HOPED-FOR (Tier-2 Recruit, Advantages, FI streamline, Stress 12-string): 12+ days old; drain target = Beta-500 dry-run before 2026-07-01. No action needed yet.
- `2ea7aaf feat(rest): wire Rest button to clock advance + roll_log feed row` shipped since last pulse — passes all gates, Rest mechanic #1 of 6 in progress.

**Action:** HP — mark `todo.md:63` (#2 BLOCKER parent) `[x]` + mark the Upstash dup item `[x]`. Both are confirmed-done stale checkboxes.

---

## 2026-05-31 12:06 UTC

**Status:** DRIFT (continuing — 34th flag; same 7 stale-as-done todos unresolved)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [738 passed, 41 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- No new issues since 09:03 UTC pulse. Same 7 unchecked todos remain open:
  - H2 (Confidence Ledger refresh) — done in `52fe1d4`; debug-handoff shows 738/41
  - H3 (HOPED-FOR drain) — done in `52fe1d4`; §3 DRAIN PASS 2026-05-30 present
  - M2 (TacticalMap 14-day watch note) — done in `52fe1d4`; §1 watch note present
  - M4 (Patterns learned 2026-05-30) — done in `52fe1d4`; §2 subsection present
  - L78 (scene chooser): useSceneNav.ts + picker in codebase
  - L100 (Initiative Round N): RollsFeed.tsx:520 renders `(Round ${round})`
  - L175 (3-lane coordination): operating-mode.md + lane-protocol.md + active-lanes.md exist
- HOPED-FOR items (Tier-2 Recruit, Advantages, FI streamline, Stress 12-string) still 12 days old; drain target = Beta-500 dry-run before 2026-07-01.

**Action:** Same as 09:03 — HP mark H2/H3/M2/M4/L78/L100/L175 `[x]` in tasks/todo.md. 5-min sweep.

---

## 2026-05-31 09:03 UTC

**Status:** DRIFT (continuing — 33rd flag; 7 stale-as-done todos)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [738 passed, 41 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- HOPED-FOR still in ledger (Tier-2 Recruit, Advantages, FI streamline, Stress 12-string, Vehicle popout broadcasts) — 12 days; drain target = Beta-500 dry-run before 2026-07-01. No action until then.
- Stale-as-done todos (7 total — action needed):
  - H2 (`AUDIT H2 - refresh Confidence Ledger`): done by `52fe1d4` 2026-05-31; debug-handoff.md now shows 738/41 w/ "Auto-refreshed". Still `[ ]` in todo.md.
  - H3 (`AUDIT H3 - HOPED-FOR drain`): done by `52fe1d4`; DRAIN PASS 2026-05-30 notation present in debug-handoff.md §3. Still `[ ]`.
  - M2 (`AUDIT M2 - TacticalMap 14-day watch note`): done by `52fe1d4`; watch note present in debug-handoff.md §1 (L43-45). Still `[ ]`.
  - M4 (`AUDIT M4 - Patterns learned 2026-05-30`): done by `52fe1d4`; subsection at debug-handoff.md L125. Still `[ ]`.
  - L78 (scene chooser / blank-map default): `useSceneNav.ts` + scene-picker exist in codebase. Still `[ ]` — flagged since 06:05 pulse.
  - L100 (Initiative "Round N" display): `RollsFeed.tsx:520` renders `(Round ${round})`. Still `[ ]` — flagged since 06:05 pulse.
  - L175 (3-lane coordination): `operating-mode.md` + `lane-protocol.md` + `active-lanes.md` all exist. Still `[ ]` — flagged since 06:05 pulse.

**Action:** HP — mark all 7 stale-as-done todos `[x]` in `tasks/todo.md` (H2, H3, M2, M4, L78, L100, L175). 5-min sweep.

---

## 2026-05-31 06:05 UTC

**Status:** DRIFT (continuing — 32nd flag; significantly reduced since 00:05 pulse)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [738 passed, 41 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Progress since 00:05 pulse:** `52fe1d4` closed H1+H2+H3+M2+M4 (Confidence Ledger refreshed to 738/41, HOPED-FOR drain pass applied, TacticalMap watch note added, Patterns-2026-05-30 subsection added, as-any ledger updated). `52e2911` closed M5+L3 (realtime-wrap bypass finding doc + useEffect audit done).

**Drift:**
- HOPED-FOR still in ledger (Tier-2 Recruit, Advantages, FI streamline, Stress Check 12-string, Vehicle popout broadcasts) — 12 days; drain target now explicitly set to "next full Beta-500 dry-run playtest before 2026-07-01" (updated in 52fe1d4).
- Stale-as-done todos (3 items audit-correction needed):
  - `useSceneNav.ts` exists (2026-05-25): "Scene navigation for the table header's Tactical Map dropdown" — matches spec. Scene chooser todo item still `[ ]`.
  - Initiative "Round N": write side shipped (`table/page.tsx:1806,1891,2148` write `round` into `damage_json`); render side at `RollsFeed.tsx:520` present. Both halves done; todo still `[ ]`.
  - 3-lane COORDINATION todo (line 175): `operating-mode.md` already contains the 3-lane description; `lane-protocol.md` + `active-lanes.md` exist. Still `[ ]`.

**Action:** HP — mark 3 stale-as-done todo items `[x]` (scene-chooser, Initiative Round N, 3-lane coordination). HOPED-FOR drain event = next Beta-500 dry-run (target 2026-07-01); no action needed until then.

---

## 2026-05-31 00:05 UTC

**Status:** DRIFT (continuing — 31st flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [738 passed, 41 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- HOPED-FOR still undrained (2026-05-19 batch, 12 days; drain target was 2026-05-25 playtest; Confidence Ledger last refreshed 2026-05-24).
- Confidence Ledger stale: debug-handoff.md says 622 tests/37 files; actual 738/41. Run `scripts/refresh-ledger.mjs`.
- L78 (scene chooser / blank-map default) still `[ ]` — stale-as-open; code evidence (`useSceneNav`, scene-picker) in codebase.
- L100 (Initiative "Round N" display) still `[ ]` — `RollsFeed.tsx:520` renders `(Round ${round})`; stale-as-open since 28th flag.
- L108 (Remove/consume inventory item) still `[ ]` — `acc5ae9` shipped x-button feed logging; HP to verify + close.
- TacticalMap YELLOW: **23 commits** since 2-client gate (was 19). New since last pulse: `421a4d6` (share-map one-shot push), `c3e0f10` (sticky scene lock for player — "gate complete"), `0599207` (players follow scene only on explicit Share Map), `aea76cd` (diag: surface auto-fit grid persist failures). Gate re-run still awaiting Xero.

**Action:** Xero — re-run 12-check tactical-map gate (`tasks/tactical-map-verify-2client-testplan-2026-05-27.md`; PASS = #1 KS closes). HP — close L78/L100/L108. Puffer — refresh Confidence Ledger + drain HOPED-FOR post 2026-05-25 playtest.

---

## 2026-05-30 21:05 UTC

**Status:** DRIFT (continuing — 30th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [738 passed, 41 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- HOPED-FOR still undrained (2026-05-19 batch, 11+ days; drain target was 2026-05-25 playtest; Confidence Ledger last refreshed 2026-05-24).
- Confidence Ledger stale: debug-handoff.md says 622 tests/37 files; actual 738/41. Run `scripts/refresh-ledger.mjs`.
- L78 (scene chooser / blank-map default) still `[ ]` — `useSceneNav` + scene-picker dropdown ARE in the code (`page.tsx:484,5294`); stale-as-open, needs HP to close.
- L100 (Initiative "Round N" display) still `[ ]` — `RollsFeed.tsx:520` renders `(Round ${round})`; stale-as-open since 28th flag.
- L108 (Remove/consume inventory item) still `[ ]` — `acc5ae9` shipped x-button feed logging; HP to verify affordance + close.
- TacticalMap YELLOW: **19 commits** since last 2-client verify (was 10 on prior flag); `15d161d` cell_px hard-cap is latest. Gate re-run still awaiting Xero.

**Action:** Xero — re-run 12-check tactical-map gate (`tasks/tactical-map-verify-2client-testplan-2026-05-27.md`; PASS = #1 KS closes). HP — close L78/L100/L108. Puffer — refresh Confidence Ledger + drain HOPED-FOR.

---

## 2026-05-30 18:04 UTC

**Status:** DRIFT (continuing — 29th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [738 passed, 41 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- HOPED-FOR still undrained (11+ days — 2026-05-19 batch; drain target was 2026-05-25; Confidence Ledger last refreshed 2026-05-24).
- Confidence Ledger stale: debug-handoff.md says 622 tests/37 files; actual 738/41. `scripts/refresh-ledger.mjs` is the fix.
- L78 (per-player Map toggle double-click race) still `[ ]` — `100cfc1` shipped the idempotent-toggle fix; flagged for closure since 26th.
- L100 (Initiative "Round N" display) still `[ ]` — `RollsFeed.tsx:520` already renders `(Round ${round})`; stale-as-open since 28th.
- L108 (Remove/consume inventory item) still `[ ]` — `acc5ae9` added x-button feed logging; HP to verify affordance works and close.
- TacticalMap YELLOW: 2 more scene-controls fixes since 28th (`38e59cb` cell_px persist + `89be0be` popout clobber); now 10 commits since last 2-client verify. Gate re-run still awaiting Xero.

**Action:** Xero — re-run 12-check tactical-map gate (`tasks/tactical-map-verify-2client-testplan-2026-05-27.md`; all-PASS = #1 KS closes). HP — close L78/L100/L108. Puffer Fish — refresh Confidence Ledger + drain HOPED-FOR.

---

## 2026-05-30 15:03 UTC

**Status:** DRIFT (continuing — 28th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [738 passed, 41 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- HOPED-FOR still undrained (11+ days — 2026-05-19 batch; drain target was 2026-05-25; 2026-05-30 playtest happened but Confidence Ledger not updated).
- Confidence Ledger stale: debug-handoff.md says 622 tests/37 files; actual 738/41. `scripts/refresh-ledger.mjs` is the fix.
- L78 stale-as-open (per-player Map toggle double-click race): `100cfc1` already shipped the fix; carried from 26th+27th flags.
- **NEW stale-as-open — Initiative "Round N" display todo:** todo says "L476 hardcoded to ⚔️ Initiative"; actual `components/RollsFeed.tsx:520` already renders `(Round ${round})` from `damage_json.round`. Item can be closed.
- **GOOD NEWS — TacticalMap move-follow fix LANDED** (`a9b8c44`, today). Awaiting Xero re-run of 12-check gate (`tasks/tactical-map-verify-2client-testplan-2026-05-27.md`). This is the #1 KS priority item.

**Action:** HP — close Initiative Round N todo + L78. Xero — re-run the 12-check tactical-map gate (all-PASS closes #1 KS priority). Puffer Fish — refresh Confidence Ledger, drain HOPED-FOR.

---

## 2026-05-30 12:07 UTC

**Status:** DRIFT (continuing — 27th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [738 passed, 41 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- HOPED-FOR still undrained (11+ days — 2026-05-19 batch; drain target was 2026-05-25, never actioned in Confidence Ledger).
- Confidence Ledger stale: debug-handoff.md says 622 tests/37 files vs actual 738/41.
- L78 stale-as-open (`100cfc1` shipped idempotent-toggle fix; todo still `[ ]`). Already in 26th flag.
- PC-trade un-fixme (L30) still `[ ]` — test confirms "was test.fixme" (past tense). E2E lane.
- **CORRECTION to 26th flag — TacticalMap YELLOW now 8 unverified commits** (was reported "6+"; `afb962b` pass-live-occupancy + `7287337` atomic bg-upload were missed): ef13951, 5aaaf40, 4a2b3ff, f722652, e94f143, 9e6400c, afb962b, 7287337.
- **NEW — possible stale-as-open L108** ("Remove/consume an item from inventory"): `acc5ae9` (2026-05-30 04:33 UTC) adds feed logging "when player clicks x to use/remove an item" — phrasing implies the x-button affordance pre-existed; todo still `[ ]`. HP verify: does the x-button already work? If yes, close L108.

**Action:** HP — investigate L108 (x-button pre-existed acc5ae9?); close L78. Puffer Fish — refresh Confidence Ledger (622/37→738/41), drain HOPED-FOR. E2E — close PC-trade un-fixme (L30). Xero — 2-client eyeball on TacticalMap (8 unverified commits in YELLOW area; gate `tasks/tactical-map-verify-2client-testplan-2026-05-27.md`).

---

## 2026-05-30 09:03 UTC

**Status:** DRIFT (continuing — 26th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [738 passed, 41 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- HOPED-FOR still undrained (12+ days — 2026-05-19 batch; drain target 2026-05-25, never actioned in Confidence Ledger).
- Confidence Ledger stale: debug-handoff.md says 622 tests/37 files vs actual 738/41 — +116 tests unrecorded.
- **NEW stale-as-open — L78** (WATCH/maybe-harden per-player Map toggle double-click race): commit `100cfc1` 2026-05-27 shipped idempotent ENSURE-ON + explicit toggle + optimistic flip — exactly the fix L78 called for; todo still `[ ]`. Missed by 06:08 pulse.
- PC-trade un-fixme (L30) still `[ ]` — `e2e/inventory-trade.spec.ts:116` confirms "was test.fixme" (past tense = already un-fixme'd). E2E lane.
- TacticalMap YELLOW: 6+ commits since last 2-client verify; gate `tasks/tactical-map-verify-2client-testplan-2026-05-27.md` open.
- **CORRECTION re 06:08 entry:** L85 ("player viewport doesn't FOLLOW token MOVES") is a REAL open bug from 2026-05-29 playtest — do NOT close it. The `7ba065b` [x] item is the effectiveScale/scene-open fix; L85 is the remaining move-follow gap.

**Action:** HP — close L78 (idempotent-toggle shipped `100cfc1`; do NOT close L85). Puffer Fish — refresh Confidence Ledger (622/37→738/41), drain HOPED-FOR. E2E — close PC-trade un-fixme (L30). Xero — 2-client eyeball on TacticalMap gate.

---

## 2026-05-30 06:08 UTC

**Status:** DRIFT (continuing — 25th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [738 passed, 41 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- HOPED-FOR still undrained (11+ days — 2026-05-19 batch; drain target was 2026-05-25 playtest, never actioned in Confidence Ledger).
- Confidence Ledger stale: debug-handoff.md says 622 tests/37 files vs actual 738/41 — +116 tests unrecorded.
- Stale-as-open todos (code shipped, still `[ ]`):
  - L85: viewport move-follow (shipped `7ba065b` 2026-05-29) still open — HP/Puffer close it.
  - **NEW — PC-trade un-fixme** (todo.md ~L30 `[ROUTED -> E2E] un-fixme the PC-trade assertion`): `e2e/inventory-trade.spec.ts` comment confirms "was test.fixme while give-item RPC was pending" — already un-fixme'd, todo not closed. E2E lane to close.
- **NEW — 6 tactical-map commits since 24th flag** (all in YELLOW area, unverified): `ef13951` always re-fit on bg load, `5aaaf40`/`4a2b3ff` background/no-bg scene open zoom=1, `f722652` cover-zoom fills panel, `e94f143` fitWholeMapZoom on open, `9e6400c` MAP tab in sidebar. All await Xero's 2-client visual verify (L80 gate still open).

**Action:** Xero — 2-client eyeball on TacticalMap (the 6 new commits are all in the YELLOW area; the gate at `tasks/tactical-map-verify-2client-testplan-2026-05-27.md` remains open). Puffer Fish — drain HOPED-FOR, close L85, refresh Ledger. E2E — close PC-trade un-fixme todo.

---

## 2026-05-29 21:07 UTC

**Status:** DRIFT (continuing — 24th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [738 passed, 41 files — +20 since 23rd flag]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- HOPED-FOR still undrained (10+ days — 2026-05-19 batch; drain target was 2026-05-25 playtest, never actioned).
- Confidence Ledger in debug-handoff.md stale: says 622 tests/37 files (refreshed 2026-05-24) vs actual 738/41 — +116 tests, +4 files unrecorded.
- Stale-as-open todos (still `[ ]` but code shipped):
  - **NEW — L85:** "player viewport doesn't FOLLOW token MOVES" still `[ ]`, but fix shipped at L84 (`7ba065b` 2026-05-29, move-follow for active combatant + own PC). Hunt & Peck should close L85.
  - L81: E2E re-cert for fit-to-width render model — still `[ ]`, Playwright/E2E lane.
  - L88: initiative round number in feed — still `[ ]`, HP lane.
- L80: img_scale divergence code shipped 2026-05-27, awaiting Xero's 2-client visual eyeball — blocks TacticalMap YELLOW → GREEN.

**Action:** Puffer Fish — (1) refresh Confidence Ledger test count (622/37 → 738/41); (2) drain HOPED-FOR post-Minnie-S7; (3) close L85 in todo.md (fix shipped). HP closes L88. E2E closes L81. Xero eyeballs L80 (2 browsers).

---

## 2026-05-29 18:04 UTC

**Status:** DRIFT (continuing — 23rd flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [718 passed, 41 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- HOPED-FOR not drained (10+ days — 2026-05-19 batch; drain target was 2026-05-25 playtest, never actioned in Confidence Ledger).
- 4 stale-as-open todos (confirmed shipped in prior flags, still unchecked in todo.md):
  - L80: E2E tactical-map re-cert — commit `e055337` shipped it.
  - L84: initiative round label — `RollsFeed.tsx:520` renders `⚔️ Initiative (Round N)`.
  - L106: pin catch-up fix — `CampaignMap.tsx:952+999` has SUBSCRIBED handler + visibilitychange.
  - L136: 3-lane coordination — `operating-mode.md` three-lane section present.

**Action:** Same as 22nd: Puffer Fish close L80/L84/L106/L136 in todo.md; drain HOPED-FOR in Confidence Ledger. 23rd consecutive flag — unactioned.

---

## 2026-05-29 15:07 UTC

**Status:** DRIFT (continuing — 22nd flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [718 passed, 41 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- HOPED-FOR not drained (10+ days — 2026-05-19 batch; drain target was 2026-05-25 playtest, never actioned).
- 4 stale-as-open todos (confirmed shipped in 21st flag, still unchecked in todo.md):
  - L80: E2E tactical-map re-cert — commit `e055337` shipped it.
  - L84: initiative round label — `RollsFeed.tsx:520` renders `⚔️ Initiative (Round N)` — confirmed live this run.
  - L106: pin catch-up fix — `CampaignMap.tsx:952+999` has the handler — confirmed shipped.
  - L136: 3-lane coordination — `operating-mode.md` three-lane section present — confirmed live this run.

**Action:** Same as 21st: Puffer Fish close L80/L84/L106/L136 in todo.md; drain HOPED-FOR in Confidence Ledger. No new issues found.

---

## 2026-05-29 09:05 UTC

**Status:** DRIFT (continuing — 21st flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [718 passed, 41 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift:**
- HOPED-FOR not drained (10+ days — 2026-05-19 batch; vehicle popout broadcasts + combat-math/infection modal). Minnie S7 playtest (2026-05-26) confirmed in debug-handoff.md but Confidence Ledger never updated.
- 4 stale-as-open todos confirmed shipped (all `- [ ]` but code exists):
  - L80 E2E tactical-map re-cert: commit `e055337` "extend tactical-map-render for bg-locked/fit-to-width" — shipped.
  - L84 initiative round label: `RollsFeed.tsx:520` renders `⚔️ Initiative (Round N)` — shipped.
  - L106 pin catch-up fix: `CampaignMap.tsx:952+999` has SUBSCRIBED reload + visibilitychange handler (commit `4b48f00`) — shipped. (NEW — not in 20th flag.)
  - L136 3-lane coordination: `operating-mode.md` three-lane section present — shipped.

**Action:** Puffer Fish — (1) drain HOPED-FOR in debug-handoff.md Confidence Ledger post-Minnie-S7; (2) mark L80, L84, L106, L136 closed in todo.md. 21st consecutive flag.

---

## 2026-05-29 06:05 UTC

**Status:** DRIFT (continuing — 20th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [718 passed, 41 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Drift (3 stale todos; HOPED-FOR still not drained):**
- HOPED-FOR not drained (10 days — 2026-05-19 batch + re-arch vehicle/combat-math items). Minnie S7 playtest DID occur 2026-05-26 (confirmed in debug-handoff.md L10 "post-Minnie-S7 playtest" refresh). Confidence Ledger was NOT updated to drain HOPED-FOR → PLAYTESTED RECENTLY.
- Realtime channels: vehicle popout broadcasts (Section B) + combat-math/infection modal (A2/F) both ride the 2026-05-25 playtest; ledger entry still says "Promote to full GREEN after B confirms" with no confirmation recorded.
- 3 stale-as-open todos (all `- [ ]` but code already shipped):
  - L80 E2E tactical-map re-cert: commit `e055337` (2026-05-27) explicitly "extend tactical-map-render for bg-locked/fit-to-width model + re-cert" — shipped.
  - L84 initiative round label: `RollsFeed.tsx:520` already renders `⚔️ Initiative (Round N)` — shipped.
  - L136 3-lane coordination: `operating-mode.md` has the 3-lane section ("three always-on" + Playwright lane description) — shipped.

**Action:** Puffer Fish — drain HOPED-FOR post-Minnie-S7 in debug-handoff.md Confidence Ledger; mark L80, L84, L136 closed in todo.md. (20th flag — unactioned for 2+ days.)

---

## 2026-05-29 00:04 UTC

**Status:** DRIFT (continuing — 19th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [718 passed, 41 files — up from 707/40]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**Notable since 18th flag (21:04 UTC 2026-05-28):** ~10 commits — vehicle cargo features (encumbrance bar, damage logging, qty stepper), tactical-map fixes (scene-scope vehicle aboard, per-player Map toggle, cross-scene initiative tie, img_scale/zoom/lock-to-grid commits), docs (KS plan, handoff). TacticalMap YELLOW fix actively in-flight (b38cdf2 bg-locked-to-grid, 6d9d706 fit-to-panel-width, f4daeac zoom-reset on import); not yet 2-client-verified so YELLOW stays.

**Drift (unchanged from 18th flag):**
- HOPED-FOR not drained (10 days — 2026-05-19 batch + re-arch vehicle/combat-math items). Drain target was 2026-05-25 playtest; debug-handoff.md Confidence Ledger still lists them HOPED-FOR with no update.
- 2 stale-as-open todos remain `- [ ]` despite being shipped:
  - L84 initiative round label: `RollsFeed.tsx:476` already renders `(Round N)` — feature shipped.
  - L135 3-lane coordination: `lane-protocol.md` + `active-lanes.md` exist; `operating-mode.md` has the 3-lane section — shipped.

**Action:** Puffer Fish — same x19 (unactioned): (1) drain HOPED-FOR in debug-handoff.md Confidence Ledger; (2) mark L84 + L135 closed in todo.md.

---

## 2026-05-28 21:04 UTC

**Status:** DRIFT (continuing — 18th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [707 passed, 40 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 18:04 UTC:** 1 commit — `abe5e6f fix(vehicle): cargo remove button color (#3a3a3a invisible on dark bg)`. Tests unchanged.

**Drift (unchanged from 17th flag):**
- HOPED-FOR not drained (9 days — 2026-05-19 batch + re-arch vehicle/combat-math items). Drain target was 2026-05-25 playtest; debug-handoff ledger still lists them HOPED-FOR.
- 2 stale-as-open todos remain `- [ ]` despite being shipped:
  - L84 initiative round label: `RollsFeed.tsx:476` already renders `(Round N)` — feature shipped.
  - L135 3-lane coordination: `lane-protocol.md` + `active-lanes.md` exist; `operating-mode.md` already has the 3-lane section — shipped.

**Action:** Puffer Fish — same x18 (unactioned): (1) drain HOPED-FOR in debug-handoff.md; (2) mark L84 + L135 closed in todo.md.

---

## 2026-05-28 18:04 UTC

**Status:** DRIFT (continuing — 17th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [707 passed, 40 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 15:06 UTC:** 2 commits — todo.md reconciliation (NPC picker L85 + ping L86 + LOOT L99 marked `[x]`). Tests unchanged 707.

**Drift:**
- HOPED-FOR not drained (9 days — 2026-05-19 batch + re-arch vehicle/combat-math items). Drain target was 2026-05-25 playtest; debug-handoff ledger still lists them HOPED-FOR.
- 2 stale-as-open todos remain `- [ ]` despite being shipped:
  - L84 initiative round label: `RollsFeed.tsx:476` already renders `(Round N)` — feature shipped.
  - L135 3-lane coordination: `lane-protocol.md` + `active-lanes.md` exist; `operating-mode.md` already has the 3-lane section — shipped.

**Action:** Puffer Fish — (1) drain HOPED-FOR in debug-handoff.md; (2) mark L84 + L135 closed in todo.md.

---

## 2026-05-28 15:06 UTC

**Status:** DRIFT (continuing — 16th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [707 passed, 40 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 12:04 UTC:** 7 commits — tactical map fixes (vehicle aboard scene-scope, per-player Map toggle, cross-scene initiative chip, Map Setup above header, zoom reset, proportional grid cap, map-upload progress bar). Tests up 703→707 (+4 new).

**Drift:**
- HOPED-FOR not drained: 2026-05-19 batch (10 days old, drain target was 2026-05-25) + re-arch vehicle popout/combat-math items (>3 days past target). debug-handoff ledger still stale (shows 622/37, actual 707/40).
- 3 stale-as-open todos unchanged (confirmed shipped 13th pulse, still `- [ ]`): NPC picker L85 (InitiativeBar.tsx: npc_id+campaignNpcs match ships), initiative round label L84 (RollsFeed.tsx:476 ships), tactical ping L86 (TacticalMap.tsx count:3 + red/green/red ships).

**Action:** Same x16 (unactioned): Puffer Fish — drain HOPED-FOR + update ledger count in debug-handoff.md; mark 3 stale todos closed in todo.md.

---

## 2026-05-28 12:04 UTC

**Status:** DRIFT (continuing — 15th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [703 passed, 40 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 09:05 UTC:** 0 commits — no change since 14th pulse

**Drift:**
- HOPED-FOR not drained: 2026-05-19 batch (10 days old, drain target was 2026-05-25) + re-arch vehicle popout/combat-math items (>3 days past drain target). debug-handoff ledger stale: shows 622/37, actual 703/40.
- 3 stale-as-open todos unchanged: NPC picker (line 85), initiative round label (line 84), tactical ping (line 86) — all confirmed shipped in 13th pulse; still `- [ ]`.

**Action:** Same as 13th–14th (unactioned x15): Puffer Fish — drain HOPED-FOR + update ledger count in debug-handoff.md; mark 3 stale todo lines closed.

---

## 2026-05-28 09:05 UTC

**Status:** DRIFT (continuing — 14th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [703 passed, 40 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 06:05 UTC:** 0 commits — no change since 13th pulse

**Drift:**
- HOPED-FOR not drained: 2026-05-19 batch (10 days old, drain target was 2026-05-25) + re-arch vehicle popout/combat-math items (3 days past drain target). debug-handoff ledger stale: shows 622/37, actual 703/40.
- 3 stale-as-open todos unchanged: NPC picker (code ships npc_id+campaignNpcs filter, todo line 85 still `- [ ]`); initiative round label (RollsFeed.tsx:476, todo line 84 still `- [ ]`); tactical ping 3-pulse/red-green-red (TacticalMap.tsx, todo line 86 still `- [ ]`).

**Action:** Same as 13th (unactioned): Puffer Fish — drain HOPED-FOR + update ledger count in debug-handoff.md; mark 3 stale todo lines closed.

---

## 2026-05-28 06:05 UTC

**Status:** DRIFT (continuing — 13th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [703 passed, 40 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 00:04 UTC:** 8 commits (per-player Map toggle reliable fix, cross-scene initiative chip removed, Map Setup above header, zoom reset on scene open, proportional grid cap, E2E re-cert for fit-to-width model)

**Drift:**
- HOPED-FOR still not drained: 2026-05-19 batch (10 days old) + re-arch vehicle/combat items (4 days past 2026-05-25 drain target). debug-handoff ledger count still stale (shows 622/37; actual 703/40).
- 3 stale-as-open todos now confirmed SHIPPED: NPC picker (prior cycles), initiative round label (`RollsFeed.tsx:476` + table-page 3 insert sites confirmed in code — all write `round:N`), tactical ping (count:3 + `#ff3a1d/#39ff14/#ff3a1d` confirmed in TacticalMap.tsx L788/3025).

**Action:** Puffer Fish (13 cycles overdue): drain HOPED-FOR + update ledger test count in debug-handoff.md; close 3 stale todo lines (NPC picker + round label + tactical ping).

---

## 2026-05-28 00:04 UTC

**Status:** DRIFT (continuing — 12th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [701 passed, 40 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 21:04 UTC:** 7 commits (tactical map-upload progress bar, Map Setup floating panel, fit-to-panel-width + local zoom, E2E dashboard)

**Drift:**
- HOPED-FOR still not drained: 2026-05-19 batch (9+ days) + re-arch vehicle/combat items (3 days past 2026-05-25 drain target). Ledger also stale: debug-handoff shows 622/37; actual 701/40 (+79 tests, +3 files).
- NPC picker SHIPPED (`components/InitiativeBar.tsx` now filters `campaignNpcs`, sets `npc_id`) but todo line 84 still `- [ ]` — stale-as-open (audit-correction needed).
- 2 genuinely-open stale todos: initiative round label (`RollsFeed.tsx:476` + table-page 3 insert sites) + tactical ping 3-pulse/red-green-red (`TacticalMap.tsx` count:2->3).

**Action:** Puffer Fish (12 cycles overdue): drain HOPED-FOR in debug-handoff.md; run `node scripts/refresh-ledger.mjs` to update 622/37 -> 701/40; close NPC picker todo line 84.

---

## 2026-05-27 21:04 UTC

**Status:** DRIFT (continuing — 11th flag)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [697 passed, 40 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 18:04 UTC:** bg-to-grid lock shipped (`b38cdf2`), NPC picker shipped (`13854c4`)

**Drift:**
- HOPED-FOR still not drained: 2026-05-19 batch (9 days old) + re-arch vehicle/combat items (3 days past 2026-05-25 ride). Ledger test count stale: shows 622/37, actual 697/40.
- NPC picker (`13854c4` feat(initiative)) SHIPPED but todo still `- [ ]` — stale-as-open (audit-correction needed)
- 2 genuinely-open stale todos remain: initiative round label (`RollsFeed.tsx:476` + table-page 3 insert sites) + tactical ping color/3-pulse (`TacticalMap.tsx` count:2->3, red/green/red)

**Action:** Puffer Fish (11 cycles overdue): drain HOPED-FOR in debug-handoff.md; update ledger test count to 697/40; close NPC picker todo.

---

## 2026-05-27 18:04 UTC

**Status:** DRIFT (continuing — 10th flag; 1 new stale todo; previous 3 still open)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [693 passed, 40 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 15:04 UTC:** 19 commits (initiative NPC picker, loot feed, auth fixes, docs)

**Drift:**
- HOPED-FOR (2026-05-19 batch + re-arch vehicle/combat items): Confidence Ledger still not drained post-2026-05-25 + 2026-05-26 playtests (10 cycles; >8 days since batch shipped)
- 4 stale `- [ ]` todos: img_scale (prev. L66), initiative round (`f10d0ff`), tactical ping (`02d7389`), **+NPC picker (`13854c4`) NEW this cycle**
- Ledger test count stale: debug-handoff shows 622/37; actual 693/40 (+71 tests, +3 files)

**Action:** Puffer Fish (10 cycles overdue): drain HOPED-FOR in debug-handoff.md after 2026-05-26 playtest; close 4 shipped todos; update ledger test count.

---

## 2026-05-27 15:04 UTC

**Status:** DRIFT (continuing — 9th flag; same 3 items; 0 commits since 12:07 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [685 passed, 40 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 12:07 UTC:** 0 commits

**Drift (unchanged — Puffer Fish action still pending, now 9 cycles):**
- HOPED-FOR (2026-05-19 batch + re-arch vehicle/combat items): Confidence Ledger not drained post-2026-05-25 + 2026-05-26 playtests (9 days since batch shipped)
- 3 stale `- [ ]` todos still open despite shipping 2026-05-25: L66 img_scale (`6ef34ce`), L67 initiative round (`f10d0ff`), L69 tactical ping (`02d7389`)
- Ledger test count stale: debug-handoff shows 622/37; actual 685/40 (+63 tests, +3 files)

**Action:** Puffer Fish (9 cycles overdue): (1) drain HOPED-FOR in debug-handoff.md; (2) mark the 3 stale todos complete; (3) run `node scripts/refresh-ledger.mjs`.

---

## 2026-05-27 12:07 UTC

**Status:** DRIFT (continuing — 8th flag; same 3 items; 0 commits since 09:05 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [685 passed, 40 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 09:05 UTC:** 0 commits

**Drift (unchanged — Puffer Fish action still pending, now 8 cycles):**
- HOPED-FOR (2026-05-19 batch + re-arch vehicle/combat items): Confidence Ledger not drained post-2026-05-25 + 2026-05-26 playtests (8 days since batch shipped)
- 3 stale `- [ ]` todos still open despite shipping 2026-05-25: L66 img_scale (`6ef34ce`), L67 initiative round (`f10d0ff`), L69 tactical ping (`02d7389`)
- Ledger test count stale: debug-handoff shows 622/37; actual 685/40 (+63 tests, +3 files)

**Action:** Puffer Fish (8 cycles overdue): (1) drain HOPED-FOR in debug-handoff.md; (2) mark the 3 stale todos complete; (3) run `node scripts/refresh-ledger.mjs`.

---

## 2026-05-27 09:05 UTC

**Status:** DRIFT (continuing — 7th flag; same 3 items; no new commits since 06:04 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [685 passed, 40 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 06:04 UTC:** 0 commits

**Drift (unchanged — Puffer Fish action still pending, now 7 cycles):**
- HOPED-FOR (2026-05-19 batch + re-arch vehicle/combat items): `debug-handoff.md` Confidence Ledger not drained post-2026-05-25 + 2026-05-26 playtests (8 days since batch shipped)
- 3 stale `- [ ]` todos still open despite shipping 2026-05-25: L66 img_scale (`6ef34ce`), L67 initiative round (`f10d0ff`), L69 tactical ping (`02d7389`)
- Ledger test count stale: debug-handoff shows 622/37; actual 685/40 (+63 tests, +3 files)

**Action:** Puffer Fish (overdue — 7 cycles): (1) drain HOPED-FOR in debug-handoff.md; (2) mark the 3 stale todos complete; (3) run `node scripts/refresh-ledger.mjs`.

---

## 2026-05-27 06:04 UTC

**Status:** DRIFT (continuing — 6th flag; same 3 items unresolved; 3 todos now confirmed shipped)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [685 passed, 40 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 00:04 UTC (2 commits):**
- `d60e407` docs(beta-500): align internal target date to 2026-07-01 (not a drift item)
- `cf9a0ed` docs(roadmap): set milestone target dates (not a drift item)

**Drift (unchanged — 6th consecutive cycle flagging the same items):**
- HOPED-FOR (2026-05-19 batch + re-arch vehicle/combat items): `debug-handoff.md` Confidence Ledger not drained post-playtest despite 2026-05-25 AND 2026-05-26 playtests both having run (8 days since batch shipped)
- 3 stale `- [ ]` todos confirmed shipped — all committed 2026-05-25, still open in todo.md:
  - Tactical ping red/green/red (`02d7389 feat(tactical): match the campaign-map ping`)
  - Initiative round number in header (`f10d0ff feat(initiative): show the round number`)
  - img_scale shared authoritative (`6ef34ce fix(tactical): make background img_scale shared`)
- Ledger test count stale: debug-handoff shows 622/37 files; actual 685/40 files (+63 tests, +3 files)

**Action:** Puffer Fish (overdue — 6 cycles): (1) drain HOPED-FOR in debug-handoff.md using the 2026-05-25 + 2026-05-26 playtest evidence; (2) mark the 3 stale todos complete; (3) run `node scripts/refresh-ledger.mjs` to sync test count.

---

## 2026-05-27 00:04 UTC

**Status:** DRIFT (continuing — 5th flag; same 3 items unresolved since 2026-05-26 06:07 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [685 passed, 40 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 21:05 UTC (2 commits):**
- `c3858d9` fix(map): coordinate-paste search + no-result feedback (not a drift item)
- `2c869dc` docs(roadmap): road-to-1.0.md added (not a drift item)

**Drift (unchanged — Puffer Fish action still pending, now 5 cycles):**
- HOPED-FOR (2026-05-19 batch + re-arch vehicle/combat items): debug-handoff.md not drained post-2026-05-26 playtest (2 days since playtest)
- 3 stale `- [ ]` todos (all shipped): L67 initiative round (f10d0ff), L69 tactical ping (02d7389), L65/66 img_scale (6ef34ce)
- Ledger test count stale: debug-handoff shows 622/37; actual 685/40 (+63 tests, +3 files — unchanged since 21:05)

**Action:** Puffer Fish — same as prior 4 entries: (1) drain HOPED-FOR in debug-handoff post-playtest; (2) check off 3 stale todos; (3) run `node scripts/refresh-ledger.mjs`.

---

## 2026-05-26 21:05 UTC

**Status:** DRIFT (continuing — 4th flag; same items unresolved since 00:07 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [685 passed, 40 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 18:05 UTC (2 commits):**
- `c3858d9` fix(map): coordinate-paste search + no-result feedback (not a drift item)
- `2c869dc` docs(roadmap): road-to-1.0.md added (not a drift item)

**Drift (unchanged — Puffer Fish action still pending):**
- HOPED-FOR (2026-05-19 batch + re-arch vehicle/combat items): debug-handoff.md not drained post-2026-05-26 playtest
- 3 stale `- [ ]` todos (all shipped): L67 initiative round (f10d0ff), L69 tactical ping (02d7389), L66 img_scale (6ef34ce)
- Ledger test count stale: debug-handoff shows 622/37; actual 685/40 (+63 tests, +3 files — gap grew +10 since 18:05)

**Action:** Puffer Fish — (1) drain HOPED-FOR in debug-handoff post-playtest; (2) close 3 stale todos; (3) run `node scripts/refresh-ledger.mjs` to update ledger count.

---

## 2026-05-26 18:05 UTC

**Status:** DRIFT (continuing from 06:07 — no new gate failures; drift unresolved)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [675 passed, 39 files]

**Audit:** npm audit [clean — 0 high/critical]

**CI:** gh not available in sandbox — skipped

**New since 06:07 UTC (2 commits):**
- `d6ad118` weekly security audit committed (`tasks/security-audit.md`) — findings are all moderate/advisory; top action: `app/scene-controls-popout/page.tsx:316` upload missing `prepareUpload` guard (GM-only page, bounded exposure)
- `57442c5` todo: post-1.0 platform-migration pointer added (not a live issue)

**Drift (unchanged from 06:07 — no action yet):**
- HOPED-FOR (2026-05-19 batch + re-arch vehicle/combat items): debug-handoff.md not drained post-2026-05-26 playtest
- 3 stale `- [ ]` todos: initiative round (f10d0ff), tactical ping (02d7389), img_scale (6ef34ce) — all shipped
- Confidence Ledger: shows 622/37; actual 675/39 (+53 tests); `scripts/refresh-ledger.mjs` unrun

**Action:** Puffer Fish — action items same as 06:07 entry; security audit adds: wire `prepareUpload` on `scene-controls-popout` upload (`app/scene-controls-popout/page.tsx:316`) + register `tactical-maps` in `lib/safe-upload.ts`.

---

## 2026-05-26 06:07 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [675 passed, 39 files]

**Audit:** npm audit [clean]

**CI:** gh not available in sandbox — skipped

**New since 00:07 UTC (25 commits):** P0 img_scale fix shipped (`6ef34ce` — shared authoritative bg + scale-sentinel DB migration applied live); tactical ping 3-pulse (`02d7389`); initiative Round N feed (`f10d0ff`); session roll-log archive rich view (`31e7e58`); roll-feed no-roll combat actions (`0c41e9a`); realtime broadcast investigation done (pins = fire-and-forget gap, fix routed to HP); 12 playtest-triage docs commits.

**Drift:**
- **HOPED-FOR (2026-05-19 batch, now 7 days):** drain target was 2026-05-25/26 playtest; playtest happened but debug-handoff.md not updated — Puffer to drain or hold with explicit reason
- **HOPED-FOR (2026-05-24 re-arch):** vehicle popout broadcasts (Section B) + combat-math/infection modal (A2/F) — same drain gate; still listed HOPED-FOR
- **3 stale-as-open todos (shipped, still `- [ ]`):**
  - L64: Initiative (Round N) → `f10d0ff` 2026-05-25
  - L66: Tactical ping red/green/red → `02d7389` 2026-05-25
  - L62+63: img_scale divergence + center-race → `6ef34ce` 2026-05-26 (both items addressed)
- **Ledger test count stale:** debug-handoff shows 622/37; actual 675/39 (+53 tests, +2 files); `scripts/refresh-ledger.mjs` still unrun

**Action:** Puffer Fish — (1) drain 2026-05-26 playtest in debug-handoff HOPED-FOR; (2) mark 3 stale todos shipped (L64/66/62-63); (3) run `node scripts/refresh-ledger.mjs`; (4) P0 img_scale fix needs Hunt & Peck browser eyeball before calling closed.

---

## 2026-05-26 00:07 UTC

**Status:** DRIFT (continuing — no new commits since 21:09; new stale-todo findings)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [669 passed, 40 files]

**Audit:** npm audit [clean]

**CI:** gh not available in sandbox — skipped

**Drift:**
- **HOPED-FOR (2026-05-19 batch, 7 days old):** Tier-2 Recruit, Advantages, FI streamline, Vehicle Q4-c/d, narrative polish — drain gate was 2026-05-25 playtest; debug-handoff not updated post-playtest
- **HOPED-FOR (2026-05-24):** vehicle popout broadcasts (Section B) + combat-math/infection modal (A2/F) — same drain gate
- **NEW stale-todo:** `rewire onGiveItem` + `un-fixme PC-trade assertion` (todo.md ~L16-17) still `- [ ]`; debug-handoff "characters cross-user writes" marks all 8 flows **GREEN** (e866d0 shipped RPC + pc-trade test un-fixme'd and green). Prior pulses called this "partial" but it's now fully closed.
- **Ledger stale:** debug-handoff shows 622/37; actual 669/40 (47-test gap); `scripts/refresh-ledger.mjs` still unrun

**Action:** Puffer Fish — (1) confirm/drain 2026-05-25 playtest outcome in debug-handoff; (2) close 2 stale todo items (~L16-17); (3) run `node scripts/refresh-ledger.mjs`.

---

## 2026-05-25 21:09 UTC

**Status:** DRIFT (continuing — HOPED-FOR still unconfirmed post-playtest)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [669 passed, 40 files — +11 since 18:11]

**Audit:** npm audit [clean]

**CI:** gh not available in sandbox — skipped

**New since 18:11 (13 commits):**
- `fix(table)`: archive PC token on Map-toggle-off (was hard-delete — behaviour fix)
- `feat(table)`: streamline session header titlebar
- `fix(tactical)`: fog toolbar reposition (center default) + wrap expanded row
- `fix(tactical)`: scroll viewport to newly-placed tokens; space auto-placed tokens 2 cells apart; re-assert grid coverage on dim revert
- `fix(table)`: jump to tactical map on player Map-add; session title single-line header
- `feat(stories)`: Story Page button on Live Now cards

**Drift (continuing):**
- **HOPED-FOR (2026-05-19 batch, 6 days old):** Tier-2 Recruit, Advantages, FI streamline, Vehicle Q4-c/d, narrative polish — drain gate was today's playtest; not confirmed
- **HOPED-FOR (2026-05-24):** vehicle popout broadcasts (Section B) + combat-math/infection modal (A2/F) — same gate
- **Stale-as-open todo:** "COORDINATION - formalize 3-lane model" still `- [ ]`; all three artefacts (`operating-mode.md`, `lane-protocol.md`, `active-lanes.md`) already exist and reflect the 3-lane split

**Action:** Confirm playtest outcome → drain HOPED-FOR entries; tick the 3-lane coordination todo; run `node scripts/refresh-ledger.mjs` (ledger shows 658, actual 669).

---

## 2026-05-25 18:11 UTC

**Status:** DRIFT — active ship batch landed; HOPED-FOR still awaiting playtest

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [658 passed, 40 files — up from 643/38]

**Audit:** npm audit [clean]

**CI:** gh not available in sandbox — skipped

**New since 15:06 (11 commits):**
- `fix(inventory)`: PC->PC trade via `give_item_to_character` RPC — first of the 8 RLS-write flows from #2 BLOCKER; partial progress
- `feat(table)`: Tactical Map header scene-picker dropdown — removes the stated blocker on blank-map-default todo
- `fix(table)`: GM-only Advantages (star) tab removed
- Tactical map batch: grid auto-grow, token spawn spread, Map toggle guard, Scene Name fast-typing fix, New Map double-fire guard

**Drift (continuing):**
- **HOPED-FOR (2026-05-19 batch, 6 days old):** Tier-2 Recruit, Advantages, FI streamline, Vehicle Q4-c/d, narrative polish — drain gate = 2026-05-25 playtest, not confirmed yet
- **HOPED-FOR (2026-05-24):** vehicle popout broadcasts (Section B) + combat-math/infection modal (A2/F) — same playtest gate
- **Ledger stale:** debug-handoff.md says 622/37; actual 658/40 — 36-test drift, `scripts/refresh-ledger.mjs` still unrun
- **Stale-as-open todo:** "COORDINATION - formalize 3-lane model" still `- [ ]`; `operating-mode.md` + `lane-protocol.md` + `active-lanes.md` all exist

**Action:** After today's playtest, drain HOPED-FOR + tick 3-lane todo + run `node scripts/refresh-ledger.mjs`. Also verify #2 BLOCKER RLS-write status (7 of 8 flows still unpatched).

---

## 2026-05-25 15:06 UTC

**Status:** DRIFT (same as 12:11 — no commits since, nothing resolved)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [643 passed, 38 files]

**Audit:** npm audit [clean]

**CI:** gh not available in sandbox — skipped

**Drift (continuing):**
- **HOPED-FOR (2026-05-19 batch, 7 days old):** Tier-2 Recruit, Advantages, FI streamline, Vehicle Q4-c/d, narrative polish. Drain target was 2026-05-25 playtest — not confirmed yet.
- **HOPED-FOR (2026-05-24):** vehicle popout broadcasts (Section B) + combat-math/infection modal (A2/F). Same drain gate.
- **Stale-as-open todo:** "COORDINATION - formalize 3-lane model" still `- [ ]`; already shipped (`operating-mode.md` + `lane-protocol.md` + `active-lanes.md` all exist).

**Action:** After today's playtest, drain HOPED-FOR + tick the 3-lane todo. Run `node scripts/refresh-ledger.mjs` if that script exists.

---

## 2026-05-25 12:11 UTC

**Status:** DRIFT (same as 09:12 — no commits since, nothing resolved)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [643 passed, 38 files]

**Audit:** npm audit [clean]

**CI:** gh not available in sandbox — skipped

**Drift (continuing from 09:12):**
- **Ledger stale:** 622/37 in `debug-handoff.md` vs 643/38 actual. `scripts/refresh-ledger.mjs` still unrun.
- **HOPED-FOR (2026-05-19 batch, 7 days old):** Tier-2 Recruit, Advantages, FI streamline, Vehicle Q4-c/d, narrative polish. Drain gate = 2026-05-25 playtest (today, ~6am Denver now — not yet confirmed).
- **HOPED-FOR (2026-05-24):** vehicle popout broadcasts (Section B) + combat-math/infection modal (A2/F). Same drain gate.
- **Stale-as-open todo:** "COORDINATION - formalize 3-lane model" still `- [ ]`; `operating-mode.md` + `lane-protocol.md` + `active-lanes.md` all exist — shipped.

**Action:** Same as 09:12. After today's playtest, drain HOPED-FOR + refresh ledger + tick the 3-lane todo.

---

## 2026-05-25 09:12 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [643 passed, 38 files]

**Audit:** npm audit [clean]

**CI:** gh not available in sandbox — skipped

**Drift:**
- **Ledger stale (7th flag): 622/37 → 643/38** (+21 tests, +1 file since last refresh 2026-05-24). `scripts/refresh-ledger.mjs` still unrun.
- **HOPED-FOR (2026-05-19 batch, 6 days old)** — Tier-2 Recruit, Advantages, FI streamline, Vehicle Q4-c/d, narrative polish. Drain gate = 2026-05-25 playtest (today; not yet happened at 09 UTC / 3am Denver). Post-playtest: move to PLAYTESTED or flag regressions.
- **HOPED-FOR (2026-05-24)** — vehicle popout broadcasts (Section B) + combat-math/infection modal (A2/F). Same drain gate.
- **Stale-as-open todo: "COORDINATION - formalize 3-lane model."** Already shipped (`operating-mode.md` 3-lane rewrite, commit `6660e49`). The `- [ ]` in CURRENT OPEN still needs to be ticked.

**Action:** (1) Run `node scripts/refresh-ledger.mjs`. (2) After today's playtest, drain HOPED-FOR. (3) Tick the 3-lane COORDINATION todo.

---

## 2026-05-25 00:14 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [639 passed, 38 files]

**Audit:** npm audit [clean]

**CI:** gh not available in sandbox — skipped

**Drift:**
- **Ledger stale (6th flag): 622/37 → 639/38 (+17 tests, +1 file).** New file: `vehicle-checks.test.ts` (17 tests, `f1a97b4` feat(vehicle) install/gather). `scripts/refresh-ledger.mjs` still unrun across 6 pulses.
- **HOPED-FOR (2026-05-19 batch) drain gate is TODAY.** 6-day-old batch (Tier-2 Recruit, Advantages, FI streamline, Vehicle Q4-c/d, narrative polish, etc.) targeting the 2026-05-25 playtest. Runsheet: `tasks/session-prep-2026-05-25.md`. Post-playtest: move items to PLAYTESTED or flag regressions.
- **Stale-as-open todo: "COORDINATION - formalize 3-lane model."** Already applied — `operating-mode.md` was rewritten to THREE lanes in commit `6660e49` (2026-05-24). The `- [ ]` in CURRENT OPEN can be ticked/removed.

**Action:** (1) Run `node scripts/refresh-ledger.mjs` — clears the 6th ledger stale flag. (2) After today's playtest, drain HOPED-FOR items. (3) Tick/remove the 3-lane COORDINATION todo.

---

## 2026-05-24 21:08 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [622 passed, 37 files]

**Audit:** npm audit [clean]

**CI:** gh not available in sandbox — skipped

**Drift:**
- **Ledger stale (5th flag): 532/29 → 622/37 (+90 tests, +8 files since ledger was last written).** `tasks/debug-handoff.md` line 113 still reads "532 unit tests across 29 files." Gap grew again (+47 since 18:05 UTC — `bc48fbe feat(conditions)` added conditions.test.ts). `scripts/refresh-ledger.mjs` exists; unrun.
- **HOPED-FOR (2026-05-19 batch) day 5.** 50-commit batch: Tier-2 Recruit, Vehicles Q4-c/d, Advantages, FI streamline, narrative polish, etc. Drain target: 2026-05-25 playtest (tomorrow). `tasks/session-prep-2026-05-25.md` is the runsheet.

**Action:** `node scripts/refresh-ledger.mjs` — clears the ledger stale. HOPED-FOR drains at tomorrow's playtest.

---

## 2026-05-24 18:05 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [575 passed]

**Audit:** npm audit [clean]

**CI:** gh not authenticated — skipped

**Drift:**
- **Ledger stale (4th flag): 532 → 575 (+43, 29 → 32 test files).** `tasks/debug-handoff.md` Confidence Ledger TESTED row still reads "532 unit tests across 29 files." Run `npx tsx scripts/refresh-ledger.mjs` to sync.
- **HOPED-FOR batch day 6** (2026-05-19 post-playtest ships). Drain target: 2026-05-25 playtest (tomorrow). `tasks/session-prep-2026-05-25.md` exists; `tasks/pre-playtest-smoke-2026-05-25.md` still missing (but session-prep may cover it).

**Action:** Run `npx tsx scripts/refresh-ledger.mjs` to clear the ledger drift; HOPED-FOR drains at tomorrow's playtest.

---

## 2026-05-24 15:06 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [561 passed, 31 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **Confidence Ledger TESTED stale (4th flag):** ledger says 532/29, live is 561/31 (+29 tests, +2 files). Delta GREW +7 since last pulse (community-stage.test.ts, 7 tests, Phase 2 recruit ship `8406dd7`). Run `node scripts/refresh-ledger.mjs`.
- **`pre-playtest-smoke-2026-05-25.md` RESOLVED:** file was never created under that name, but `tasks/session-prep-2026-05-25.md` IS the playtest prep doc (exists, covers all HOPED-FOR areas). Prior 3-pulse "missing" alert was a filename mismatch. No action needed.
- **HOPED-FOR (2026-05-19 batch) day 5.** Drain gate = today's playtest. `tasks/session-prep-2026-05-25.md` is the runsheet.

**Action:** `node scripts/refresh-ledger.mjs` - only unfixed drift item. Playtest prep doc exists; run the session.

---

## 2026-05-24 12:09 UTC

**Status:** DRIFT (3rd consecutive flag — no new commits since 09:06 UTC)

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [554 passed, 30 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox — skipped

**Drift:**
- **Confidence Ledger TESTED stale (3rd flag):** ledger says 532/29, live is 554/30 (+22 tests, +1 file). `node scripts/refresh-ledger.mjs` is a 5-second fix; still unrun.
- **`tasks/pre-playtest-smoke-2026-05-25.md` missing (3rd flag).** Playtest is tomorrow. Doc needed before session start; no progress since 00:11 UTC alert.
- **HOPED-FOR (2026-05-19 batch) day 5.** Drain gate = tomorrow's Phase 7 2-client acceptance (`tasks/phase7-acceptance-2client-testplan.md`). On track if playtest runs as planned.

**Action:** Pre-playtest doc is now the most time-sensitive item — playtest is <24 hours away. Then `node scripts/refresh-ledger.mjs`.

---

## 2026-05-24 09:06 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [554 passed, 30 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **Confidence Ledger TESTED still stale (2nd flag):** ledger 532/29, live 554/30 (+22 tests, +1 file — `tests/lib/weapons.test.ts` added + `table-roll-context` 22→38). Flagged in the 00:11 pulse; not yet drained. Run `node scripts/refresh-ledger.mjs`.
- **`tasks/pre-playtest-smoke-2026-05-25.md` still missing (2nd flag).** Flagged at 00:11 UTC; still absent. Playtest is tomorrow — plan doc needed before session start.
- **HOPED-FOR (2026-05-19 batch) day 5, drain window closes tomorrow.** Realtime channels at YELLOW; only TacticalMap token-move + combat-start + presence 2-client-verified. Phase 7 2-client acceptance sheet (`tasks/phase7-acceptance-2client-testplan.md`) is the gate.

**Action:** (1) `node scripts/refresh-ledger.mjs` — 5-second fix, unblocks drift detector. (2) Create `tasks/pre-playtest-smoke-2026-05-25.md` before tomorrow. (3) Run Phase 7 sheet during playtest to close Realtime YELLOW.

---

## 2026-05-24 00:11 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [548 passed, 29 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **Confidence Ledger TESTED count stale:** ledger 532/29, live 548/29 (+16). `table-roll-context` jumped 22→38 in 3c-B2 + 3c-A commits. Run `node scripts/refresh-ledger.mjs`.
- **HOPED-FOR (2026-05-19 batch) day 5** - drain target 2026-05-25 (tomorrow). `tasks/pre-playtest-smoke-2026-05-25.md` does not exist yet; needed before playtest.
- **page.tsx decomposition in progress:** 13,192 → 10,552 lines (~20% done). Phase 3c-B shipped (executeRoll→useRollResolution). Phase 3d shipped (realtime channels). Phase 4 locked. Phase 5 (moderation extraction) in progress per handoff.

**Action:** (1) Create `tasks/pre-playtest-smoke-2026-05-25.md` before tomorrow's session. (2) Run `node scripts/refresh-ledger.mjs` to sync ledger to 548/29.

---

## 2026-05-23 21:11 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [532 passed, 29 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **Confidence Ledger TESTED count stale (7th alert):** ledger 502/26 files; live is 532/29. Delta GROWING: +22 at alert 1, now +30. 8 new tests added since the 18:05 pulse (table-roll-context +8 + tactical-view +8 = net 8 new vs last run). Run `node scripts/refresh-ledger.mjs`.
- **HOPED-FOR (2026-05-19 batch) day 4** - drain target 2026-05-25 (2 days). On track; no action needed before playtest.

**Action:** run `node scripts/refresh-ledger.mjs` - delta growing and 2026-05-25 playtest is 2 days out; stale TESTED count will make the post-playtest ledger update harder.

---

## 2026-05-23 18:05 UTC

**Status:** DRIFT

**Gates:** font-sizes [OK], role-literals [OK], tsc [OK], tests [524 passed, 29 files]

**Audit:** clean (0 high, 0 critical)

**CI:** gh not available in sandbox - skipped

**Drift:**
- **Confidence Ledger TESTED count stale (6th alert):** ledger still 502/26 files; live is 524/29. Unfixed across 6 consecutive pulses (~21h). Run `node scripts/refresh-ledger.mjs`.
- **HOPED-FOR (2026-05-19 batch) day 4** - drain target 2026-05-25 (2 days). On track; no action needed before playtest.

**Action:** `node scripts/refresh-ledger.mjs` - 6 consecutive pulses unfixed; escalating signal.

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
