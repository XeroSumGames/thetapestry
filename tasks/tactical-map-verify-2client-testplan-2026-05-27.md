# Tactical-Map Render Fix - 2-Client Acceptance Gate

**Author:** Puffer Fish. **Date:** 2026-05-27. **Purpose:** the go/no-go proof that HP's render rewrite actually fixed the 2026-05-26 playtest bug. **"Shipped != fixed"** (tonight's stale-cache signup taught us that). This is the bar HP builds toward and the gate we run before calling the core table loop reliable for the 9/1 Kickstarter.

Serves the **north star** (`tasks/north-star.md`): #1 priority = reliable core table loop. The tactical map made the last playtest unplayable; this gate is the proof it's safe.

Companion to the fix spec: `tasks/tactical-map-render-fix-spec-2026-05-26.md` (the corrected coordinate model). Schema already applied: `sql/tactical-scenes-scale-sentinel-2026-05-26.sql`.

---

## What broke (what this gate must prove is gone)
At the 2026-05-26 Minnie playtest: players couldn't see their own tokens (rendered in the black void off the map), and the map rendered at a DIFFERENT scale per client. Root cause: `img_scale` did two jobs (shared image-to-grid scale AND per-client viewport fit), was never persisted, and `1` meant both "unset" and "100%" -> every client silently auto-fit the bg to its own window while the grid stayed at `cell_px`. Locked map then stranded mis-centered viewers.

## Preconditions
- HP's render rewrite is DEPLOYED to prod (per the fix spec: shared authoritative img_scale rendered for all + per-client fit via ZOOM; no silent per-client rescale; locked-map "center on my token").
- Scale-sentinel migration applied (done 2026-05-26).
- A test scene with a BACKGROUND IMAGE + PC tokens placed near the RIGHT and BOTTOM grid edges (Spring Valley `0c2ddae8` is a good fixture - 57x43, bg 2048x1536, tokens were at cols 44-56).
- TWO accounts (a GM + a player) on TWO browsers/windows of DIFFERENT widths - and crucially include ONE NARROW viewport (the original victim was Opera at 1318px). Hard-refresh both onto the new build first.

## Manual 2-client checks (the core proof - every one must PASS)
1. **Token on map, both clients:** a far-right-column token (e.g. col 56) renders ON the background (at the right edge), NOT in black dead space - on BOTH the GM and the player screen.
2. **Same composite:** a given token sits over the SAME map feature for both viewers (alignment identical); only zoom/scroll differ. (This is the "not the same for all players" failure - it must be gone.)
3. **Player sees own token on open:** the player, on opening the scene, is looking at / can immediately reach their own PC token (not stranded on empty map).
4. **Locked map never strands:** GM locks the map -> the player is still centered on their PC and can re-center on demand (the "center on my token" affordance) - they are NEVER stuck looking at space they can't leave.
5. **Resize stability:** resize the player's window narrower/wider -> the bg-to-grid alignment stays correct (no per-client rescale divergence reappears).
6. **Share View:** GM Share View -> the player's scroll+zoom snaps to the GM's, still aligned.
7. **Reload stability:** hard-reload BOTH clients -> identical correct result (no auto-fit clobber of the persisted scale).
8. **Second scene:** switch the active scene to a different map (e.g. Frank's Compound) -> repeat checks 1-3 -> same correctness on a different image/grid.

## Automatable subset (E2E lane, data/DOM level - canvas pixels stay manual)
Route to Playwright (their wheelhouse) once the rewrite lands:
- After a GM opens an unset scene, assert the scene's `img_scale` is PERSISTED (non-null) and `natural_w`/`natural_h` are populated (REST).
- Assert two clients read the SAME stored `img_scale` for the scene (REST) - the shared-scale guarantee.
- Assert no code path sets `img_scale` from container width on load (the per-client auto-fit is gone) - static/grep check.
- (Pixel-level "token is on the bg" stays a MANUAL 2-client check - canvas can't be asserted headlessly.)

## Go / No-Go
- **GREEN (fix proven):** ALL 8 manual checks pass on TWO clients including a NARROW viewport. Then Puffer demotes the TacticalMap entry in the Risk Register (`debug-handoff.md` Sec 1) from YELLOW back toward GREEN, and the core-loop reliability item is met for the KS.
- **RED:** any check fails -> back to Hunt & Peck with the specific failing check #; do NOT demote.

## Ownership
- **Puffer:** owns this gate (defined here) + the Risk Register demote on GREEN + the data-subset routing to E2E.
- **Hunt & Peck:** the render rewrite; builds to this bar.
- **Playwright / E2E:** automates the data/DOM subset; flags any regression.
- **The manual 2-client run** is the actual gate: Xero + a second account (or two reviewers/beta testers) on two different-width windows.
