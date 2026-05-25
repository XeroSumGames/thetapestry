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
- **focus:** SHIPPED two specs this session. (1) `vehicle-maintenance-checks.spec.ts` - dice-gated Install/Gather checks (HP's 12fbe58): seeds campaign + NPC + a vehicle PATCHed straight into campaigns.vehicles (GM owns -> direct JSONB write, no RPC), asserts flow/structure not dice (modal -> roller -> Close + roll_log row tagged checkKind). (2) Ch14.4 in `rumors-publish-clone.spec.ts` - a 2nd test: publish v1 -> clone -> publish v2 -> the subscriber hub's StoryActionBar surfaces the `📦 update` notice (semver-agnostic getByTitle; `.eq(campaign_id)`-scoped so the live account's other subs don't pollute) -> links to version-history. Both GREEN standalone + full re-cert (124 passed + 1 known watch-list flake retried green, 1 skipped, 0 real fails, 7.7m). 2 lessons logged. PRIOR shipped+certified: Phase 2 6/7 (#8/#9/#11/#12/#13/#14 + map_pins bypass-regression). #10 combat-flow + Phase 3 still blocked on app testids/GM-damage hook (HP); PC-trade un-fixme gated on the give_item_to_character RPC (PF, apply-gated) + HP client rewire. **Lane now IDLE / available.**
- **touching:** `e2e/vehicle-maintenance-checks.spec.ts` (new), `e2e/rumors-publish-clone.spec.ts` (+1 test) + docs `tasks/vehicle-maintenance-checks-e2e-testplan-2026-05-24.md` (new), `tasks/todo.md`, `tasks/lessons.md`. Reads only of `app/vehicle/*`, `components/StoryActionBar.tsx`, `components/ModulePublishModal.tsx`, `lib/fuel-storage.ts`, `lib/brewing-supplies.ts`, `lib/vehicle-checks.ts`, `components/RollModal.tsx`. NO app/component/lib edits.
- **updated:** 2026-05-24, HEAD will be the push of the Ch14.4 test (lane/e2e; rebases on push).
