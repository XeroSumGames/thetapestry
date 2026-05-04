# Perf cleanup — 2026-05-01 testplan

Three small perf wins from the audit's leftover queue. One PR. Ship to live.

## What's in this PR

1. **Snapshot restore + clone batched inserts** ([lib/campaign-snapshot.ts:130](lib/campaign-snapshot.ts:130) and [lib/campaign-snapshot.ts:232](lib/campaign-snapshot.ts:232))
   - Pre-fix: per-scene `for await` loop — one round-trip per scene, then nested per-scene token insert. With 20 scenes that's 40 sequential RTTs.
   - Post-fix: one `INSERT` for all scenes, then one `INSERT` for all tokens across all scenes. Both `restoreCampaignSnapshot` and `cloneSnapshotIntoCampaign` updated.
   - Behavior change: a single bad scene now fails the whole batch instead of skipping that scene. Acceptable because restore is already not atomic (the wipe ran), and an all-or-nothing failure mode is easier to reason about than a partial one.

2. **NpcRoster reorder + folder rename — fewer queries** ([components/NpcRoster.tsx](components/NpcRoster.tsx))
   - `renameFolder` (line 567): collapsed `Promise.all(npcs.map(update))` into one `.update({...}).in('id', ids)`. N RTTs → 1.
   - Drag reorder (line 368): only persists rows whose `sort_order` actually changed. Before it always wrote every NPC's sort_order even when most weren't affected.

3. **Memoize `throwMode` projection passed to TacticalMap** ([app/stories/[id]/table/page.tsx:2755](app/stories/[id]/table/page.tsx:2755))
   - Pre-fix: `throwMode={throwMode ? { ... } : null}` constructed inline on every parent render → new identity each time → defeated TacticalMap's internal memo, retriggering the in-flight throw arc / target preview re-render path.
   - Post-fix: `tacticalThrowMode = useMemo(... , [throwMode])` keeps the prop stable when `throwMode` itself didn't change.

No DB migration. No functional behavior change for the user.

## Test plan

### A. Snapshot restore + clone (10 min)
- [ ] Capture a snapshot of a campaign with **multiple scenes** (3+) each carrying tokens (NPC + object). Save the JSON.
- [ ] Restore the snapshot in place — verify all scenes return, all tokens are placed correctly, GM sees the same world state.
- [ ] In DevTools → Network during the restore, confirm only ONE `tactical_scenes` insert and ONE `scene_tokens` insert (instead of N + N).
- [ ] Clone the snapshot into a freshly-created empty campaign — same checks. NPC tokens point at the new (cloned) NPCs; PC references are nulled.
- [ ] Edge case: restore a snapshot with **zero scenes** — no insert calls fired, no errors.

### B. NPC roster reorder + folder rename (5 min)
- [ ] Drag an NPC from the top of the roster to the middle. Verify the new order persists across reload.
- [ ] In Network, confirm only the rows in the affected slice got `update sort_order` calls, not every NPC in the roster.
- [ ] Rename a folder ("Townspeople" → "Locals"). Verify all NPCs in the folder are moved.
- [ ] In Network, confirm a single `update({folder}).in('id', ids)` request, not one per NPC.

### C. Tactical throwMode memo (3 min)
- [ ] Start combat. Initiate a grenade throw — overlay shows range + target picker.
- [ ] Trigger an unrelated re-render (e.g. another player rolls dice → roll feed updates). Confirm the throw target preview / arc DOESN'T flicker or reset.
- [ ] Pick a target cell, complete the throw → behavior identical to pre-fix.

### D. Smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors during snapshot capture/restore/clone or during combat throw flow.

## Rollback

`git revert <commit>` then redeploy. No DB or schema changes.
