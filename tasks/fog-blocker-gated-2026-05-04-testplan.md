# Fog blocker-gated semantic — 2026-05-04 testplan

Resolves the conflict between two earlier fog fixes:
- **This morning** (commit 26f6dfc): made painted fog absolute, fixing maps where unbounded sight cleared all painted fog on no-walls scenes.
- **This evening's regression**: opening a window no longer let players see through, because painted fog was now absolute everywhere.

## What's fixed

[components/TacticalMap.tsx:1244](components/TacticalMap.tsx:1244) onward — the visibility sweep + painted-fog-defeasibility logic now both gate on whether the scene has authored vision blockers (walls / closed doors / closed windows / wall-tagged tokens).

```
hasBlockers = visionSegs.length > 0 || cellBlockers.size > 0
```

Three behaviors merge cleanly:

| Scene state | Painted fog | Auto-fog |
|---|---|---|
| No blockers + PC on map | Absolute (no LoS clear) | Off (gated by `hasBlockers`) |
| Blockers + PC on map | LoS-defeasible (open window punches through) | On (everything outside PC LoS is fogged) |
| Blockers + no PC | Absolute (no PC = no LoS) | Off |

The vision sweep itself is skipped entirely on no-blocker scenes, so day-mode unbounded sight stops "marking everything visible." That was the root cause of both prior bugs.

No DB migration. No data shape change.

## Test plan

### A. Open-window restores vision (the regression case) — 3 min
- [ ] On a scene with authored wall segments (window in a wall), GM paints fog inside the room behind the window. Player has a PC outside.
- [ ] Window starts closed → player can't see through (painted fog + LoS-blocked).
- [ ] GM clicks the window to open it. Within ~1 second (wall-persist debounce + realtime), player sees through the window — painted fog along the LoS path clears, room interior visible.
- [ ] GM closes the window again. Painted fog returns. Player can no longer see through.

### B. No-walls scene preserves painted fog (this morning's fix) — 2 min
- [ ] On a scene with the building drawn into the background image but NO authored wall segments, GM paints fog over part of the map. Player has a PC anywhere.
- [ ] Painted fog renders absolute on the player view. PC's day-mode unbounded sight does NOT clear it.
- [ ] No auto-fog applied (the scene has no blockers, so auto-fog is gated off — the GM gets exactly what they painted, nothing more, nothing less).

### C. Auto-fog still works on walled scenes — 2 min
- [ ] Scene with walls authored, GM paints NO fog. Player has a PC inside a walled area.
- [ ] Auto-fog covers everything outside the PC's LoS. PC moves → auto-fog adjusts. Closing a door re-fogs the corridor beyond.

### D. GM edit-mode preview — 1 min
- [ ] Click `EDIT FOG` as GM. Painted fog renders at 0.35 opacity (preview mode), even on a no-walls scene. Painting / erasing works as before.
- [ ] Exit edit mode. Painted fog goes opaque again.

### E. Build / smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors during fog edit / move / window-toggle flows.

## Rollback

`git revert <commit>` then redeploy. Reverts to "painted fog absolute everywhere," restoring this morning's fix at the cost of the open-window workflow. Single SHA, single line revert.

## Followup

- The 200ms debounce on wall persistence + the realtime roundtrip means the player's view updates ~500ms after the GM clicks. Fast enough for in-session use; not instant. If players report lag during fast door-juggle, consider broadcasting a `walls_changed` event in addition to the DB write.
- The "blockers exist" heuristic could be replaced with an explicit per-scene `auto_fog: bool` toggle in a future PR, giving GMs control over whether to use LoS-driven fog or pure manual.
