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
- **focus:** (1) applying the 3-lane operating-mode update; (2) triaging the map_pins moderation-bypass finding into the Risk Register + writing the fix SQL (apply gated on Xero). Background: Stage B #5 phase-1 shipped; #5 phase-2 routing pending the manual conditions smoke.
- **touching:** `tasks/operating-mode.md`, `tasks/debug-handoff.md`, `tasks/active-lanes.md`, `tasks/todo.md` (Puffer section), `sql/` (new map_pins trigger file). NO `app/` / `components/` / `lib/` / `e2e/` edits.
- **updated:** 2026-05-24, HEAD 0b440e2.

## Playwright / E2E
- **focus:** Full-suite build, Phase 1 (4/7 green: story-lifecycle, rules-deeplinks, campfire-social, world-pin-to-queue). Next: presence, account-settings. messages-dm parked on Xero's teardown call.
- **touching:** `e2e/` (additive specs), `tasks/beginners-guide-testplan.md`, `tasks/e2e-results-2026-05-24.html`.
- **updated:** 2026-05-24, working from HEAD 4f9b3aa.
