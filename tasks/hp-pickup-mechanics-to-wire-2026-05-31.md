# HP pickup - mechanics still to wire for 9/1 KS

Source for Xero to paste into HP. This doc is the durable copy.

---

> **VERIFY-FIRST SWEEP 2026-05-31 (Puffer): 5 of 6 items already SHIPPED.**
> Full audit: [tasks/canon-extract-mechanics-status-2026-05-31.md](canon-extract-mechanics-status-2026-05-31.md).
>
> | # | Status | Action |
> |---|---|---|
> | 1 Rest finish | PARTIAL - 3 gaps + 1 verify | ship per [canon-extract-rest-2026-05-31.md](canon-extract-rest-2026-05-31.md) |
> | 2 Vehicles-as-Cover RDM | **SHIPPED** `f264f7b` (12 tests) | mark DONE |
> | 3 Item Condition + Upkeep | **SHIPPED** `724a1e2` (33 tests) | spot-check Broken-weapon-refuses-fire, then DONE |
> | 4 Falling/Drowning/Subsistence | **SHIPPED** `1b5b958` + clock drainer (28 tests) | mark DONE |
> | 5 Travel Times | **SHIPPED** `e7b1e56` (10 tests) | verify route-planner uses it, then DONE |
> | 6 Conditions Phase-2 | WRONG PREMISE (deferred post-KS) | no action |
>
> Net HP pickup: **#1 Rest finish ONLY** + 3 small verify passes.
> The per-item text BELOW is the historical pre-verify-first brief -
> read alongside the audit doc.

---

```
HP pickup - "need real code" mechanics for 9/1 KS

NORTH STAR: tasks/north-star.md - TheTapestry stable/polished/fun for 9/1
Kickstarter. Per Puffer's stability audit + road-to-1.0 doc + canon roadmap
(tasks/roadmap.md), 6 mechanics still owe real code for KS bucket 2 ("finish
what's in flight"). Everything else for 9/1 is content/flow/presentation/
testing/ops (tasks/road-to-9-1-checklist.md).

PRECEDENCE for canon questions: Tapestry canon (lib/xse-schema.ts + app/rules/*
+ tasks/tapestry-rules-canon.md) > Quickstart > XSE SRD > CRB. Always walk
top-down; only reach for CRB if the upper three are silent.

VERIFY-FIRST RULE: half of these are partially shipped. For each one, grep
+ read the named anchor BEFORE drafting. Don't reimplement live behavior.

---

1. REST / heal-over-time finish
   What:    Currently a Phase-3 placeholder. The Rest button + modal already
            exist (components/CharacterCard.tsx:583 + :1056-1112 'Rest & Heal').
            Need the actual heal-over-time mechanic wired through to the
            campaign clock so a Rest action drains correctly + restores
            WP/RP per canon.
   Anchors: tasks/spec-healing.md (heal-over-time spec, READ THIS FIRST)
            tasks/spec-campaign-sheet.md (Rest as a campaign-clock action)
            lib/campaign-clock.ts (drainers + advancers)
            components/CharacterCard.tsx:1056 (modal already exists)
   Canon:   app/rules pages on healing + the Rest section in canon export
            (tasks/tapestry-rules-canon.md, grep "Rest" + "Heal")
   Verify:  what's already wired on the Rest button click today? (probably
            opens modal but doesn't actually heal/advance the clock cleanly).
   Accept:  GM clicks Rest -> WP/RP restore per canon formula + time advances
            per canon -> roll_log row -> visible on player + GM clients.

2. VEHICLES-AS-COVER bonus
   What:    Vehicle subsystem is LIVE (fuel storage Q4-c, brewing-supplies
            Q4-d, passenger-vanish, MOVE HERE, etc.). The cover-as-RDM bonus
            piece per CRB Ch. 08 p. 140 is NOT wired. Grep for "cover.*RDM"
            and "vehicleCover" returns zero hits.
   Spec:    Size 3 vehicle = +1 RDM, size 4 = +2, size 5 = +3, size 6 = +4.
            Applied to anyone whose token is on the vehicle's footprint OR
            behind it relative to the attacker (canon spec; consult app/rules
            for the exact "behind" semantics).
   Anchors: lib/damage.ts (DM stacking already there - add RDM contribution
            from vehicle cover)
            components/TacticalMap.tsx (vehicle footprint + grid math)
            tests/lib/damage.test.ts (extend with vehicle-cover RDM cases)
   Verify:  any existing cover-bonus path on the damage resolve? if yes,
            extend; if no, add as a new contributor to RDM.
   Accept:  PC behind a size 4 vehicle takes 2 less RDM on an incoming
            attack; the breakdown chip on the roll modal lists "+2 RDM
            (vehicle cover, size 4)"; unit tests cover sizes 1-2 (no bonus)
            through 6 (+4).

3. ITEM CONDITION + Upkeep Check completeness
   What:    Upkeep is PARTLY live - roll outcome handlers exist
            (lib/roll-helpers.ts:577-585: 'fails to upkeep ... degrades' +
            'irreparably damages ... while performing upkeep'). What's NOT
            obvious from a grep: whether the 5 condition states (Pristine /
            Used / Worn / Damaged / Broken) are tracked on the inventory
            item itself (data layer) and whether the Upkeep Check drains +
            transitions states per canon (Wild Success caps at Used, Failure
            drops one state, Dire Failure breaks).
   Anchors: tasks/spec-modules.md (inventory-related)
            lib/xse-schema.ts (item shape - check for `condition` field)
            lib/inventory.ts (inventory write paths)
            roll-helpers.ts:577 (existing Upkeep outcome handlers)
   Canon:   tasks/tapestry-rules-canon.md §07 (or wherever item-condition
            lives) + app/rules/equipment-and-loot pages
   Verify:  grep `Pristine|Used|Worn|Damaged|Broken` across data layer;
            check if the item jsonb shape carries a condition field; if not,
            the schema + UI both need it.
   Accept:  Upkeep Check on a weapon transitions its condition state per
            canon; the state is visible on the inventory tile; a Broken
            weapon refuses to fire (or whatever the canon penalty is);
            unit test covers state transitions on each outcome.

4. FALLING / DROWNING / SUBSISTENCE damage
   What:    Three small independent environmental-damage mechanics. None
            currently wired (no canon section exists, no GM affordance, no
            roll_log entries for them).
   Spec:    Falling: 3 WP + 3 RP per 10 ft fallen. Athletics Wild Success
                     may mitigate (Fill in the Gaps).
            Drowning: hold breath = 6 + PHY AMod rounds; afterwards 3 WP +
                     3 RP per round; cumulative -1 CMod on resist checks.
            Subsistence: 1 WP + 1 RP per day past day 2 without food/water.
                     Recovery 1 WP + 1 RP per day once food restored.
   Anchors: tasks/spec-healing.md (drain/restore patterns to mirror)
            lib/campaign-clock.ts (subsistence drain rides the clock tick)
            CRB Ch. 07 pp. 116-117 for the exact numbers
   Pattern: GM-button driven (mirror the Infection canon pattern - memory
            project_infection_canon - GM applies the damage via a modal,
            damage_json carries the kind: 'falling' | 'drowning' |
            'subsistence' for feed disambiguation).
   Accept:  Three new modal actions on CharacterCard (Apply Falling /
            Drowning / Subsistence damage); each writes a tagged roll_log
            row; Subsistence drainer fires on every clock tick past day 2;
            unit tests cover the three formulas + the recovery path.

5. TRAVEL TIMES subsystem
   What:    Overland-travel endurance. Not wired today.
   Spec:    8h travel + 8h rest + 8h sleep cycle. Pushing past 8h = 1 RP
            per additional hour. Drop to 0 RP -> Incapacitated.
   Anchors: lib/campaign-clock.ts (advance + drainers - this is its home)
            tasks/spec-campaign-sheet.md (travel as a campaign-clock action)
            CRB Ch. 08 p. 142
   Question for design: is travel a GM-button action ("Travel X hours")
            on the campaign sheet, or a passive cost the GM declares? The
            cleanest implementation is probably: GM picks a destination on
            the campaign map (route planner already exists), then a Travel
            action drains time + RP per canon, with an optional "push past
            8h" toggle.
   Accept:  Travel action on the campaign sheet advances the clock by the
            specified hours, drains 1 RP per push-hour, triggers Incap on
            RP=0 entry; roll_log row written; unit test covers the math.

6. CONDITIONS PHASE-2
   What:    Phase-1 of the conditions system is live (Bleeding, Stunned,
            etc. per lib/conditions.ts + tests/lib/conditions.test.ts).
            Phase-2 fills in canon gaps - exact scope owed from a spec
            walk. Probably includes the "less obvious" status effects + the
            end-of-combat cleanup pass + any cross-condition stacking rules.
   Anchors: lib/conditions.ts (Phase-1 implementation)
            tests/lib/conditions.test.ts (Phase-1 tests)
            app/rules/conditions page (canon source)
            tasks/tapestry-rules-canon.md condition sections
   Verify:  diff what's in lib/conditions.ts against the canon conditions
            list (app/rules) - the gap IS Phase-2. Likely some combination
            of: Exhausted, Sickened, Frightened, Charmed, Restrained,
            Prone-as-canon, etc. Some may already exist as enum members
            with no behavior wired.
   Accept:  every condition named in canon has a clearedConditionFields
            entry, an apply path (modal or auto-trigger), and unit-test
            coverage of stacking + clearing.

---

PRIORITY ORDER (recommended, Puffer read):
1. REST FINISH (item 1) - highest table-loop impact; everything else can
   wait if combat works smoothly but Rest is broken.
2. VEHICLES-AS-COVER (item 2) - small additive, clean spec, no schema
   churn; ships in a day.
3. ITEM CONDITION COMPLETENESS (item 3) - verify first; might be 80%
   shipped (Upkeep outcome handlers exist). If only the data-layer
   condition field is missing, ~half-day. If the whole state machine
   needs wiring, multi-day.
4. CONDITIONS PHASE-2 (item 6) - diff against canon first to scope.
5. ENVIRONMENTAL DAMAGE TRIO (item 4) - small, isolated; can ship as one
   batch with three modal actions.
6. TRAVEL TIMES (item 5) - lowest table-loop impact; only matters once
   overland-travel scenarios are in active play.

DROP THESE INTO TODO with `[ROUTED -> HUNT & PECK]` prefix:
  - HP mechanics #1 REST FINISH (link to tasks/spec-healing.md)
  - HP mechanics #2 VEHICLES-AS-COVER (+ unit tests)
  - HP mechanics #3 ITEM CONDITION verify-then-complete
  - HP mechanics #4 ENV DAMAGE TRIO (Falling / Drowning / Subsistence)
  - HP mechanics #5 TRAVEL TIMES
  - HP mechanics #6 CONDITIONS PHASE-2 (scope first, then ship)

WHEN YOU SHIP EACH:
1. Commit on lane/hunt-peck, push origin HEAD:main, rebase on non-ff.
2. Add a unit test (tests/lib/*.test.ts) for the new logic if pure.
3. Update tasks/tapestry-rules-canon.md if the implementation drifted
   from canon OR if you're promoting new mechanics to canon (run
   `npx tsx scripts/export-canon.ts > tasks/tapestry-rules-canon.md`).
4. Ping Puffer + E2E on the merge so we sync the Risk Register +
   add an E2E happy-path if applicable.

NORTH STAR REMINDER: every commit ladders up to "stable/polished/fun for
9/1 KS". If a mechanic feels half-baked for KS, ship the most-complete
slice that doesn't break combat + park the rest with a TODO comment +
spec note. KS bar is RELIABILITY over completeness.
```

---

## Tracking

When HP picks this up, the parent line goes to `tasks/todo.md` CURRENT OPEN as:

```
- [ ] **[ROUTED -> HUNT & PECK 2026-05-31] mechanics still to wire for 9/1 KS.** Full pickup block: [tasks/hp-pickup-mechanics-to-wire-2026-05-31.md](hp-pickup-mechanics-to-wire-2026-05-31.md). 6 items: Rest finish, Vehicles-as-Cover, Item Condition completeness, env damage trio (Falling/Drowning/Subsistence), Travel Times, Conditions phase-2. Priority order in the block; verify-first asked on items 1/3/6 (partial shipped state).
```
