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
- [x] **#11 — Invite link choked at login.** New users following an invite link hit the login page and lose the invite context. Preserve the target path across signup/login so the invite flow actually works for new users. *Shipped: (1) login + signup read `?redirect=/path` (safe-relative-only guard), honor it on submit, and forward it across Sign-up / Log-in cross-links; signup skips `/firsttimers` when a redirect is present. (2) `/join/[code]` now auth-gates on mount. (3) **ROOT CAUSE** — `LayoutShell.tsx`'s blanket "unauthenticated → push /login" was racing every page's own auth check and winning, pushing to a bare `/login` with no redirect param. Fixed LayoutShell to pass the current pathname (plus any query string) as `?redirect=` — now every protected page preserves destination through login automatically, not just `/join`.*
- [x] **#12 — `/welcome` traps new users.** Disable the `/welcome` redirect entirely until further notice. Let new users browse freely. *Shipped: commented out the `!profile.onboarded → router.push('/welcome')` line in `app/dashboard/page.tsx` (this was the only forced push into `/welcome` in the codebase). Restore comment left inline for when the new welcome flow is ready. `/welcome` page itself is still reachable via the Sidebar link and hasn't been removed.*
- [x] **#13 — Reload sends players to dashboard.** Reloading during a session redirects to `/dashboard` instead of returning the player to `/stories/[id]/table`. *Primarily already resolved by #11's `LayoutShell` fix (every protected-page bounce now preserves `?redirect=<path>`). Also hardened `/stories/[id]/table`'s own in-page auth check (line 561) to match the same redirect shape — belt-and-suspenders for race conditions where the table's useEffect runs before LayoutShell's auth check resolves. Table-page reloads now return to the same table after any re-auth.*

### Damage math
- [ ] **#1 — Damage calculation incorrect.** Reported: `2+2d6 (6) = 8 raw → should be 7 WP / 7 RP (1 mitigated)`. Confirm the formula (`base + dice + PHY bonus` → WP/RP with RP% and mitigation) across all weapons.

### Initiative order & enforcement
- [x] **#8 — Initiative order reversed for Knox/Koss.** Confirm sort order is roll-descending with stable secondary tiebreak. *Verified resolved by tonight's tiebreaker chain (`6a06726`, `2744b8f`, `4f9fab6`). Every sort site — the 3 DB queries, the 3 client-side sorts, the 2 log-serialization sorts — now uses `roll DESC, character_name ASC`. Knox < Koss alphabetically so Knox will always render first when tied.*
- [x] **#9 — Players went out of order.** Enforce strict initiative order; prevent off-turn players from acting. *Verified: `handleRollRequest` turn-gate (page.tsx:1990-2051) blocks any roll where the rolling character's name ≠ the active combatant's name, with bypass only for explicit Sprint Athletics / pre-consumed flows. Combined with tonight's `nextTurn` hardening (`6a06726` re-entry guard, `2744b8f` tiebreakers, `8df1042` multi-active self-heal), out-of-turn actions should be blocked in all paths. Flagging for re-verification in next playtest — if still happening, need a screenshot of the log sequence + who rolled when to diagnose further.*

### Dice logic
- [x] **#6 — Insight Dice 3d6 keeps all 3 (no drop).** Currently drops lowest. Per SRD, 3d6 keep-all (sum). *Shipped: `executeRoll`'s 3d6 branch used `.sort().slice(0,2)` to drop the lowest — changed to sum all three dice (`die1 = d1`, `die2 = d2+d3` to fit the existing two-column storage; total still comes out right). Added `skipInsightPair` optional arg to `getOutcome` so a coincidental d1=6, d2+d3=6 doesn't spuriously award a second Insight Die on a roll that already spent one. UI button relabeled "Keep all 3". Progression log now shows individual dice values.*

### Action/resource mis-consumption
- [ ] **#2 — Failed skill checks still have two actions available.** A failed skill check should still consume its action cost. Check `closeRollModal` / `consumeAction` for the skill-check path. *Traced — `closeRollModal` at page.tsx:2955 consumes action when `didRoll && combatActive && !preConsumed`, regardless of success/failure outcome. `executeRoll` sets `rollExecutedRef.current=true` at line 2185 before the outcome is even computed, so failure vs success doesn't affect consumption. On paper the code is correct; need a repro (specific character, skill, outcome, and what `[consumeAction]` console log showed) from next playtest to find the real gap.*
- [x] **#3 — Sprint penalty not applied next round.** Failed Sprint Athletics check should reduce the next round's action budget by 1 (Winded). *Root cause found: new-round reroll at page.tsx:1273 was resetting `winded: false` on every combatant at the top of the new round, wiping the penalty before `activateUpdate` (which reads `winded` and gives 1 action instead of 2) ever saw it. Fixed by removing `winded: false` from that reset — activateUpdate still clears the flag when the combatant is actually activated, so no one stays winded past one round. `inspired_this_round: false` left in place (it legitimately resets each round).*
- [x] **#4 — Sprint log appears before Athletics check resolves.** Log timing is wrong. Sprint move-log and Athletics result should both land only after the roll completes. *Fixed: `consumeAction` in the Sprint branch of `onMoveComplete` was passing `"<name> — Sprint"` as actionLabel, which writes a generic action log row BEFORE the Athletics roll modal even opens. Changed to `undefined` — now only the post-roll "🏃 <name> sprinted successfully — not winded" / "sprinted but is now winded" entry lands, with the correct outcome. Action consumption is unaffected (still fires via consumeAction's DB write).*
- [x] **#5 — AIM +2 CMod applies to NEXT attack only, then clears.** *Traced & partially fixed. The numeric `aim_bonus` was already cleared correctly by `consumeAction`'s `clearAim` branch after any roll with no actionLabel (i.e. any roll from `closeRollModal`). But the paired `aim_active` flag — which drives the "Aimed — Attack or lose it" badge — was left at `true` forever. Now the clearAim update clears both together, so the badge disappears the moment the attack resolves. CMod logic was already correct.*

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
