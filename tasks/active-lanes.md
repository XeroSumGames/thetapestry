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
- **focus:** Session 2026-05-24. EARLIER (committed): map_pins moderation CLOSED on prod, audit_log AL1 confirmed live, Confidence Ledger refreshed. THIS BATCH: **Beta-500 readiness** (`tasks/beta-500-readiness-2026-06-01.md` + todo "BETA-500" section, owner-tagged) for 6/1 500-free-friendlies. Ran the sibling-RLS audit -> found a HIGH data-loss CLASS: **`characters` cross-user writes silently no-op for non-Thriver GMs** (8 flows: GM loot/award/ration + PC trade) - latent because dev GMs are Thrivers; combat is SAFE (character_states has a member/GM policy). Finding `tasks/finding-characters-rls-cross-user-writes-2026-05-24.md`, Risk Register RED, **fix SQL written + apply-gated** (`sql/characters-gm-write-rls-2026-05-24.sql`, GM-of-campaign policy). PC-PC trade flow routed to [PF RPC + HP client] or disable-for-beta. Now IDLE / available.
- **touching:** `tasks/beta-500-readiness-2026-06-01.md` (new), `tasks/finding-characters-rls-cross-user-writes-2026-05-24.md` (new), `sql/characters-gm-write-rls-2026-05-24.sql` (new, NOT applied), `tasks/debug-handoff.md` (Risk Register), `tasks/todo.md` (own section), `tasks/active-lanes.md`. NO `app/` / `components/` / `lib/` / `e2e/` edits; NO live-DB changes this batch (the characters fix is gated on Xero).
- **updated:** 2026-05-24, lane/puffer (commits push to main; rebases on non-ff).

## Playwright / E2E
- **focus:** Phase 2 DONE bar #10: SHIPPED #8 char-create, #9 session-lifecycle, #14 rumors-publish-clone, #11 npc-roster-crud, #13 inventory-trade, #12 communities-lifecycle + map_pins bypass-regression - all green, ZERO app-code edits. The latest full re-cert (121 passed) flagged ONE failure, `section-a1-combat-start` (EXISTING spec, NOT a regression - passes standalone ~36s; its 10s IN-COMBAT timeout was too tight under full-run RT load) -> HARDENED to 25s + char-create now waits for the wizard form before fill (its lone flaky, same load class); both verified standalone, a final re-cert is running to re-confirm all-green. FOUND + ROUTED a prod DATA-LOSS bug: PC<->PC trade (own-row RLS) -> Puffer/Hunt&Peck, trade test.fixme'd. **#10 combat-flow is ROUTED, not built** (todo): foundation already covered by section-a1/a3; the attack->CMod->damage->nextTurn slice is bucket-C dice-gated MANUAL + needs a deterministic GM-damage hook + initiative/roll-row testids -> Hunt & Peck (their hot file). Lane now effectively idle on E2E build until that hook+testids land.
- **touching:** `e2e/` (additive specs + 2 timeout/wait hardening edits to existing section-a1 + char-create). Finding doc `tasks/finding-pc-trade-rls-dataloss-2026-05-24.md`. Docs: `tasks/todo.md`, `tasks/beginners-guide-testplan.md`, `tasks/lessons.md`, `tasks/e2e-results-2026-05-24.html`.
- **updated:** 2026-05-24, working from HEAD df22d83 (lane/e2e; rebases on push).
