# imgScale clobber on tactical_scenes UPDATE - 2026-05-04 testplan

Reported during playtest: when the GM toggles a window (or any other action that writes to `tactical_scenes`), the player's view zoom-jumps. Single-line root cause, single-line fix.

## What's fixed

[components/TacticalMap.tsx:621](components/TacticalMap.tsx:621)

The bg-image-load effect (~line 780) runs a local **auto-fit**: if the scene has no saved `img_scale` (`null` or default `1`), each viewer locally sets `imgScale` to fit the bg image to their container width. This value is **not persisted to the DB** - it's per-viewer, intentionally local-only.

Pre-fix, `loadScenes()` re-applied `setImgScale(active.img_scale)` for every player on every call. `loadScenes()` fires on every `tactical_scenes` UPDATE event - which includes window/wall toggles. So:

1. Player joins, bg image loads, auto-fit sets local `imgScale = 0.6` (say).
2. GM toggles a window → DB writes the `walls` column → realtime fires UPDATE.
3. Player's `loadScenes()` runs. `active.img_scale` is `1` (DB default - auto-fit isn't persisted). `setImgScale(1)` clobbers local `0.6 → 1`. **Visible zoom jump.**

Now we only re-apply `img_scale` when the GM has set a non-default value (`>0` and `!== 1`):

```
if (active.img_scale && active.img_scale !== 1) setImgScale(active.img_scale)
```

If the DB has the default (`null` or `1`), the player's local auto-fit owns the scale - no clobbering on subsequent updates.

`cell_px` keeps its existing always-re-apply behavior because it's purely DB-driven (no local override).

No DB migration. No data shape change.

## Test plan

### A. The reported bug (3 min)
- [ ] Player joins a scene that has a wide bg image (wider than the player's container width). Confirm auto-fit kicks in - image fills the container.
- [ ] As GM, toggle a window or door (or paint fog). The player's view should NOT zoom-shift. Image stays auto-fit. Walls/fog update normally.
- [ ] Repeat several times. Each toggle should be smooth on the player side.

### B. GM-set img_scale still propagates (3 min)
- [ ] As GM, open the scene-controls popout. Manually adjust img_scale to a non-default value (e.g. 0.8). The popout debounces a write to the DB.
- [ ] Player's view updates to scale 0.8 within ~1 second (realtime delivery + loadScenes). ✓
- [ ] Toggle a window. Player view stays at 0.8 (no clobber from DB's stored 0.8). ✓

### C. Edge case: GM resets img_scale to 1 (1 min, optional)
- [ ] GM had img_scale at 0.8, manually resets to 1 (default). The player will NOT auto-update to 1 because of this guard - they'll stay at 0.8 until next page load. **Known tradeoff.** If this matters, follow-up PR can add a "last-synced img_scale" diff tracker. For now, the auto-fit on next reload corrects this.

### D. cell_px is unaffected (1 min)
- [ ] As GM, change cell_px from 35 to 40 via the popout. Player's grid spacing updates to 40. ✓
- [ ] Toggle a window. cell_px stays at 40. ✓ (cell_px wasn't part of the bug.)

### E. Build / smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors during fog/window/wall toggles.

## Rollback

`git revert <commit>` then redeploy. Restores the always-re-apply behavior. Player zoom-jump on UPDATE returns; popout-changes-still-propagate behavior is preserved.

## Followup

- If the "GM resets img_scale to 1 doesn't propagate" edge case becomes annoying, add a `lastSyncedImgScaleRef` keyed by sceneId so we apply on diff rather than just non-default values. Same shape as `lastSyncedSceneIdRef`. Single ref, ~5 LOC.
