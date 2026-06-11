# Grapple / Subdue / Break Free rework - engine spec

Design locked with Xero 2026-06-01 (chat). Canon prose already updated at
`app/rules/combat/combat-rounds/page.tsx:26`. This doc is the engine
implementation plan; the rules row above is the authoritative ruleset.

## The locked rules

- **Grapple** (1 action, attacker): opposed `2d6 + PHY + Unarmed Combat`
  (attacker) vs `2d6 + PHY + max(Unarmed Combat, Athletics)` (defender),
  tier-based winner (already shipped). On attacker win: defender restrained
  (`grappled_by`), takes 1 RP, and **loses their next action whenever it
  falls** (see Phase 3). On defender win: attacker takes 1 RP.
- **Subdue** (1 action, grappler; only while grappling): an **opposed** check
  - grappler `2d6 + PHY + Unarmed Combat` vs defender `2d6 + PHY +
  max(Unarmed Combat, Athletics)` ("too slippery to hold"). Always fists - no
  melee-weapon substitution. On grappler win, defender takes **1 WP + (`1d3 +
  PHY AMod + Unarmed Combat SMod`) RP**. RP-heavy choke; the point is to drop
  them to RP 0 (incap), not wound them.
- **Break Free** (defender spends 1 action): the same opposed Grapple check,
  but the **grappler contests reactively at no action cost**. Defender win =
  grapple ends (nothing to grappler). Defender loss = **+1 RP** to the
  defender, grapple persists.
- **Release** (free): grapple ends, no roll. (Already shipped.)

## Verified engine state (2026-06-01)

- **Normal Unarmed damage is ALREADY correct** (`1d3 + PHY + Unarmed`):
  `useRollResolution.ts:414` (`rollDamage` adds PHY for melee-classified
  Unarmed) + `:423` (`unarmedBonus = smod`) + `:485` (`calculateDamage(totalWP
  + unarmedBonus, ...)`). No platform-wide unarmed change needed.
- **Current Subdue is wrong** (`app/stories/[id]/table/page.tsx:5737` button):
  routes through `handleRollRequest` as a normal attack at `rpPercent: 100`
  with the readied melee weapon or Unarmed - i.e. full WP + 100% RP, not
  opposed, melee-substitutable.
- **Current Break Free** (`:5727`): reopens the grapple modal with the
  defender as `active`. Reuses `executeGrapple`, whose `defenderWins` branch
  gives the (break-free) attacker's *target* 1 RP - semantics are muddled for
  a break-free.
- **Damage-with-knockout machinery lives only in `executeRoll`**
  (`useRollResolution.ts:585-700+`): mortal-wound countdown, insight-save
  prompt, stress-pip-on-entry, incap on RP 0, `pc_damaged`/`pc_mortal_wound`
  broadcasts, progression-log. This is the ONLY correct place to apply Subdue
  damage - do not duplicate it.
- **`consumeAction`** (`page.tsx:2267`): fetches fresh entry, and **SKIPS when
  `actions_remaining < cost`** - so the grapple's defender-action-loss does
  NOT carry over when the defender already has 0 actions left this round.
- **`gm_apply_damage` RPC** sets a new WP value + stress + infection; it does
  NOT take an RP delta, so it is not a fit for Subdue's RP-heavy damage.

## Architecture decision (the friction)

Subdue needs BOTH halves that live in different places: the **opposed
resolution** (only the grapple modal does opposed) and **damage-with-incap**
(only `executeRoll` does it right). Two viable paths:

**Path 1 (recommended): opposed check in the grapple modal -> route the
resulting damage through a shared apply-damage helper.** Extract the PC/NPC
damage-application block from `executeRoll` (`:585-700+`) into a reusable
`applyDamageToTarget({ targetName, finalWP, finalRP, sourceName, ... })` in a
lib (e.g. `lib/data/combat-damage.ts` or a table-page helper). Then:
- Grapple modal gains a `mode: 'grapple' | 'subdue' | 'breakfree'`.
- Subdue: opposed roll (reuse `executeGrapple`'s tier logic); on grappler win,
  call `applyDamageToTarget(defender, 1, 1d3+PHY+Unarmed)`.
- Break Free: opposed roll; grappler value computed without spending an
  action; on defender loss, `applyDamageToTarget(defender, 0, 1)`.
This keeps all grapple-family opposed logic in one modal and makes the
knockout damage reuse the audited incap/mortal path. The extraction is the
real work (the block reads a lot of closure state - entries, setEntries,
broadcasts, insight prompt). Scope it carefully; it also pays off for any
future non-attack damage source.

**Path 2: thread a `subdue` flag through `executeRoll`.** Add `subdue` to
`WeaponContext`; in `executeRoll`, when subdue: run the defender's opposed
resist roll, and if the grappler wins set `finalWP = 1`, `finalRP = 1d3 +
attackerPhy + attackerUnarmed` (bypassing `calculateDamage`'s WP->RP%), then
let the existing block apply it. Less extraction, but special-cases the
700-line hot hook and bolts an opposed sub-roll into a non-opposed flow.

Lean Path 1 unless the extraction proves gnarlier than the special-case.

## Phases

1. **Subdue** - mode in the grapple modal + opposed check + 1 WP/formula RP via
   the shared apply-damage path. Remove the melee-weapon substitution. Unit
   test the damage numbers (extract the RP formula to a pure fn).
2. **Break Free** - opposed, grappler reactive (no action), +1 RP on defender
   loss, ends on success. Replace the current "reopen grapple modal" wiring.
3. **Action-loss carryover** - "lose next action no matter when." Common case
   (defender has actions this round) already works via `consumeAction`. The
   carryover case (0 actions left -> debit next round's first action) needs a
   small persistent debt. **Likely a new `initiative_order.pending_action_loss
   integer default 0` column (live DB change = bright line, confirm intent
   like Gap C) decremented at the round refresh in `nextTurn`.** Confirm with
   Xero before applying.
4. **Polish** - the Grapple/Subdue/Break-Free RollModal copy + accents.

## Open questions for Xero (before/while building)

1. **Two Subdues.** The combat-action table also has a standalone **Subdue**
   row (`combat-rounds:33`): "Non-lethal attack - full RP, 50% WP." That's a
   different move from the grapple-pin choke we just specified (1 WP + formula
   RP). Do you want to (a) keep them distinct (standalone Subdue = the 50%-WP
   non-lethal attack; grapple-Subdue = the choke), or (b) unify Subdue into
   one definition? Right now canon would contradict itself (1 WP vs 50% WP).
2. **Action-debt DB column** (Phase 3) - OK to add
   `initiative_order.pending_action_loss` as a live change when we get there?

---

## Third-party-attack rulings (Xero 2026-06-01) - engine plan

Canon updated at `app/rules/combat/combat-rounds/page.tsx:26`. Three rulings:

1. **Attack a GRAPPLED defender -> +1 CMod to hit** (held target can't dodge),
   and **on a MISS, an automatic second attack at -1 CMod against the
   GRAPPLER** (unintended hit). [NOT YET BUILT]
2. **Strike the GRAPPLER (any successful hit, regardless of damage) -> they
   release the grappled defender.** [SHIPPED this commit - `useRollResolution`
   hit block: a Success/Wild/HighInsight hit on a combatant whose name is
   another's `grappled_by` clears that hold + logs + reloads initiative.]
3. **Insight Dice always the green boxes.** [SHIPPED `2eabe40`.]

### Ruling #1 - the remaining build (do as a focused, tested pass)

- **+1 CMod vs a grappled target** (easy): add a `grappledTarget: +1` term to
  the attack CMod. Detect at the modal prefill (`computeAttackCmod` -> the
  `cmodSourcesRef` the inline Attack modal shows) so the player sees the +1
  pre-roll, AND it flows through `buildCmodBreakdown` in `executeRoll`. Target
  is grappled when `initiativeOrder.find(e => e.character_name === targetName)
  ?.grappled_by` is set. Itemize it so it reads in the CMod breakdown.
- **Miss -> auto-attack the grappler at -1** (the hard part - chained attack):
  when an attack on a grappled defender resolves to Failure / Dire Failure,
  automatically resolve a SECOND attack vs the grappler at -1 CMod. This is a
  programmatic re-roll + damage against a different target inside (or right
  after) `executeRoll`, which today resolves ONE modal-driven attack. Options:
    (a) factor the "roll 2d6 + mods -> outcome -> apply weapon damage to target"
        core out of executeRoll into a reusable `resolveAttackAgainst(target,
        weapon, mods, cmod)` and call it for both the primary and the stray
        attack (cleanest; sets up future reuse, mirrors the applyDamageToPc/Npc
        extraction); or
    (b) a contained inline second pass that rolls + routes damage through the
        existing `applyDamageToPc/Npc` seams (less factoring, some duplication).
  A stray hit on the grappler ALSO triggers ruling #2 (release) - so build #1's
  auto-attack to flow through the same hit path that #2 hooks, and the release
  composes for free. Needs a 2-client live verify (no unit-test net on the hot
  attack path) + roll-feed-log-preview rows for the stray-attack narrative.
