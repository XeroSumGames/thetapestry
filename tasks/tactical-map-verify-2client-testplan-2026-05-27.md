# Tactical-Map Render Fix - 2-Client Acceptance Gate

**Author:** Puffer Fish. **Date:** 2026-05-27. **Purpose:** the go/no-go proof that HP's render rewrite actually fixed the 2026-05-26 playtest bug. **"Shipped != fixed"** (tonight's stale-cache signup taught us that). This is the bar HP builds toward and the gate we run before calling the core table loop reliable for the 9/1 Kickstarter.

Serves the **north star** (`tasks/north-star.md`): #1 priority = reliable core table loop. The tactical map made the last playtest unplayable; this gate is the proof it's safe.

Companion to the fix spec: `tasks/tactical-map-render-fix-spec-2026-05-26.md` (the corrected coordinate model). Schema already applied: `sql/tactical-scenes-scale-sentinel-2026-05-26.sql`.

---

## What broke (what this gate must prove is gone)
At the 2026-05-26 Minnie playtest: players couldn't see their own tokens (rendered in the black void off the map), and the map rendered at a DIFFERENT scale per client. Root cause: `img_scale` did two jobs (shared image-to-grid scale AND per-client viewport fit), was never persisted, and `1` meant both "unset" and "100%" -> every client silently auto-fit the bg to its own window while the grid stayed at `cell_px`. Locked map then stranded mis-centered viewers.

## Preconditions
- HP's render rewrite is DEPLOYED to prod. **As of 2026-05-30 the build under test is `bd707b9` or later**, with the layered fixes: `7ba065b` (full viewport model: shared scale metric, fit-on-open, smart move-follow), `a9b8c44` (move-follow stale-initiative-ref fix - the actual close of the 2026-05-30 NO-GO), `9154d26` (player opens on their tokens, not map midpoint), `454f452` (Campaign Map <-> Tactical Map toggle, GM), on top of the earlier `6ef34ce`/`fca10a6` lock-bg-to-grid + the wave of zoom/scale polish (`b91c821`, `e94f143`, `061f981`, `f722652`, `4a2b3ff`, `5aaaf40`, `ef13951`). This gate covers BOTH the scale-divergence fix (checks 1-8) AND the move-follow fix (checks 9-12). Check #9 (follow active combatant on move) was the 2026-05-30 NO-GO; `a9b8c44` is the targeted fix and is the must-prove this run.
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

### Move-follow checks (NEW - the 2026-05-29 fix in `7ba065b`; these are the must-prove)
The 2026-05-29 playtest NO-GO: the player's viewport did NOT follow a token MOVE, so a GM-moved or edge token left the player's frame and "if the GM moves Mikey 1 row right, the player can no longer see him." `7ba065b` makes the player's view auto-scroll on MOVE for the active combatant + the viewer's own PC (only when the moved token would be OFF-screen), and retargets the CENTER button. Prove it:
9. **Follow the active combatant on MOVE:** start initiative so a known token is the ACTIVE combatant. On the PLAYER client, scroll so that token is off-screen, then have the GM move it. The player's viewport auto-scrolls to bring the active token back into view (it is NOT left off-screen). Repeat with the active token already on-screen -> the view should NOT jump (follow only fires when it would be off-screen).
10. **Follow your own PC on MOVE:** on the player client, scroll your own PC off-screen, then have the GM move your PC one or more cells. Your viewport auto-scrolls back to your PC. (Also: when YOU move your own PC, your view keeps it framed.)
11. **No spurious follow:** the GM moves an UNRELATED token (not the active combatant, not the player's own PC). The player's viewport does NOT jump - their pan stays put. (Confirms follow is scoped to own-PC + active, not every move.)
12. **CENTER button priority:** on the player client, pan away from everything, then click CENTER ("Center the map on your token"). It recenters on the player's OWN PC first (falls back to active combatant > any PC > any visible token if the player has no PC on the map) - NOT the geometric map center.

## Automatable subset (E2E lane, data/DOM level - canvas pixels stay manual)
Route to Playwright (their wheelhouse) once the rewrite lands:
- After a GM opens an unset scene, assert the scene's `img_scale` is PERSISTED (non-null) and `natural_w`/`natural_h` are populated (REST).
- Assert two clients read the SAME stored `img_scale` for the scene (REST) - the shared-scale guarantee.
- Assert no code path sets `img_scale` from container width on load (the per-client auto-fit is gone) - static/grep check.
- (Pixel-level "token is on the bg" stays a MANUAL 2-client check - canvas can't be asserted headlessly.)

## Go / No-Go
- **GREEN (fix proven):** ALL 12 manual checks pass on TWO clients including a NARROW viewport. Then Puffer demotes the TacticalMap entry in the Risk Register (`debug-handoff.md` Sec 1) from YELLOW back toward GREEN, and the core-loop reliability item is met for the KS.
- **RED:** any check fails -> back to Hunt & Peck with the specific failing check #; do NOT demote.

## Ownership
- **Puffer:** owns this gate (defined here) + the Risk Register demote on GREEN + the data-subset routing to E2E.
- **Hunt & Peck:** the render rewrite; builds to this bar.
- **Playwright / E2E:** automates the data/DOM subset; flags any regression.
- **The manual 2-client run** is the actual gate: Xero + a second account (or two reviewers/beta testers) on two different-width windows.
