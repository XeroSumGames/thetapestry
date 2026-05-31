# HP smoketest - 2026-05-31

Cumulative smoketest covering every HP commit shipped today against Puffer's
6-mechanics pickup ([tasks/hp-pickup-mechanics-to-wire-2026-05-31.md](hp-pickup-mechanics-to-wire-2026-05-31.md)).
Run cold: hard-refresh both browsers onto prod first.

## Items in this smoketest

| # | Item | Commit | Status |
|---|---|---|---|
| 1 | REST FINISH | `2ea7aaf` | shipped |
| 2 | VEHICLES-AS-COVER | `f264f7b` | shipped |
| 3 | ITEM CONDITION + Upkeep tests | `724a1e2` | shipped (refactor + tests; behavior unchanged) |
| 4 | CONDITIONS PHASE-2 | (no commit) | VERIFY-FIRST: no work needed (see todo) |
| 5 | ENV DAMAGE TRIO | `1b5b958` | shipped (Falling + Drowning helpers + Env Dmg button; Subsistence already on clock) |
| 6 | TRAVEL TIMES | (next push) | shipped (push cost helper + Travel button + clock advance) |

---

## #1 - Rest button advances clock + writes feed row

**Setup:** GM + player both in a campaign session. GM opens any PC card (Cree
works; the character should ideally have less than max RP so you can see the
heal land).

**Run:**
1. GM clicks **Rest** on the PC card.
2. Enter `8` in the Hours field.
3. Confirm preview shows `WP healed: +0` and `RP recovered: +8` (assuming
   character was never mortally wounded; if was-MW, WP heals at 1 per 2 days).
4. Click **Apply Healing**.

**PASS criteria:**
- Character's RP bar jumps up by 8 (or to max).
- Roll feed on BOTH GM + player shows:
  - System row "Time advances 8 hours" (from clock advance).
  - Character row "Cree rested 8 hours (+8 RP, +0 WP)".
- Campaign clock display (campaign sheet) advances 8 hours.
- If any character has a pending Medicine\* heal queued that crosses the +12h
  or +24h boundary, the heal applies on the same tick (per existing drainer).

**FAIL clues:**
- RP bar updates but no clock advance -> import path on `advanceClock` broke.
- RP bar updates but no roll_log row -> `insertRollLog` failed; check console
  for `[rest] clock advance / log insert failed`.
- Player tab doesn't see the new rows -> realtime sync issue (NOT a rest
  fix; check `tactical_shared` / scene state).

**Known edge:**
- One PC's Rest advances the WHOLE campaign clock. If the party rests
  together, only ONE PC should click Rest to avoid double-counting.
- If multiple click in succession, manually rewind the clock via
  `npx supabase db query --linked "UPDATE campaigns SET clock = jsonb_build_object('canon_day', X, 'hour', Y) WHERE id = '<campaign>'"`.

---

## #2 - Vehicle-as-cover RDM bonus on ranged attacks

**Setup:**
- An active campaign with at least one vehicle in the roster (any of the
  pre-built ones is fine - e.g. Mongrels' truck).
- A tactical scene with the vehicle PLACED as an object token. The vehicle
  token should have its multi-cell footprint set (e.g. a Truck is typically
  `grid_w=4, grid_h=2`).
- A PC sitting ON the vehicle's footprint (any cell the truck occupies).
- An attacker (PC or NPC) elsewhere on the map with a RANGED weapon equipped.
- Combat active (Start Session + Start Combat).

**Run:**
1. Attacker's turn. Open the attack modal and pick the on-truck PC as target.
2. Look at the CMod breakdown chip on the modal.

**PASS criteria:**
- Breakdown shows a `Vehicle cover RDM (<vehicleName>, size N)` line with
  a NEGATIVE value (the bonus subtracts from the attacker's to-hit).
- For Size 3 truck: line value = `-1`. Size 4: `-2`. Size 5: `-3`. Size 6: `-4`.
- The CMod net total reflects the subtraction (compare a swap to a target
  NOT on the footprint - that line disappears).
- A MELEE attack against the same on-truck target should NOT show the
  vehicle-cover line (ranged-only per canon).
- If the PC steps OFF the footprint (next turn), the cover line disappears.

**FAIL clues:**
- Line doesn't appear at all -> check the `vehicles` array is being passed
  through `cmodCtx()` (page.tsx ~line 4400); check the PC token's
  `grid_x`/`grid_y` are reaching `mapTokens` (TacticalMap.tsx
  `onTokensUpdate` projection includes `grid_w`/`grid_h`).
- Line appears with `+N` instead of `-N` -> the sign got flipped in
  `computeAttackCmod`; the value should be `-cover.bonus` (cover lowers
  attacker's to-hit).
- Line appears on melee attacks -> the `isMelee` guard regressed in
  `computeAttackCmod`.
- Smaller vehicles still grant cover -> the size threshold check
  (`size < 3`) in `vehicleCoverRdm` regressed.

**Known edge / deferred to follow-up:**
- "Behind the vehicle relative to the attacker" (line-of-attack passes
  through the footprint) is NOT in this ship - footprint-only. The spec
  flags `behind` as needing canon LOS semantics consultation. Add a
  follow-up E2E + helper case when canon is locked.
- Vehicle damage state / wreckage doesn't currently degrade the cover
  bonus. A canon-aligned wreck rule could degrade by stress level.

---

## #3 - Item Condition + Upkeep Check (verify-first - mostly already shipped)

**What turned out to be already shipped:**
- ItemCondition type with 5 states (Pristine -> Used -> Worn -> Damaged -> Broken)
- `condition` field on weaponPrimary / weaponSecondary slots
- Upkeep Check button on the CharacterCard weapon admin row
- Full state-machine transitions in useRollResolution (Wild Success / High
  Insight improve capped at Used; Failure degrades; Dire Failure breaks;
  Low Insight breaks + 1 WP damage to character)
- Condition selector visible on the inventory tile
- Attack button DISABLED with "Weapon Broken" label when condition='Broken'
- Unjam/Repair parallel paths also wired

**What I shipped today:**
- Extracted the inline upkeep transition into `lib/upkeep.ts` as a pure
  function (`upkeepTransition`), behavior-preserving.
- 33 unit tests covering every outcome (6) x condition (5) combination,
  plus the breakWP/message side effects and the defensive-fallback for
  unknown condition strings.
- Refactored `useRollResolution.ts` to call the helper (no behavior change).

**Setup:** Combat session, PC with a non-Unarmed weapon equipped at some
known condition (e.g. set to 'Worn' via the condition dropdown on the
weapon slot).

**Run:**
1. PC's turn. Click `Upkeep Check` on the weapon admin row.
2. Pick a roller (any character with Mechanic*/Tinkerer/weapon-skill).
3. Set the dice / SMod to a known value to force each outcome and confirm:

**PASS criteria (run each outcome at least once):**
- **Wild Success:** condition improves 1 level (e.g. Worn -> Used); banner
  says "Condition improved by 1 level". Used stays at Used (floor).
- **High Insight:** condition improves 2 levels (Damaged -> Used); banner
  says "Condition improved by 2 levels". Worn -> Used (floor cap).
- **Success:** no change to condition; banner says "No change to condition".
- **Failure:** condition degrades 1 level (Worn -> Damaged); banner says
  "Condition degraded by 1 level". Broken stays at Broken (ceiling).
- **Dire Failure:** condition jumps to Broken regardless of starting state;
  banner says "Item breaks immediately!".
- **Low Insight:** condition jumps to Broken + PC takes 1 WP damage; banner
  says "Item breaks immediately! 1 WP damage." + a Stress row if the WP hit
  causes a Mortal Wound.
- After Dire Failure / Low Insight on a starting Damaged weapon, the
  `Attack with X` button disables and shows "Weapon Broken".

**FAIL clues:**
- Condition doesn't change after roll resolves -> the `transition.next`
  write to characters.data path regressed.
- Low Insight doesn't apply WP damage -> the breakWP branch regressed
  (or `myEntry.liveState` is null - check the state is loaded).
- Wild Success from Used moves to Pristine -> the Math.max(1, ...) floor
  regressed; Used is the cap per canon.

---

## #5 - Environmental damage (Falling + Drowning; Subsistence already shipped)

**Verify-first finding:** Subsistence is already fully wired - auto-drains
via the campaign-clock tick (`lib/campaign-clock.ts:drainSubsistenceDamage`,
fires on every advance past day 2 without food). Only Falling + Drowning
were net-new today.

**What I shipped:**
- `lib/env-damage.ts` with pure formulas: `fallingDamage(feetFallen)`,
  `holdBreathRounds(phyAmod)`, `drowningDamage(phyAmod, submergedRounds)`,
  `drowningResistCmod(phyAmod, submergedRounds)`, `subsistenceRecovery(...)`.
- 25 unit tests covering canon edge cases (under-10 ft = 0, hold-breath
  window math, cumulative resist CMod, recovery caps at max).
- New `Env Dmg` button on the CharacterCard combat-toolbar row.
- New OUTCOME tags `falling` + `drowning` so feed rows render with their
  own outcome class.

**Setup:** PC in a campaign session with less than max WP/RP so you can see
the damage land. GM has the PC card open.

**Run:**
1. Click `Env Dmg` button (between Infection and Rest).
2. Modal prompt: enter `1` for Falling.
3. Modal prompt: enter `25` for feet fallen.
4. Click OK.

**PASS criteria (Falling):**
- Character's WP drops by 6 and RP drops by 6 (25 ft = 2 segments of 10 ft = 6/6).
- Roll feed shows: `Cree fell 25 ft (-6 WP, -6 RP)` with `outcome='falling'`.
- 0-9 ft input results in no damage (under threshold).
- If the damage drops WP to 0, the mortal-wound auto-fill should NOT
  trigger (this path uses onStatUpdate which is fire-and-forget; the death
  countdown + stress would need the Apply Damage RPC path for full
  cascade - flagged as a known edge below).

**Run (Drowning):**
1. Click `Env Dmg`.
2. Enter `2` for Drowning.
3. Enter `8` for rounds submerged (PC at PHY 0 has a 6-round hold-breath window).

**PASS criteria (Drowning):**
- Window = 6 + PHY AMod rounds. At PHY 0, window = 6.
- Within window (rounds <= window): no damage; feed says "held breath N
  rounds (within X-round window; no damage)".
- 1 round past = 3 WP + 3 RP.
- 8 rounds at PHY 0 = (8-6) * 3 = 6 WP + 6 RP.
- A PC with PHY +2 has window 8, so 8 rounds = 0 damage.

**FAIL clues:**
- Damage doesn't apply -> `onStatUpdate` not called; check the modal
  prompt cancel path doesn't swallow the click.
- Wrong amount -> formula regression in `lib/env-damage.ts`; the 25 unit
  tests should catch this.
- No feed row -> `insertRollLog` failed; check console for
  `[env-damage] log insert failed`.

**Known edges / follow-ups:**
- WP drop to 0 via env damage does NOT trigger the mortal-wound auto-fill
  (death_countdown + stress) the way the gm_apply_damage RPC does.
  Manually set death_countdown via the GM tools if needed, or follow up
  with an extended RPC that accepts a damage kind tag.
- Drowning resist CMod (-1 per round past window) is NOT auto-applied
  to subsequent roll modals - the GM enters it manually in the CMod
  field. Surfacing it as an auto-source on resist checks is a follow-up.
- Athletics Wild Success "Fill in the Gaps" mitigation on falls is a GM
  judgement call, not auto-applied.

---

## #6 - Travel Times (push-past-8h costs RP, advances clock)

**Spec recap:** standard cycle = 8h travel + 8h rest + 8h sleep = 24h, no RP
cost. Pushing past 8h of contiguous travel costs 1 RP per additional hour.
0 RP drops to Incapacitated (existing incap path handles it).

**What I shipped:**
- `lib/travel.ts` with `travelPushCost(hours)` returning
  `{ rp, pushHours }`. 10 unit tests covering 0/exactly-8/9/12/16 hours,
  fractional inputs (floored), NaN/Infinity/negative defenses.
- New OUTCOME tag `travel`.
- New `Travel` button on the CharacterCard combat-toolbar (between
  Env Dmg and Rest). Prompts for hours; if > 8, drains RP, advances the
  campaign clock, writes a tagged feed row. Per-PC like Rest - the GM
  clicks for each character on a long haul.

**Setup:** PC in a campaign session with full or near-full RP, GM has the
PC card open.

**Run (within-cap):**
1. Click `Travel` on the PC card.
2. Enter `8` for hours.

**PASS criteria (within-cap):**
- No RP change (8 = cap).
- Campaign clock advances 8h.
- Feed row: `Cree traveled 8 hours (within the 8h soft cap; no RP cost)`
  with `outcome='travel'`.

**Run (push):**
1. Click `Travel`.
2. Enter `12` for hours.

**PASS criteria (push):**
- PC's RP drops by 4 (12 - 8 = 4 push hours).
- Campaign clock advances 12h.
- Feed row: `Cree pushed travel 12 hours (-4 RP for 4 hours past the 8h cap)`.
- If the RP hit drops the PC to 0, the next attempted action (or the
  existing incap path) should trigger the Incapacitated state.
- System "Time advances 12 hours" row also appears (from `advanceClock`).

**FAIL clues:**
- RP doesn't drain on 12h -> the `travelPushCost` import broke or the
  Math.floor regressed.
- Clock doesn't advance -> the `advanceClock` import path broke.
- Wrong push hours in label -> formula regression in `lib/travel.ts`; the
  10 unit tests should catch this.
- No feed row -> `insertRollLog` failed; check console for
  `[travel] clock advance / log insert failed`.

**Known edges / follow-ups:**
- Per-PC button means a 5-character party on a 12h haul = 5 clicks. A
  party-wide "Travel for the whole party" action on the campaign sheet
  is the natural follow-up; Puffer's spec flagged this as a design Q.
- The CampaignMap measure tool already shows travel-time estimates per
  mode (walking / bicycle / minnie). A future tie-in: pick a destination
  on the map, calculate the time from the route, and apply this same
  helper without a manual hour entry.
- Travel cost doesn't currently differentiate by transport mode (a
  vehicle ride is the same as foot travel). Per CRB a vehicle reduces
  the fatigue cost - follow-up when the vehicle-passenger mechanic
  surfaces a "you're a passenger" tag.
