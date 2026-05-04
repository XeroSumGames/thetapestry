# Barter + First Impression bug fixes — 2026-05-01 testplan

Three real bugs from the post-8-PR audit, all on `app/stories/[id]/table/page.tsx`.
One PR. One DB migration. Ship to live.

## ⚠️ Pre-deploy step (DB migration)

**Before** the new code reaches users, run this in the Supabase SQL editor:

```
sql/npc-relationship-cmod-rpc.sql
```

If you push first, both the First Impression roll and Barter Dire/Low Insight outcomes will throw on the missing RPC. Two minutes, no schema changes — just one new function.

## What's fixed

### 1. First Impression no longer overwrites (gameplay bug)

[app/stories/[id]/table/page.tsx:5049](app/stories/[id]/table/page.tsx:5049). Pre-fix, `relationship_cmod` was set to `cmodDelta` directly — meeting the same NPC twice **erased** the first roll's impact. Now an atomic add-with-clamp via `bump_npc_relationship_cmod` accumulates the delta into the existing value (clamped to ±3 to match the `FIRST_IMPRESSIONS` picker range).

### 2. Race condition in barter relationship damage

[app/stories/[id]/table/page.tsx:10139](app/stories/[id]/table/page.tsx:10139). Pre-fix was select-then-insert/update — two races (unique-constraint violation on parallel inserts, lost-update on parallel decrements). Same RPC fix: one `INSERT … ON CONFLICT DO UPDATE` runs atomically per row.

### 3. Barter `onApply` error handling

[app/stories/[id]/table/page.tsx:10145](app/stories/[id]/table/page.tsx:10145). Two changes:

- The whole `onApply` body is now wrapped in a try/catch. Any mid-flow throw (NPC vanished, stockpile RLS denial, partial-write) lands as a user-facing alert + UI resync instead of a silent dev-console error.
- The community-stockpile loop now error-checks every read/write. Pre-fix, only the final `roll_log` insert was checked — mid-loop failures left the stockpile half-applied with no signal.
- Bonus: `JSON.parse(JSON.stringify(...))` swapped to `structuredClone()` (matching the inventory clone pattern shipped earlier).

## New RPC

[sql/npc-relationship-cmod-rpc.sql](sql/npc-relationship-cmod-rpc.sql) — `bump_npc_relationship_cmod(npc_id, character_id, delta, [clamp_min], [clamp_max], [set_revealed], [reveal_level])`. Plain SQL function (no `SECURITY DEFINER` — existing RLS still gates writes). Used by both First Impression (delta=±2/±1, set_revealed=true, reveal_level='name_portrait') and onRelationshipDamage (delta=-1, no reveal flip).

## Test plan

### A. First Impression accumulation (5 min)
- [ ] Pick a PC and an NPC the PC has never met.
- [ ] Trigger a First Impression roll. Hit Success (CMod +1). Check the NPC card → `relationship_cmod = 1`.
- [ ] Trigger another First Impression roll on the same NPC. Hit High Insight (CMod +2). Check the NPC card → `relationship_cmod = 3` (1 + 2, clamped at +3 ceiling).
- [ ] Trigger again, hit Low Insight (-2). Card should show `relationship_cmod = 1`. **Pre-fix this would have read `-2`, overwriting.**
- [ ] Trigger several Dire Failure rolls. Card stops at `-3` (floor clamp).
- [ ] Whichever direction you go, `revealed=true` and `reveal_level` stay set.

### B. Barter relationship damage (3 min)
- [ ] Initiate a barter against an NPC the PC has met.
- [ ] Roll a Dire Failure. Check the NPC card → `relationship_cmod` decremented by 1, floored at -3.
- [ ] Repeat — each Dire Failure clamps further down to -3, never below.

### C. Barter error surfacing (5 min)
- [ ] Initiate a barter, set up some give/get items, click apply with offline mode toggled in DevTools (or block the request). Expect an alert: "Trade failed: …" and the modal stays open. Inventory state on the UI re-syncs from the server.
- [ ] Initiate a barter against a community stockpile. While the modal is open, have another GM (or use SQL) delete the stockpile row for one of the items the PC is taking. Apply the trade → expect alert; PC inventory + stockpile re-sync.
- [ ] Happy-path barter against an NPC. Expect normal apply, modal closes, items move correctly.
- [ ] Happy-path barter against a community stockpile. Same.

### D. Race smoke (2 min, optional)
- [ ] Open two tabs of the same campaign as the same PC. In one tab, fire a First Impression. Quickly fire another in the other tab. Both should land successfully — pre-fix one would have hit a unique-constraint violation. (You probably can't actually trigger this manually fast enough; the SQL constraint backs you up if you do.)

### E. Build / smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors during the happy-path First Impression and barter flows.

## Rollback

Code: `git revert <commit>` then redeploy. The RPC stays in place — additive, harmless to leave.
