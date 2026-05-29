# Health Pulse

Autonomous status checks every 3 hours (00:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 UTC). Newest first. Silent runs (all-green, no drift) are NOT logged here - absence = healthy.

When you see a new entry: open it, take the action listed, then leave the entry in place as a historical record.

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
