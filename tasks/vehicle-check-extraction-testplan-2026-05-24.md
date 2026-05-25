# Test plan - vehicle check extraction (Phase 1) + install/gather (Phase 2)

**Change:** the vehicle skill-check state machine moved out of `app/vehicle/page.tsx`
into a new hook `app/vehicle/useVehicleCheck.tsx`. Phase 1 is a PURE extraction
(zero behaviour change). Phase 2 (not yet built) adds install + gather checks.

**Why this needs a careful smoke:** the moved `rollCheck` owns the combat-adjacent
path - mounted-weapon attack damage resolution AND the initiative-action decrement.
A silent behaviour change there would only show up at the table mid-combat.

---

## Phase 1 - combat smoke (Xero, on the deployed build)

Automated proof already passed locally: `npx tsc --noEmit` clean, 639 unit tests
pass, font/role/em-dash/arch guardrails green. The smoke below confirms the live
behaviour is unchanged.

Open the vehicle popout for a vehicle that has a crew, a still (brew), and at
least one mounted weapon - **Minnie** in The Arena fits. Two browser clients
(GM + one player) so the attack's initiative decrement is observable.

1. **Driving check.** Assign a driver -> click the Driving check button -> Roll.
   - Expect: modal opens titled "Driving Check", AMOD = driver DEX, SMOD = driving
     level, the result classifies, and a `<name> - Drive - <vehicle>` line lands in
     the rolls feed. No fuel/supply change.
2. **Brew check.** Assign a brewer, ensure brewing supplies > 0 -> Brew check.
   - Toggle Mechanic* vs Tinkerer in the modal: AMOD/SMOD should swap (RSN+Mechanic
     vs DEX+Tinkerer). Roll a Success: fuel +1 day (capped), supplies -1, feed shows
     `<name> - Brew - <vehicle> (<skill>) <after>/<max>`.
   - Roll with supplies at 0 (or click before gathering): the "No brewing materials
     on hand" guard blocks the roll.
3. **Navigate check.** Assign a navigator -> Navigate check.
   - Default skill = Navigation (ACU). Switch the skill picker to e.g. Survival:
     AMOD/SMOD recompute to that skill. Roll: feed shows `<name> - Navigate - <vehicle> (<skill>)`.
4. **Mounted-weapon attack (the load-bearing one).** Put an NPC token on the active
   scene. Assign a shooter to the weapon -> click the weapon's attack button.
   - Target dropdown lists the scene NPCs; out-of-arc / out-of-range chips behave as
     before; the roll button blocks an out-of-arc target.
   - Roll a HIT on an in-arc target. Expect: weapon damage rolls, the target NPC's
     WP/RP drop by the mitigated amount (check the NPC card), the feed shows the
     attack + damage line, AND the shooter's `actions_remaining` decrements by 1. If
     that drops to 0, the table advances the turn.
   - Roll a MISS: "Miss (target unhurt)" badge, target WP/RP unchanged.

**Pass = every one of the above behaves exactly as it did before the extraction.**
If anything differs, STOP - revert is `git revert edb2032` (Phase 1 is its own
commit, behaviour-preserving, so reverting is invisible to players).

---

## Phase 2 - install/gather (build AFTER the Phase 1 smoke passes)

Will get its own section here once built. Expected checks: the `+ Install` button
opens an install skill-check (Mechanic*/Tinkerer toggle, all-crew roller dropdown);
the `+ Gather Materials` button opens a gather check (Scavenging); resolutions apply
the locked rulings (install Success/Wild/HI = +1 drum capacity; Failure/Low = drum
damaged + consumed; Dire = drum lost + 1 tank wasted. gather Wild = +2 days;
Success/HI = +1; Failure/Low/Dire = nothing, Dire adds a GM-narrative note).
