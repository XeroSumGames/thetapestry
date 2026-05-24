# Active Lanes - live status board

Each of the three chats updates ITS OWN row at the START and END of a work batch
so the other two can steer clear of the same area (the substrate can't otherwise
show in-flight focus). Keep it to a few lines per lane. Convention + ownership:
[tasks/lane-protocol.md](lane-protocol.md).

Format per lane: **focus** (what right now) / **touching** (files/area) /
**updated** (timestamp + HEAD you're working from).

---

## Hunt & Peck
- **focus:** Shipped this batch: recruit-group P2/P3, Y11-b/c, advantages-into-Notes, icon-only status chips, DB em-dash fix + live-DB em-dash guardrail, roll_log session-archive RLA1/RLA2 + summary-embedded log, Minnie damage table, distract-feed reword, route-pin alt-click fix, pin-reveal live-sync fix. NEXT: vehicle install/gather skill-checks (rulings locked: Dire install = 1 tank; Wild gather = +2).
- **touching:** `app/vehicle/page.tsx`, `lib/fuel-storage.ts`, `components/RollModal.tsx` (vehicle checks next); intermittently `app/stories/[id]/table/page.tsx`, `components/CampaignMap.tsx` / `CampaignPins.tsx`.
- **updated:** 2026-05-24, HEAD 0b440e2 (rebases on push).

## Puffer Fish
- **focus:** Session 2026-05-24 (lane/puffer @ 932fb73). Re-verified against the LIVE DB that the map_pins moderation fix is STILL UNAPPLIED (live `map_pins` has only `on_new_pin` + `on_pin_approved`; the enforce trigger is absent) - gap open, fix file ready, ONE command owed to Xero's go: `npx supabase db query --linked -f sql/map-pins-moderation-enforce-2026-05-24.sql`. Refreshed the stale Confidence Ledger (debug-handoff Sec 3: 532/29 -> 622/37). Now IDLE / available. Carried (gated, not active): #5 phase-2 conditions routing (needs the manual conditions smoke + an isolated worktree; table page is Hunt&Peck's hot file); #7 lasting-wounds migration (held); Stage C build (gated on Phase 7).
- **touching:** `tasks/debug-handoff.md` (Confidence Ledger line), `tasks/active-lanes.md`. NO `app/` / `components/` / `lib/` / `e2e/` edits.
- **updated:** 2026-05-24, lane/puffer @ 932fb73 (commits push to main; rebases on non-ff).

## Playwright / E2E
- **focus:** BATCH DONE. Phase 1 #5 `presence.spec.ts` (Ch1.3) + #6 `account-settings.spec.ts` (Sys P) shipped GREEN. Full re-cert: 113 passed + 1 flaky (section-c retry, known watch item) = 4 setup + 18 functional + 92 sweep. Phase 1 now 6/7; only messages-dm left (BLOCKED on Xero's teardown call). Next session: Phase 2 (char-create methods, sessions, combat flow, NPC CRUD, communities, inventory/trade, rumors publish->clone).
- **touching:** nothing live now (committing). New: `e2e/presence.spec.ts`, `e2e/account-settings.spec.ts`; helper `e2e/_teardown.ts` (+`userIdFromToken`); docs `tasks/todo.md` / `beginners-guide-testplan.md` / `e2e-results-2026-05-24.html` / `lessons.md`.
- **updated:** 2026-05-24, committed on top of HEAD 6660e49 (rebases on push).
