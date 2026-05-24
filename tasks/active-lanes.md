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
- **focus:** Session 2026-05-24 DONE. (1) **map_pins moderation bypass CLOSED on prod** - trigger applied + verified (non-Thriver gm/approved -> forced rumor/pending); Risk Register RED -> GREEN, finding RESOLVED, regression routed to E2E. (2) **`audit_log` table (Phase AL1) confirmed LIVE** - applied `sql/audit-log-table-2026-05-20.sql` (Xero "apply it"; idempotent) + verified (table + RLS + 2 policies + 5 indexes). Reconciled doc drift: handoff listed it owed, todo said done - now both say DONE/verified. (3) Refreshed stale Confidence Ledger (532/29 -> 622/37). Now IDLE / available. Carried (gated): #5 phase-2 conditions routing (manual smoke + isolated worktree); #7 lasting-wounds migration (held); Stage C build (Phase 7); `audit_log` AL2+ recovery triggers (future); next schema-baseline refresh should include audit_log.
- **touching:** `tasks/debug-handoff.md`, `tasks/handoff.md`, `tasks/security-finding-map-pins-moderation-2026-05-24.md`, `tasks/todo.md` (own section), `tasks/active-lanes.md`. Live DB: applied map_pins trigger + audit_log table (both Xero-authorized). NO `app/` / `components/` / `lib/` / `e2e/` edits.
- **updated:** 2026-05-24, lane/puffer (commits push to main; rebases on non-ff).

## Playwright / E2E
- **focus:** Phase 2 IN PROGRESS (2 of 7 shipped). #8 `char-create-methods` (Ch4.2-4.4) on main + FULL-SUITE VERIFIED (re-cert: 115 passed + 2 known-flaky-passed-on-retry, no cross-file interference). #9 `session-lifecycle` (Ch7.1 partial/7.3) green standalone (committing now) - runs in its OWN throwaway campaign (Start Session wipes roll_log/chat + broadcasts campaign-wide). NEXT: combat-flow (#10), npc-roster-crud, communities-lifecycle, inventory-trade, rumors-publish-clone; plus a routed-in task - add the map_pins moderation-bypass regression to world-pin-to-queue (Puffer's trigger is now LIVE). Preference holds: REST-refetch assertions over app-edit testids; any unavoidable testid is its own minimal additive commit, flagged here first.
- **touching:** `e2e/` (additive specs only - no app-code edits this batch). Docs: `tasks/todo.md`, `tasks/beginners-guide-testplan.md`, `tasks/lessons.md`, `tasks/e2e-results-2026-05-24.html`.
- **updated:** 2026-05-24, working from HEAD daca54e+ (lane/e2e; rebases on push).
