# Modal Visual Unification - Phase A testplan (2026-05-24)

Shipped: commit `8cc173f`. Run this on the DEPLOYED dev env (Vercel) at `thetapestry.distemperverse.com` after the build lands. The point: every roll modal now wears the same ATTACK-shaped shell; each modal's own body must still work. Claude did NOT browser-verify - this sheet is the visual gate.

Rollback if anything is wrong: `git revert 8cc173f --no-edit && git push origin main`.

## What changed (so you know what to look at)
`components/RollModal.tsx` was reskinned to match the combat ATTACK ROLL modal:
- 400px wide, **draggable** by the grab strip at the top.
- **Contextual backdrop:** modals over the tactical map are see-through (no dimming); modals over a character sheet dim the screen.
- Outcome text uses the **feed palette** (Success = BLUE, not green).
- A small colored **eyebrow** (the roll type) sits above the title; the same color tints the Roll button.
- Dice tiles are bigger (52px, thicker border, 28px digits).

## A. Visual chrome - do this side-by-side with a real ATTACK roll
1. Start combat, make a weapon **Attack** roll (the reference modal). Note its look.
2. Open each modal below and confirm it matches the Attack modal: 400px width, top grab strip, drag works, eyebrow style, 20px uppercase title, dice tiles, outcome at large size in feed colors, button shapes, padding.
3. **Backdrop check:**
   - **See-through (no dim):** Recruit result, Stabilize, Distract, Gut Instinct, Vehicle check. The map/page should be visible behind the panel.
   - **Dimmed:** Stress Check, Breaking Point, Lasting Wound. Screen darkens behind the panel.
4. **Palette check:** force a **Success** outcome somewhere - it must be BLUE (old modal showed green). Wild Success / Dire Failure / High/Low Insight should match the feed colors.
5. **Accent check (eyebrow + Roll button tint):** Recruit purple `#b07cc6`, Stabilize green `#7fc458`, Distract teal `#4aa3b5`, Gut Instinct cyan `#5aa0c0`, Vehicle rust `#d4883a`, Stress amber `#EF9F27`, Breaking Point + Lasting Wound red `#c0392b`.

## B. Per-modal idiosyncrasy - each body must still work
6. **Recruit:** roll a recruitment; result step still shows the join/fail card, the reroll buttons (incl. 3-die on an Insight 3d6), and the Apprentice toggle on a High Insight + joined result.
7. **Stabilize:** 🩸 STABILIZE a mortally-wounded combatant; the Medicine cascade narrative renders in the result body.
8. **Distract:** the target dropdown (Close range, <=30ft) shows pre-roll; action-delta result renders.
9. **Gut Instinct:** the sub-skill warning line shows; resolving whispers the GM detail (broadcast fires).
10. **Vehicle:** open a vehicle check (driving / brew / navigate / attack) - each shows its own picker + any warnings (e.g. brewing-supplies error). **WATCH:** this one is no-dim over a normal page (not the map) - confirm the floating see-through panel still reads as a modal and isn't confusing. If it looks unanchored, tell Claude and we'll switch Vehicle to dimmed.
11. **Stress Check:** trigger at-max (stress hits 5) and the mid-play CHECK button; both branches roll; failure at max cascades into Breaking Point.
12. **Breaking Point / Lasting Wound:** table-lookup outcome renders in the body, NO reroll buttons, the close button reads its custom label (e.g. "Roll on Breaking Point Table" / Acknowledge).
13. **Insight 3d6:** spend an Insight Die pre-roll for 3d6 - the post-roll shows 3 dice tiles; reroll buttons are hidden on High/Low Insight.

## Pass criteria
- All modals share the ATTACK chrome; backdrops match the see-through/dim map above; Success is blue.
- Every per-modal body (pickers, cascades, toggles, table lookups, reroll rules) behaves exactly as before.
- No console errors when opening/closing any modal.
