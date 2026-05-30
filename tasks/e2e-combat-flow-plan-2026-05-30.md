# Combat-flow (#10) E2E spec - planning doc (2026-05-30)

**Status:** PLAN ONLY. No spec code yet. The buildable phases are gated on two
Hunt & Peck deliverables (a damage hook + four testids); this doc scopes the
assertion shape so we can ship once those land. Source: `tasks/e2e-full-suite-build-plan-2026-05-24.md:96`
("`combat-flow.spec.ts` - Start Combat -> initiative bar -> attack -> result row
-> actions 2->1->0 -> auto nextTurn -> damage propagates -> CMod itemized").
North-star tag: closes a true Beta-500 floor item ("`[E2E+manual]` pre-beta
green light", `tasks/beta-500-readiness-2026-06-01.md`).

## What's already covered (do NOT duplicate)
- `e2e/section-a1-combat-start.spec.ts` - GM Start Combat -> player sees "IN
  COMBAT" live. Foundation; this plan supersedes/extends it.
- `e2e/section-a3-token-move.spec.ts` - token-move realtime refetch on the
  player. Pattern to reuse for combat-state propagation.
- 548 Vitest units in `tests/lib/*` own the MATH: `roll-helpers`, `damage`,
  `damage-payload`, `table-roll-context`, `roll-outcomes`, `conditions`,
  `initiative-actions`, `stabilize-helpers`. E2E asserts FLOW + outcome-class +
  structural shape, never a dice value.

## Assertion targets, split by automation level

### AUTOMATABLE NOW (REST/DB + DOM via existing selectors)
1. **Start Combat persists an `initiative_order` set.** GM clicks Start Combat
   on a throwaway campaign -> rows in `initiative_order` for the campaign, one
   per combatant, first marked `is_active=true`. Read via REST as the GM.
2. **`IN COMBAT` propagates to the player(s) live.** Pattern from
   `section-a1-combat-start` (page-wide text + a postgres_changes refetch).
3. **`character_states` row exists per combatant** (PC + NPC). Existence assert.
4. **End Combat teardown clears the set** (cascade-delete the throwaway campaign
   for zero residue, mirroring `communities-lifecycle.spec`/`session-lifecycle`).

### BLOCKED ON HP HOOK (a) - "GM sets damage = N"
Without a deterministic damage path, the attack outcome is dice-driven; the spec
can only assert flow shapes, not concrete values. The highest-value #10
assertions (damage propagates to owner, mortal-wound conditions trigger,
end-of-combat infection modal) all need a known-damage trigger.

**Proposed shape (mirrors `give_item_to_character`):** a SECURITY DEFINER RPC
`gm_apply_damage(p_campaign_id uuid, p_target_kind text /* 'pc' | 'npc' */,
p_target_id uuid, p_wp_damage int)` callable by the campaign GM. Atomically:
patches `character_states.wp_current` (or `campaign_npcs.wp_current` for NPCs),
runs the same condition pipeline the real attack runs (the `nextStress` /
`clearedConditionFields` calls in `lib/conditions.ts`), writes a `roll_log` row
with `damage_json.via='gm_apply'` so it's distinguishable from a real attack.
Authz: campaign GM only (RLS or in-function check).

Once that ships, these become deterministic:

5. **Damage propagates to owner (WP delta on `character_states`).** GM RPCs
   damage=`wp_max` to a target -> REST poll `character_states.wp_current` ==
   `wp_max - damage` AND `stress` bumped by 1 (per `nextStress`, cap 5) since
   crossing to 0. Player-side: the owner's table refetches via the realtime sub
   on `character_states`.
6. **Mortal-wound auto-fill stress** (per `tasks/operating-mode.md` canon +
   `lib/conditions.ts` `nextStress`): apply damage to take a PC to WP=0 -> +1
   stress pip, capped at `STRESS_CAP=5`. Read `character_states.stress` post-RPC.
7. **End-of-combat infection MODAL trigger** (Ch9.6-9.7). When combat ends, any
   PC that crossed WP=0 with the wound-infection flag set in their last damage
   row gets the infection modal on the OWNER'S client (and only the owner's).
   `damage_json` carries the flag; the unit suite covers the resolver math; E2E
   asserts modal-renders-on-owner / not-on-other-players. Currently the
   build-plan splits this as #20 `combat-infection.spec`; recommend folding into
   `combat-flow.spec` once the hook makes both buildable (single fixture).

### BLOCKED ON HP TESTIDS (b)
For the action-decrement + auto-nextTurn assertions, we need to reliably target
specific initiative-bar rows + roll-feed rows from the DOM under load. Testid
policy A (`tasks/active-lanes.md` 2026-05-24): flag FIRST, ship as a SEPARATE
HP commit, then E2E consumes. Proposed names:

- `data-testid="initiative-row-<entryId>"` on each `components/InitiativeBar`
  row (`entryId` = `initiative_order.id`).
- `data-testid="initiative-row-active"` (or a stable `aria-current="true"`) on
  the active row, so the test finds it without computing the rotation.
- `data-testid="roll-feed-row-<rollId>"` on each roll-feed row (`rollId` =
  `roll_log.id`). The roll-log row is REST-queryable too, so this testid is
  optional - only needed if a DOM-presence assertion proves more robust than
  REST-poll under load.
- `data-testid="roll-feed-attack-result"` as a class-marker on attack-result
  rows (so filtering doesn't depend on label text).

Once these land, automatable:

8. **Action decrement -> auto nextTurn.** Drive: REST `PATCH
   /initiative_order?id=eq.<active>.actions_remaining=0` (or click the action
   buttons in the DOM if testids land). Expected: a turn-advance broadcast +
   `is_active` flips to the next row. Assert: GM + player both see the new
   active row via DOM (the testid) AND REST.
9. **Initiative-bar ordering** (GM + player). Same row order, same active row,
   on both clients. Assert via the row-testids.

### STAYS MANUAL (canvas / visual)
- Roll-modal animation + timing.
- Initiative-bar visual transitions on turn advance (the layout is what we
  assert via testid presence; the *animation* is canvas-coupled).
- CMod display-chip rendering (math + the breakdown shape are unit-covered).
- The "feel" of the combat loop. The 2026-05-25 Minnie playtest is the smoke;
  this spec is the standing regression net.

## REST / DB endpoints to leverage
| What | Endpoint | Used for |
|---|---|---|
| Combat state | `GET /rest/v1/initiative_order?campaign_id=eq.<id>&order=position` | active row, ordering, action counts |
| Damage state (PC) | `GET /rest/v1/character_states?character_id=eq.<id>` | WP/RP/stress post-damage |
| Damage state (NPC) | `GET /rest/v1/campaign_npcs?id=eq.<id>` | WP_current/stress post-damage |
| Roll evidence | `GET /rest/v1/roll_log?campaign_id=eq.<id>&order=created_at.desc&limit=N` | post-attack result rows |
| GM apply damage | `POST /rest/v1/rpc/gm_apply_damage` (proposed) | deterministic damage trigger |
| End combat | DOM End Combat button (existing) | teardown trigger; cascade clears `initiative_order` |

## Fixture / teardown shape
- **Throwaway campaign**, not the Arena (Start Combat mutates initiative +
  character_states the Arena would carry across runs; cascade-delete at end is
  the clean teardown - same pattern as `session-lifecycle` /
  `communities-lifecycle`).
- Seed: GM + 1 PC member for the basic flow; add a second context
  (`percy`/`pesky`) for the multi-player propagation + owner-only-infection-
  modal assertions.
- End Combat in `finally` BEFORE the cascade-delete (so post-combat state is
  consistent on the off chance the delete races).

## Realtime propagation pattern
`initiative_order`, `character_states`, `roll_log` are all in the realtime
publication. Use the `section-a3` pattern: arm `page.waitForResponse` for the
expected GET refetch on the player context, mutate as GM, await the refetch.
This is robust + isolated from canvas-render coupling.

## Phasing - actual build order

| Phase | Coverage | Gating |
|---|---|---|
| **A** | Start Combat -> initiative_order rows + player IN-COMBAT (DB + DOM); End Combat teardown | UNBLOCKED |
| **B** | Initiative-bar DOM ordering/active row on GM + player; REST-driven action decrement -> nextTurn | After HP testids (b) |
| **C** | Deterministic damage -> WP/RP/stress chain; mortal-wound auto-fill; CMod breakdown shape; end-of-combat infection modal (owner-only) | After HP RPC (a) |

Build Phase A standalone if HP is far from (a)/(b) - it's already a strict
superset of `section-a1` and immediately closes the "[E2E+manual] pre-beta
green light" item for the Start-Combat slice.

## Open questions
1. **HP** - shape of the damage hook. RPC mirroring `give_item_to_character` is
   the recommendation (cleanest for E2E + matches the existing pattern). If a
   query-param/dev-mode button is preferred for prod-debugging reasons, that
   works too - confirm.
2. **HP** - the four testid names above (or counterproposals). Ship as one
   additive HP commit, flagged in `active-lanes.md` first per policy A.
3. **Xero** - throwaway campaign vs the Arena. Default = throwaway (zero
   residue, no cross-test contention with `section-a1`/`section-a3`).
4. **Xero** - fold `combat-infection.spec` (build-plan #20) into
   `combat-flow.spec` once the damage hook makes both buildable, or keep them
   separate files? Recommendation: fold (one fixture, one cascade-delete).
5. **HP** - does Start Combat currently insert `character_states` for NPCs that
   were not yet damaged in this campaign? (If they only get a row on first
   damage, Phase A's "row exists per combatant" needs adjusting.)

## What this plan is NOT
- NOT a coded spec. Per CLAUDE.md plan-mode default, this scopes the shape;
  build kicks off once HP confirms (1) and (2).
- Does NOT touch `TacticalMap.tsx` move-follow / viewport while HP is mid-fix
  on the 2026-05-30 gate-RED finding.
- Does NOT add testids unilaterally - those are HP's lane to ship.

## Cross-references
- `tasks/e2e-full-suite-build-plan-2026-05-24.md` #10 + #20.
- `tasks/beta-500-readiness-2026-06-01.md` #7 "Pre-beta green light".
- `tasks/todo.md` line 150 (the standing routed-to-HP blockers).
- `e2e/section-a1-combat-start.spec.ts`, `e2e/section-a3-token-move.spec.ts`
  (foundation patterns).
- `e2e/inventory-trade.spec.ts` (RPC-driven mutation pattern - the `gm_apply_damage` RPC reuses this shape).
- `tasks/tactical-map-render-fix-spec-2026-05-26.md` (the no-brittle-canvas-tests precedent).
