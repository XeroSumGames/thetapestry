# Playtest Issues — 2026-04-20 Session

37 issues identified during the Mongrels playtest. Organized by tier; within each tier, ordered to start with safest/most foundational fixes.

**Ground rules for working through this list:**
- One item per commit. Never combine fixes.
- After each edit: `npx tsc --noEmit` — must be clean before moving on.
- Commit message: `Playtest fix: <item #N> — <short description>`
- Mark items `[x]` in this file as each one ships.
- Capture any surprises or downstream bugs discovered mid-fix as a new item in the appropriate tier.

---

## TIER 1 — Fix first. Core gameplay blockers and broken mechanics.

### Navigation & redirect bugs
- [x] **#11 — Invite link choked at login.** New users following an invite link hit the login page and lose the invite context. Preserve the target path across signup/login so the invite flow actually works for new users. *Shipped: (1) login + signup read `?redirect=/path` (safe-relative-only guard), honor it on submit, and forward it across Sign-up / Log-in cross-links; signup skips `/firsttimers` when a redirect is present. (2) `/join/[code]` now auth-gates on mount — if logged out, bounces to `/login?redirect=/join/<code>` immediately (with `encodeURIComponent`), instead of waiting for a button click that might never happen.*
- [ ] **#12 — `/welcome` traps new users.** Disable the `/welcome` redirect entirely until further notice. Let new users browse freely.
- [ ] **#13 — Reload sends players to dashboard.** Reloading during a session redirects to `/dashboard` instead of returning the player to `/stories/[id]/table`. Fix session/route persistence.

### Damage math
- [ ] **#1 — Damage calculation incorrect.** Reported: `2+2d6 (6) = 8 raw → should be 7 WP / 7 RP (1 mitigated)`. Confirm the formula (`base + dice + PHY bonus` → WP/RP with RP% and mitigation) across all weapons.

### Initiative order & enforcement
- [ ] **#8 — Initiative order reversed for Knox/Koss.** Confirm sort order is roll-descending with stable secondary tiebreak (already shipped `character_name` tiebreak in `6a06726` + `2744b8f`). Re-verify for this specific pair.
- [ ] **#9 — Players went out of order.** Enforce strict initiative order; prevent off-turn players from acting. `handleRollRequest` already has a turn-gate, but the gate may have gaps.

### Dice logic
- [ ] **#6 — Insight Dice 3d6 keeps all 3 (no drop).** Currently drops lowest. Per SRD, 3d6 keep-all (sum). Locate the pre-roll spend code and fix the formula.

### Action/resource mis-consumption
- [ ] **#2 — Failed skill checks still have two actions available.** A failed skill check should still consume its action cost. Check `closeRollModal` / `consumeAction` for the skill-check path.
- [ ] **#3 — Sprint penalty not applied next round.** Failed Sprint Athletics check should reduce the next round's action budget by 1 (Winded). The Winded flag may not be reading into `activateUpdate` correctly — partly shipped earlier, verify.
- [ ] **#4 — Sprint log appears before Athletics check resolves.** Log timing is wrong. Sprint move-log and Athletics result should both land only after the roll completes.
- [ ] **#5 — AIM +2 CMod applies to NEXT attack only, then clears.** Verify aim bonus clears after any attack action fires (including failure) and only carries to the immediate next attack, not onward.

### Defer
- [ ] **#7 — Defer moves one step down only.** Not N steps, not to end of round. Current `deferInitiative` swaps with the next combatant; verify roll-swap doesn't move the deferring combatant further than one slot.

---

## TIER 2 — Confusion or unfair play. Fix after Tier 1.

- [ ] **#10 — Token lock after both actions used.** Once `actions_remaining === 0`, the player's token should be unmovable until their next turn.
- [ ] **#14 — READY WEAPON flow is too clunky.** Redesign the switch/reload/unjam modal for fewer clicks.
- [ ] **#15 — READY WEAPON immediately equips after loot.** When a weapon is looted, its row in Ready Weapon should offer a one-click equip.
- [ ] **#16 — Inventory / primary weapon / ready weapon interaction review.** The three are not working together cleanly. Full audit + unified source of truth.
- [ ] **#18 — Range-gated targeting + default closest.** Players can only target things in range, but CAN target everything in range. Default = closest valid. Partly shipped as `0e7da10` (closest-target default); extend to strict range gate.
- [ ] **#19 — Range band overlays are attacker-only.** Clicking an NPC or another player should NOT reveal range bands. Overlays belong to the currently-active combatant's view, not the inspected token.
- [ ] **#20 — NPC status visibility rules for players.** Players see: is the NPC armed. Players do NOT see: weapon name, WP/RP numbers, Winded/other conditions.
- [ ] **#25 — Token ownership enforcement.** A player's token is moveable only by that player (and the GM). Other players cannot drag it.
- [ ] **#24 — Token drag constrained to move distance.** Dragging a token cannot exceed the character's available move range for their current action.

---

## TIER 3 — Clarity & polish after core play works.

- [ ] **#21 — Incapacitation client outcome.** When a PC is incapacitated, define what the player sees and what they can do (view log, whisper GM, spectator mode?).
- [ ] **#22 — GM action grant / undo.** GM can grant an extra action to a character or undo a player's last action.
- [ ] **#23 — Add player to map mid-combat.** Support adding a PC to an already-running combat initiative (roll their init, insert in correct slot, activate on their turn).
- [ ] **#29 — Combat log redesign.** Roll20-style clean summary default with a toggle for full dice + modifier breakdown. Partly shipped as `19be121` (compact attack/aim lines with ▸ toggle). Extend to cover skill checks, sprint, stabilize, grapple, etc. and polish visual treatment.
- [ ] **#32 — Initiative tracker responsiveness.** Advancing turns feels slow — likely due to sequential DB writes in `nextTurn`. Batch writes where possible; reduce round-trips.
- [ ] **#27 — Player zoom sync to GM zoom.** When the GM zooms the tactical map, players' zoom follows.
- [ ] **#26 — Spacebar pan smoothness.** Current spacebar-pan is jerky. Use CSS transform or native scroll with requestAnimationFrame.
- [ ] **#17 — Grenade area logic.** Confirm blast-radius weapons apply attack logic to every valid target within the radius simultaneously. (Existing splash code needs audit.)

---

## TIER 4 — Quality of life, do last.

- [ ] **#34 — `/whisper GM`.** Slash command in chat to directly whisper the GM.
- [ ] **#30 — Portrait upload simplification.** Current flow is too many steps. Consolidate upload → crop → save.
- [ ] **#31 — Ping click-and-hold.** Ping becomes a long-press (hold) gesture rather than an accidental click.
- [ ] **#33 — General UI smoothness pass.** Catch-all for animation/transition polish across combat interactions.
- [ ] **#28 — Smooth token drag feel.** Constrained-but-smooth drag — probably requires interpolation and snap-to-grid on drop.

---

## Notes

- Several Tier 1 items overlap with fixes already shipped in the pre-Mongrels sprint (`6a06726`, `2744b8f`, `e2c3b7d`, `8df1042`). Re-verify each on the deployed site before coding — some may be "confirm working" rather than "fix from scratch."
- `#16` (inventory / primary weapon / ready weapon) is the biggest architectural piece in Tier 2 and will likely take multiple commits. Treat it as its own sub-epic.
- `#19`, `#20`, `#25` form a cluster around "what does a player see / control about NPCs and other PCs." Coordinate these so the permissions model is consistent.
