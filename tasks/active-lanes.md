# Active Lanes - live status board

Each of the three chats updates ITS OWN row at the START and END of a work batch
so the other two can steer clear of the same area (the substrate can't otherwise
show in-flight focus). Keep it to a few lines per lane. Convention + ownership:
[tasks/lane-protocol.md](lane-protocol.md).

Format per lane: **focus** (what right now) / **touching** (files/area) /
**updated** (timestamp + HEAD you're working from).

---

## Hunt & Peck
- **focus:** Vehicle install/gather skill-checks (NEXT #1). **Phase 1 SHIPPED (edb2032): pure extraction** of the vehicle check state machine (CheckState/openCheck/switchBrew+Nav/rollCheck + the shared RollModal mount) out of `app/vehicle/page.tsx` (2088 -> 1394 lines) into new `app/vehicle/useVehicleCheck.tsx`. Behaviour-identical; tsc + 639 unit tests + all guardrails green. **AWAITING Xero's 2-client combat smoke** (driving/brew/navigate + a mounted-weapon attack that deals damage and decrements the shooter's action) before Phase 2. Phase 2 (blocked on the smoke): add install + gather kinds + an all-crew roller dropdown in preRollExtras (install gets a Mechanic*/Tinkerer toggle, gather uses Scavenging) -> applyInstallOutcome/applyGatherOutcome; rulings already locked in lib/vehicle-checks.ts.
- **touching:** `app/vehicle/page.tsx` + `app/vehicle/useVehicleCheck.tsx`. Reads: `lib/vehicle-checks.ts`, `lib/fuel-storage.ts`, `lib/brewing-supplies.ts`, `components/RollModal.tsx`.
- **updated:** 2026-05-24, HEAD edb2032 (rebases on push).

## Puffer Fish
- **focus:** Session 2026-05-24 DONE. (1) **map_pins moderation bypass CLOSED on prod** - trigger applied + verified (non-Thriver gm/approved -> forced rumor/pending); Risk Register RED -> GREEN, finding RESOLVED, regression routed to E2E. (2) **`audit_log` table (Phase AL1) confirmed LIVE** - applied `sql/audit-log-table-2026-05-20.sql` (Xero "apply it"; idempotent) + verified (table + RLS + 2 policies + 5 indexes). Reconciled doc drift: handoff listed it owed, todo said done - now both say DONE/verified. (3) Refreshed stale Confidence Ledger (532/29 -> 622/37). Now IDLE / available. Carried (gated): #5 phase-2 conditions routing (manual smoke + isolated worktree); #7 lasting-wounds migration (held); Stage C build (Phase 7); `audit_log` AL2+ recovery triggers (future); next schema-baseline refresh should include audit_log.
- **touching:** `tasks/debug-handoff.md`, `tasks/handoff.md`, `tasks/security-finding-map-pins-moderation-2026-05-24.md`, `tasks/todo.md` (own section), `tasks/active-lanes.md`. Live DB: applied map_pins trigger + audit_log table (both Xero-authorized). NO `app/` / `components/` / `lib/` / `e2e/` edits.
- **updated:** 2026-05-24, lane/puffer (commits push to main; rebases on non-ff).

## Playwright / E2E
- **focus:** Phase 2: 5 of 7 SHIPPED (#8 char-create, #9 session-lifecycle, #14 rumors-publish-clone, #11 npc-roster-crud, #13 inventory-trade) + map_pins bypass-regression - all green, ZERO app-code edits. #14 re-cert race fixed (poll the version). #13 found + ROUTED a CONFIRMED PROD DATA-LOSS BUG: PC<->PC trade destroys the item (Survivor giver can't write the receiver's characters row under own-row RLS) -> Puffer Fish (RLS/RPC) + Hunt & Peck (client), finding doc + trade test.fixme'd pending the RPC. REMAINING (2): communities-lifecycle (#12), combat-flow (#10 - heaviest, dice-gated, table-page testids, do LAST + coordinate with Hunt & Peck). NEXT: a final full re-cert to certify #14-fix + #11 + #13 integrated, then #12. Testid policy "A".
- **touching:** `e2e/` (additive specs only - no app-code edits). Finding doc `tasks/finding-pc-trade-rls-dataloss-2026-05-24.md`. Docs: `tasks/todo.md`, `tasks/beginners-guide-testplan.md`, `tasks/lessons.md`, `tasks/e2e-results-2026-05-24.html`.
- **updated:** 2026-05-24, working from HEAD 444152c (lane/e2e; rebases on push).
