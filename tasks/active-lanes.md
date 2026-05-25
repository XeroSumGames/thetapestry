# Active Lanes - live status board

Each of the three chats updates ITS OWN row at the START and END of a work batch
so the other two can steer clear of the same area (the substrate can't otherwise
show in-flight focus). Keep it to a few lines per lane. Convention + ownership:
[tasks/lane-protocol.md](lane-protocol.md).

Format per lane: **focus** (what right now) / **touching** (files/area) /
**updated** (timestamp + HEAD you're working from).

---

## Hunt & Peck
- **focus:** Vehicle install/gather skill-checks SHIPPED (Phase 1 edb2032 extraction + Phase 2 12fbe58 feature; eyeball owed on Minnie popout). THEN a playtest bug "PC tokens won't appear on the map" (campaign cc766e7f): diagnosed via live-DB read - tokens WERE placed but (a) all stacked on cell (1,1), and (b) the active scene was a blank "New Map" (4 dupes from a mashed "+ New Map" button) while the GM's real battle maps sat inactive. Fixes shipped: **08990ad** spawn-spread (defaultSpawnCell now steps to nearest free cell; placeTokenOnMap passes occupancy) + **2d17047** createScene double-fire guard. **Cleaned up the live campaign** (Xero-authorized): deleted the 4 blank New Maps, reactivated Frank's Compound. PENDING (Xero said yes, needs proper build): full "blank-map default" - the no-active-scene GM empty state has NO scene picker (would strand the GM), so it needs a picker UI; proposing mockup-first. Lane otherwise IDLE.
- **touching:** `lib/tactical-spawn.ts`, `app/stories/[id]/table/page.tsx` (placeTokenOnMap), `components/TacticalMap.tsx` (createScene), `tests/lib/tactical-spawn.test.ts`. Live DB: deleted 4 blank scenes + reactivated Frank's Compound (Xero-authorized).
- **updated:** 2026-05-25, HEAD 2d17047 (rebases on push).

## Puffer Fish
- **focus:** Session 2026-05-24. EARLIER (committed): map_pins moderation CLOSED on prod, audit_log AL1 confirmed live, Confidence Ledger refreshed. THIS BATCH: **Beta-500 readiness** (`tasks/beta-500-readiness-2026-06-01.md` + todo "BETA-500" section, owner-tagged) for 6/1 500-free-friendlies. Ran the sibling-RLS audit -> found a HIGH data-loss CLASS: **`characters` cross-user writes silently no-op for non-Thriver GMs** (8 flows: GM loot/award/ration + PC trade) - latent because dev GMs are Thrivers; combat is SAFE (character_states has a member/GM policy). Finding `tasks/finding-characters-rls-cross-user-writes-2026-05-24.md`. **GM-of-campaign RLS fix applied + verified live (flows 2-8 fixed); Risk Register RED -> YELLOW.** PC-PC trade (flow 1): Option B - **`give_item_to_character` RPC APPLIED + verified live 2026-05-24** (SECURITY DEFINER, atomic both-sides). BUT nothing calls it yet -> **SOLE remaining trade gap = Hunt & Peck rewires `onGiveItem`** (`table/page.tsx` ~6925) to call the RPC + drop the raw writes; trade still loses data till then; then Risk Register characters-class -> GREEN + E2E un-fixmes. Now IDLE / available.
- **touching:** `tasks/beta-500-readiness-2026-06-01.md` (new), `tasks/finding-characters-rls-cross-user-writes-2026-05-24.md` (new), `sql/characters-gm-write-rls-2026-05-24.sql` (new, NOT applied), `tasks/debug-handoff.md` (Risk Register), `tasks/todo.md` (own section), `tasks/active-lanes.md`. NO `app/` / `components/` / `lib/` / `e2e/` edits; NO live-DB changes this batch (the characters fix is gated on Xero).
- **updated:** 2026-05-24, lane/puffer (commits push to main; rebases on non-ff).

## Playwright / E2E
- **focus:** SHIPPED `e2e/vehicle-maintenance-checks.spec.ts` - durable coverage for the dice-gated Install Fuel Drum + Gather Materials checks (Hunt & Peck's 12fbe58, routed here). ONE test, ONE throwaway campaign, BOTH flows; seeds campaign + 1 NPC + a vehicle PATCHed straight into campaigns.vehicles (GM owns -> direct JSONB write, no RPC); asserts flow/structure NOT dice (modal -> roller picker -> roll -> Close + outcome banner + roll_log row tagged damage_json->>checkKind w/ valid XSE outcome); cascade-delete teardown; ZERO app testids. GREEN standalone + full re-cert (122 passed + 2 known watch-list flakes absorbed by retries, 1 skipped, 0 real fails, 8.0m). Lesson logged (JSONB-sub-entity seeding via PATCH-the-parent; RPC is only for non-owner writers). PRIOR shipped+certified: Phase 2 6/7 (#8/#9/#11/#12/#13/#14 + map_pins bypass-regression). #10 combat-flow + Phase 3 still blocked on app testids/GM-damage hook (Hunt & Peck). **Lane now IDLE / available.**
- **touching:** `e2e/vehicle-maintenance-checks.spec.ts` (new) + docs `tasks/vehicle-maintenance-checks-e2e-testplan-2026-05-24.md` (new), `tasks/todo.md`, `tasks/lessons.md`. Reads only of `app/vehicle/*`, `lib/fuel-storage.ts`, `lib/brewing-supplies.ts`, `lib/vehicle-checks.ts`, `components/RollModal.tsx`. NO app/component/lib edits.
- **updated:** 2026-05-24, HEAD will be the push of this spec (lane/e2e; rebases on push).
