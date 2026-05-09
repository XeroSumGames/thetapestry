# Painted fog absolute — 2026-05-04 testplan

One-line fix in [components/TacticalMap.tsx:1331](components/TacticalMap.tsx:1331). Restores the design intent stated in commit [`29e7f25`](https://github.com/XeroSumGames/thetapestry/commit/29e7f25)'s commit message ("GM-painted fog still works as additional 'force fog' on top") which the actual implementation contradicted. Ship to live.

## What's fixed

Pre-fix:
```ts
for (const k of Object.keys(rawFog)) {
  if (rawFog[k] && !visible.has(k)) effective[k] = true
}
```

The `!visible.has(k)` guard let PC line-of-sight punch through GM-painted fog. On any scene where the GM had drawn the building into the **background image** but not authored TacticalMap **wall segments** (the common case), there's nothing to block PC LoS. With day-mode unbounded sight, the PC's `visible` set covers the whole map → every painted cell got cleared → players saw through the GM's fog completely.

The reported playtest screenshot showed: GM had fog painted inside a building's rooms, player saw the entire interior with no fog at all.

Post-fix:
```ts
for (const k of Object.keys(rawFog)) {
  if (rawFog[k]) effective[k] = true
}
```

GM-painted fog is now absolute. PC LoS does not punch through it. The auto-fog blanket below (line 1338, "every cell outside PC LoS is also fogged when ≥1 PC is on scene") still works as before — it's the OTHER fog source, layered on top of the painted force-fog.

Net effect:
- Painted fog: always renders for non-GM viewers (unless the GM is in fogEditMode, where they see it at 0.35 opacity for editing).
- Auto-fog: still LoS-driven — close a door, the corridor beyond auto-fogs again.
- Day vs night: unchanged. Sight radius logic untouched.

No DB migration. No data shape change.

## Test plan

### A. The reported playtest case (2 min)
- [ ] Reproduce the exact screenshot setup: an active scene with the building in the background image (no authored wall segments), GM paints fog inside several rooms, player has any PC token on the scene.
- [ ] On the player view: every painted-fog cell now renders opaque black. The building's interior rooms are properly hidden. **Pre-fix this was the regression** — the player saw the entire interior.

### B. PC LoS still punches through auto-fog (3 min)
- [ ] Same scene. The GM does NOT paint any fog. Place a PC token. Players should still see auto-fog filling the rest of the map (anywhere outside the PC's sight radius). This test confirms the auto-fog branch (line 1338) is unaffected.
- [ ] Move the PC. Auto-fog adjusts so the PC's new LoS is the cleared region. Walls + closed doors still block.

### C. Painted + auto-fog overlap (2 min)
- [ ] GM paints fog in some cells AND has a PC on the scene. Painted cells stay fogged for the player even if the PC's auto-LoS reaches them. Cells outside both painted-fog AND PC LoS also fog (auto-fog).
- [ ] Move the PC into a painted-fog cell. The PC's surrounding cells get auto-cleared (PC sees its own area), but painted cells the GM marked still render fog. **This is the design intent.**

### D. GM editing experience (1 min)
- [ ] As GM, click `EDIT FOG`. Painted cells render at 0.35 opacity (preview mode). Painting / erasing works normally. Exit edit mode → painted cells go opaque.
- [ ] Players should see painted cells as fully opaque whether or not the GM is in edit mode.

### E. Build / smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors during fog edit / paint / move flows.

## Rollback

`git revert <commit>` then redeploy. Fog reverts to "PC LoS punches through painted fog." If you go back to that semantic later, the right way is to either author wall segments around hidden areas or pin the per-token sight radius below the building's diagonal — code shouldn't drive the workaround.

## Related

- Commit [`29e7f25`](https://github.com/XeroSumGames/thetapestry/commit/29e7f25) introduced the bug.
- Commit [`f906c0d`](https://github.com/XeroSumGames/thetapestry/commit/f906c0d) — fog opacity fix (different bug, unrelated, still correct).
- Commit [`acd7396`](https://github.com/XeroSumGames/thetapestry/commit/acd7396) — SHIFT-snap on wall/door/window endpoints (also unrelated).
