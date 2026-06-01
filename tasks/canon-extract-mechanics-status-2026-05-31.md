# Verify-first status sweep - 6 HP pickup mechanics (2026-05-31)

**Author:** Puffer, 2026-05-31, late session.
**Purpose:** apply the VERIFY-FIRST RULE from
[tasks/hp-pickup-mechanics-to-wire-2026-05-31.md](hp-pickup-mechanics-to-wire-2026-05-31.md)
to all six pickup items BEFORE HP picks any of them up. Stops HP from
re-implementing live behavior.
**Result:** 5 of 6 items are already SHIPPED to varying degrees. Only
**#1 Rest finish** has real un-shipped work. HP's queue collapses
dramatically.

## Method

For each item I grepped the named anchor file(s), read the live code,
confirmed any callers/wiring, ran the relevant unit tests, and noted
the ship commit hash where applicable.

## Item-by-item

### #1 REST / heal-over-time finish

**Status: PARTIALLY SHIPPED, 3 real gaps + 1 verify** - the original
canon-extract holds.

- Modal exists at `components/CharacterCard.tsx:1191-1273`.
- WP/RP math + clock advance + roll_log write all wired.
- **Gaps** (see [canon-extract-rest-2026-05-31.md](canon-extract-rest-2026-05-31.md)):
  Stress Cooling Off track not wired; Sick RP half-max cap not enforced;
  post-mortal `wasMortal` detection flips off prematurely (needs persistent
  flag on `character_states`); pending-heal +12h/+24h checkpoint firing
  is a verify pass.
- **HP action:** ship A+B+C as one commit per the canon-extract; E as
  separate verify pass.

### #2 VEHICLES-AS-COVER RDM bonus

**Status: SHIPPED `f264f7b`** ("feat(combat): vehicle-as-cover RDM
bonus on ranged attacks").

- `lib/vehicle-cover.ts` (99 lines) implements the canon spec exactly:
  size 1-2 = no bonus, size 3 = +1 RDM, size 4 = +2, size 5 = +3,
  size 6+ = +4 (capped). MDM unaffected. Footprint-detection via AABB.
- **Wired into the live combat path:** `lib/table-roll-context.ts:277`
  calls `vehicleCoverRdm()` and adds the result to the CMod stack as
  `vehicleCover: -cover.bonus` with breakdown label
  `"Vehicle cover RDM ({name}, size {size})"`.
- **12 unit tests** in `tests/lib/vehicle-cover.test.ts` (all green
  on the 822-test baseline).
- **What's deferred** (explicit in the lib comment at :12-16): the
  "behind it relative to the attacker" LoS-trace case. Lib only handles
  PC-on-the-vehicle-footprint. The behind-cover line-of-sight case
  needs Bresenham + segment intersection vs the vehicle footprint and
  has "canon-consultation territory" notes about exact 'behind'
  semantics. Tag for follow-up if Xero confirms the LoS-cover case
  needs to ship for KS, otherwise leave as known deferred.
- **HP action:** mark item DONE in todo. NO new work on this for KS
  unless Xero specifically requests the LoS-cover case.

### #3 ITEM CONDITION + Upkeep Check completeness

**Status: SHIPPED + WIRED `724a1e2`** ("refactor(upkeep): extract pure
transition + 33 unit tests").

- **UI:** `components/CharacterCard.tsx:1005-1025` has the "Upkeep
  Check" button per weapon (uses the best of Mechanic / Tinkerer /
  weapon-skill).
- **Outcome handler:** `lib/roll-helpers.ts:577-585` matches the
  `Upkeep - <weaponName>` roll label and produces the narrative
  ("fails to upkeep ... degrades", "irreparably damages ... while
  performing upkeep"). Lib comment says state degradation is "applied
  inline by executeRoll's upkeep block."
- **`tests/lib/upkeep.test.ts` has 33 tests** covering state
  transitions, edge cases, and the Wild Success cap-at-Used rule.
- **What's wired:** Pristine -> Used -> Worn -> Damaged -> Broken
  transitions; Wild Success cap; Failure step-down; Dire Failure break.
- **What may still be loose:** confirm Broken weapons actually REFUSE
  to fire in the live combat path (not just narrated). Spot-check the
  weapon-attack click-handler for a condition gate. This is a 15-min
  verify, not a build.
- **HP action:** spot-check the Broken-weapon-refuses-to-fire gate
  in `app/stories/[id]/table/page.tsx` weapon attack handler. If it's
  there, mark DONE. If not, add the one-line condition check.

### #4 FALLING / DROWNING / SUBSISTENCE damage

**Status: SHIPPED + WIRED `1b5b958`** ("feat(env-damage): Falling +
Drowning helpers + Env Dmg button") + Subsistence drainer in
`lib/campaign-clock.ts:92`.

- `lib/env-damage.ts` ships all three formulas: Falling (3 WP + 3 RP
  per 10 ft), Drowning (hold breath = 6 + PHY AMod rounds, then 3 WP +
  3 RP per round), Subsistence (1 WP + 1 RP per day past day 2).
- **Wired into UI:** TWO Env Damage buttons on CharacterCard:
  - `:528` - "Env. Damage" button (Reduce Stress / Env Damage / Rest
    trio - the original)
  - `:631` - "Env Dmg" alternate surface (newer; matches the
    [project_falling_canon] memory pattern with kind: 'falling' |
    'drowning' tagged on the roll_log row)
  - Probably one is legacy / per a UI refactor - HP can decide whether
    to consolidate to one button.
- **Subsistence auto-drains** via `drainSubsistenceDamage` called on
  every clock advance (`lib/campaign-clock.ts:92` and the implementation
  at `:244+`). Tracks `last_subsistence_day` per character to avoid
  double-counting.
- **28 unit tests** in `tests/lib/env-damage.test.ts`.
- **HP action:** mark item DONE. Optional polish: consolidate the two
  Env Damage buttons into one (Xero confirm which surface he wants
  authoritative). Not a KS blocker.

### #5 TRAVEL TIMES subsystem

**Status: SHIPPED + WIRED `e7b1e56`** ("feat(travel): push-past-8h
costs RP + advances clock").

- `lib/travel.ts` implements the canon: 8h soft-cap, then 1 RP per
  push hour. Returns `{ rpCost, pushHours }` for feed-row labelling.
- **Wired into UI:** `components/CharacterCard.tsx:642` calls
  `travelPushCost(hours)` from a Travel action handler. Drops RP, the
  CharacterCard's update path applies the new stat.
- **`tests/lib/travel.test.ts` has 10 tests** covering the soft-cap
  threshold, push math, NaN/negative floor, and edge cases.
- **What's missing for full KS:** the GM affordance for "travel from
  the campaign map" (route-planner integrated) is NOT this lib's job;
  this lib + the CharacterCard Travel button are the bottom layer.
  The campaign-map route-planner is a separate UX surface and may
  already exist independently (separate audit needed if it does).
- **HP action:** mark mechanic DONE. Verify the campaign-map
  route-planner uses `travelPushCost()` when planning multi-hour
  routes; if it doesn't, that's a small wiring task (~30 min). If
  campaign-map doesn't even have a route-planner, that's a separate
  feature (out of this pickup's scope).

### #6 CONDITIONS PHASE-2

**Status: WRONG PREMISE, already documented as DEFERRED.**

Per the existing todo.md entry (line 15 today): canon §06 Combat has
FIVE conditions (incapacitation, mortally wounded, stress, lasting
wounds, infection). `lib/conditions.ts` Phase-1 already covers all
five. There are no D&D-style enum stubs in the code (Bleeding/Stunned/
Frightened/Charmed/Restrained/Prone). Tapestry combat does NOT use
that condition model.

The "Phase-2" the file's own comment describes is a CALL-SITE ROUTING
REFACTOR (~9 inline `Math.max(1, 4-phyMod)` / `Math.min(5, cur+1)`
sites -> thin writer fns over ConditionTarget). That's multi-day
cohesion cleanup with zero player-facing impact - **DEFERRED post-KS.**

**HP action:** no action. Item #6 is already correctly tagged in
todo.md as a wrong-premise pickup (line 15). Verify-first surfaced no
real work.

## Summary scorecard

| # | Item | Status | HP action |
|---|---|---|---|
| 1 | Rest finish | PARTIAL - 3 gaps + 1 verify | ship per canon-extract |
| 2 | Vehicles-as-Cover RDM | **SHIPPED** `f264f7b` | mark DONE |
| 3 | Item Condition + Upkeep | **SHIPPED** `724a1e2` (verify Broken-refuses-fire) | spot-check, then DONE |
| 4 | Falling/Drowning/Subsistence | **SHIPPED** `1b5b958` + clock drainer | mark DONE |
| 5 | Travel Times | **SHIPPED** `e7b1e56` | verify route-planner uses it, then DONE |
| 6 | Conditions Phase-2 | WRONG PREMISE (deferred post-KS) | no action |

**Net: HP has ONE real build pickup remaining** for the 9/1 KS bucket
2 mechanics queue: Rest finish (3 gaps, per canon-extract). Items 2,
3, 4, 5 collapse to verify-and-mark-done.

## Path forward

1. HP picks up Rest finish per
   [canon-extract-rest-2026-05-31.md](canon-extract-rest-2026-05-31.md).
   This is the only real build.
2. HP does the three small verify passes (Broken-weapon-refuses-fire,
   campaign-map route-planner uses `travelPushCost`, two Env Damage
   buttons reconciled). Each is a 15-30 min verify, not a build.
3. Items 2 and 4 mark DONE in the original HP pickup doc + todo.md
   the moment HP confirms acceptance.

This sweep dramatically advances the 9/1 KS readiness picture - the
"6 mechanics still owe real code" mental model from the road-to-1.0
doc was based on the pickup doc's pre-verify-first state. Reality is
**1 mechanic + 3 verifies + 1 (Rest) actual build**.

## Tracking

Update [tasks/hp-pickup-mechanics-to-wire-2026-05-31.md](hp-pickup-mechanics-to-wire-2026-05-31.md)
in place with the verify-first findings (commit hashes + status flags
per item). Update [todo.md](todo.md) to mark items 2/4/5 as
SHIPPED-VERIFIED and #3 as SHIPPED-pending-spotcheck.
