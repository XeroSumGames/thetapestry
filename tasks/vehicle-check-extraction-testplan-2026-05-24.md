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

## Phase 2 - install/gather (SHIPPED 2026-05-24)

Automated proof: `tsc` clean, 639 unit tests pass (the rulings live in
`lib/vehicle-checks.ts` with 17 tests via `applyInstallOutcome`/`applyGatherOutcome`),
preview-sync green (feed parsers + preview HTML in lockstep). Browser eyeball owed
on the deploy - the dice outcomes can't be forced headless.

On Minnie (has both fuel storage + a still) in The Arena, as a campaign member:

1. **Install.** Ensure a 55-Gallon Drum is in cargo and capacity isn't at cap (else
   the `+ Install` button is correctly disabled). Click `+ Install`.
   - Modal "Install Fuel Drum" opens with a **roller dropdown listing the whole crew**
     (each shows `M* x / Tink y`) and a **Mechanic\*/Tinkerer toggle** that swaps AMOD/SMOD.
     Switching the roller recomputes both.
   - Roll a Success/Wild/HI: badge "Drum installed - +1 day of fuel storage", the Fuel
     Storage row shows one more drum installed, feed line `INSTALL <name> fits a fuel drum...`.
   - Roll a Failure/Low: badge "drum is damaged ... (lost)", drum count in cargo drops by
     one, no capacity gain.
   - Roll a Dire Failure: badge "drum is lost and a tank of methanol is wasted", `fuel_current`
     drops by 1 as well.
2. **Gather.** Ensure the stockpile isn't full (else `+ Gather Materials` is disabled).
   Click it.
   - Modal "Gather Materials" opens with the crew roller dropdown (each shows
     `Scavenging x`); no skill toggle (Scavenging only).
   - Roll Wild: badge "Gathered 2 days...", supplies +2 (capped). Success/HI: +1.
   - Roll Failure/Low: badge "nothing gathered". Dire: badge "nothing ... lost something or
     hurt themselves (GM adjudicates)", supplies unchanged.
   - Feed line `GATHER <name> scavenges...` per outcome.

Revert if wrong: the Phase 2 feature commit reverts cleanly; Phase 1's extraction stays.
