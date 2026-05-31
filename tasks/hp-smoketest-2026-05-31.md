# HP smoketest - 2026-05-31

Cumulative smoketest covering every HP commit shipped today against Puffer's
6-mechanics pickup ([tasks/hp-pickup-mechanics-to-wire-2026-05-31.md](hp-pickup-mechanics-to-wire-2026-05-31.md)).
Run cold: hard-refresh both browsers onto prod first.

## Items in this smoketest

| # | Item | Commit | Status |
|---|---|---|---|
| 1 | REST FINISH | `2ea7aaf` | shipped |
| 2 | VEHICLES-AS-COVER | `f264f7b` | shipped |
| 3 | ITEM CONDITION + Upkeep tests | (next push) | shipped (refactor + tests; behavior unchanged) |

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
