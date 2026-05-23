# 3c-B executeRoll extraction - 2-client smoke testplan (2026-05-23)

**What shipped:** 3c-B (`35b72fe` B1, `6de30a8` B2, `e6919e5` B3) moved the entire
roll/combat resolution engine off `app/stories/[id]/table/page.tsx`:
- B1 retired 3 dead executeRoll branches (Distract / Stabilize / Gut Instinct).
- B2 moved the CMod helpers (`resolveTargetDefense`, `computeAttackCmod`) to `lib/table-roll-context.ts`.
- B3 moved `executeRoll` (~1810 lines) into `app/stories/[id]/table/hooks/useRollResolution.ts`.

**This is BEHAVIOR-PRESERVING.** The executeRoll body was relocated byte-for-byte
(verified identical to the prior code); 3c-A already fixed the combat bugs
surgically. So the acceptance bar is simple: **every roll path behaves exactly
as it did before 3c-B, with no new console errors.** Any difference = a mis-wired
dependency in the hook, localized to "the move."

Run on live (`thetapestry.distemperverse.com`) - push-to-live, no staging.

## Setup
- **2 browsers / 2 accounts:** one GM (Thriver), one player (Survivor) in the same campaign.
- Start a session, activate a tactical scene, roll initiative so there is an active combat with at least 1 PC + 2 NPCs (one of them adjacent/in-range for melee + ranged).
- Open the browser console on BOTH clients (watch for red errors / "Cannot read properties of undefined" - that would signal a bad dep).

## Checklist (✅ = matches pre-3c-B behavior)

### A. Basic rolls
- [ ] **Skill roll, no weapon** (e.g. a Perception / Athletics check from a sheet). Dice render, AMod/SMod/outcome correct, one feed-log row.
- [ ] **2nd client sees it** in the rolls feed within ~1s (realtime).

### B. Attacks + CMod itemization (the heart of 3c)
- [ ] **PC ranged attack** at an NPC: to-hit dice, CMod breakdown shows the NPC's **Target RDM** as its own term, damage lands on the NPC, WP/RP update on both clients.
- [ ] **PC melee attack**: breakdown shows **Target MDM**.
- [ ] **Aim then attack**: the Aim action sets up, the follow-up attack shows **+2 Aim** as its OWN positive term (never silently netted away by defense).
- [ ] **Range CMod**: attack at distance shows a **Range CMod** term; out-of-range is gated/warned as before.
- [ ] **Same-target +1** when the active combatant attacks the same target twice in a turn.
- [ ] **GM-rolled NPC attack** at a PC: NPC defense applies to the to-hit; if the GM types a manual CMod with no auto-target it shows as a generic **CMod** term (this is the known +5-CMod "manual entry" case - confirm it is in fact manual, not a missing auto-target).

### C. Explosives / blast
- [ ] **Grenade thrown at a cell**: blast AoE resolves, every victim in radius takes splash damage (both clients), the consolidated **💥 Blast hit** feed line lists each victim. Carry qty decrements by 1.
- [ ] **Grenade Dire-Failure fumble**: scatters, primary box skipped, blast line still renders, "fumbled throwing a Grenade" wording.

### D. Insight dice
- [ ] **Pre-roll 3d6 (keep all 3)**: modal shows THREE dice boxes, total = d1+d2+d3+mods, insight die decremented.
- [ ] **Pre-roll +3 CMod**: roll shows a **+3 Insight CMod** term, die decremented.
- [ ] **High/Low Insight outcome** awards/handles an Insight Die to the right actor (PC or antagonist NPC only).

### E. State transitions
- [ ] **Mortal wound** (drop a PC to WP 0): death countdown set, **1 Stress pip** added on entry, the spend-Insight-to-survive prompt appears.
- [ ] **NPC dropped to 0**: dies/mortally-wounded as before; **active combatant going down auto-advances** the turn (no stall).
- [ ] **Turn auto-advances** after a normal attack resolves; 2nd client sees the new active combatant.

### F. The chained / queued paths (these touch the refs that became deps)
- [ ] **Infection Check (Wound)** after combat: outcome writes infection state; the chained check fires; feed wording correct ("does not become infected" on success).
- [ ] **Lasting Damage Check**: a "picked up a Lasting Wound" feed line appears with the right narrative.
- [ ] **Weapon malfunction / jam**: the "weapon malfunctions" feed line appears after the attack row (correct order).
- [ ] **Auto-loot after a kill**: the loot feed row appears AFTER the attack row (oldest-first order preserved).
- [ ] **Heal with a kit** (First Aid / Doctor's Bag): heals as before.
- [ ] **Sprint (Athletics)**: the deferred sprint catch-up resolves as before.
- [ ] **Coordinated Effort**: lead roll sets the chain bonus; a participant's roll picks up the coordinated-effort CMod term; Low Insight collapses the chain.

### G. Regression sweep
- [ ] No red errors in EITHER console across the whole pass.
- [ ] No "stuck" turns, no double-advances, no snap-backs.
- [ ] Rolls feed ordering and wording look identical to before 3c-B.

## If something fails
Because the body is byte-identical, a failure almost certainly means a dependency
was wired wrong in the `RollResolutionDeps` bundle (a ref/setter/state passed as
the wrong thing, or a value that should have been current but is stale). Note the
EXACT path + console error and which dep it touches; the fix is in
`useRollResolution.ts` (the deps destructure / interface) or the page call site,
not in the body. Revert for the whole step: `git revert e6919e5 6de30a8 35b72fe --no-edit && git push origin main`.
