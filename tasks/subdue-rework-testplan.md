# Test plan - Subdue rework (Phase 2a)

Shipped 2026-06-01, commit `f5b4465` (+ Phase 1 groundwork `7c45430`, canon `ebb19ce`).
Revert: `git revert f5b4465` (then re-baseline arch down if needed).

Subdue (the choke while grappling) changed from a normal weapon attack (full WP
+ 100% RP, melee-substitutable) to an **opposed Unarmed choke** dealing
**1 WP + (1d3 + PHY AMod + Unarmed Combat SMod) RP**. Damage now flows through
`lib/data/combat` -> `applyDamageTransition`, the same canon path a weapon hit
uses. Verify on the live site (prod) after the Vercel deploy.

## Setup
- GM table (`/stories/<id>/table`), active combat, a PC and an NPC within 5 ft.
- Best with a 2nd browser/account as a player to confirm cross-client propagation.

## 1. Grapple still works (regression guard - byte-identical path)
- [ ] Grapple a target: opposed roll, tier-based verdict, target gets `grappled_by`
      + 1 RP + loses an action. Banner reads "X is Grappled!". Nothing about this
      should have changed.

## 2. Subdue - the new opposed choke
- [ ] While grappling, the action bar shows **Subdue** + **Release**. Click Subdue.
- [ ] Modal eyebrow reads **SUBDUE**, shows the **Pinned** target (NO picker, NO
      "Change" link), Roll button says **Roll Subdue**.
- [ ] CMod box + Insight Die options work (PC attacker with >=1 die).
- [ ] Roll. Result shows attacker vs defender opposed lines + a verdict:
  - **Grappler wins** -> "X is Subdued!" + "X takes 1 WP + N RP" where
    **N = the d3 + attacker PHY + attacker Unarmed Combat**. Confirm the math:
    e.g. PHY +2, Unarmed 3, d3=2 -> 7 RP.
  - **Defender wins** ("too slippery") -> "X slips the choke", **no damage**.
- [ ] The defender's WP drops by exactly 1, RP drops by N, on BOTH clients.
- [ ] Feed shows a `Subdue` row with the right outcome color.

## 3. Knockout (the point of the choke) - incap path
- [ ] Subdue a target whose RP is low enough that N takes them to 0.
- [ ] Defender becomes **Incapacitated**: a "Lights Out" feed row, a "gains a
      Stress from being Incapacitated" row (PCs only - NPCs have no Stress), the
      incap state shows on their card, and their initiative actions zero out.
- [ ] Confirm the Stress pip actually incremented on the PC sheet (cap 5).

## 4. Mortal edge (rare - target at 1 WP)
- [ ] Subdue a target sitting at exactly 1 WP. The 1 WP drops them to 0 ->
      **mortally wounded**: "Death is in the air" row + death countdown + Stress
      pip (mortal preempts incap - only ONE pip). PC at 0 WP with insight may get
      the insight-save prompt path (same as a weapon mortal wound).

## 5. Fists only
- [ ] Subdue uses Unarmed regardless of readied weapon - a PC holding a Fire Axe
      still subdues with `1d3 + PHY + Unarmed`, not the axe.

## 6. NPC target
- [ ] Grapple + Subdue an NPC: same 1 WP + N RP, incap/mortal on the NPC, no
      Stress row (NPCs don't track Stress). If the NPC was the active combatant
      and gets incapped, the turn auto-advances.

## Not in this phase (don't expect)
- Break Free is still the OLD behavior (reopens the grapple modal) - Phase 2b.
- "Lose next action whenever it falls" carryover when the defender has 0 actions
  left this round - Phase 3 (needs the `pending_action_loss` column).
- Standalone Subdue (combat-action row 33) still deals full WP - separate pickup.

## Rollback
`git revert f5b4465 && git push origin main`. No schema/DB change in this commit,
so nothing to unwind server-side; Vercel redeploys the prior Subdue in ~2 min.
