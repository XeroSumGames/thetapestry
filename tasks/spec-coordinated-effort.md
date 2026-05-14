# Spec — Coordinated Effort (player-initiated, chain of skill checks)

**Status:** design re-locked 2026-05-13 after Xero corrected the initial misunderstanding. Not built yet. Separate code path / separate UI from Group Check.

## Concept

A Coordinated Effort is a **chain of skill checks** where multiple PCs work together on a sequence of actions toward a shared goal. There is no fixed "leader" role and no fixed "final" roll — the chain just runs from action to action until the goal is achieved (or the effort collapses). The FIRST roll in the chain sets the tone: its outcome propagates as a CMod that benefits or burdens every subsequent roll. Each participant rolls whatever skill suits the action they're personally doing.

## Mechanic

### Initiation

1. Any player presses a "Coordinated Effort" button.
2. They pick the **participants** — the PCs who are coordinating. Includes themselves.
3. They pick **the skill they (the initiator) will roll first**. Could be any skill that fits whatever action kicks off the sequence (Tactics\* for planning, Manipulation for a distraction, Mechanic\* for disabling alarms, Perception for reconnaissance, etc.). There is no "planning skill" requirement.
4. The chain begins.

### First / Lead roll

- Initiator rolls their chosen skill.
- Modifier: **+1 CMod per OTHER participant** in the Coordinated Effort. With 3 total participants the leader gets +2; with 4 total they get +3; etc.
- The OUTCOME of this roll becomes the **lead CMod** that propagates to every subsequent roll in the chain.

### Subsequent rolls

- The chain continues with each participant doing the action they signed up for.
- Multiple rolls per participant are allowed (e.g. one PC rolls Stealth then Sleight of Hand in sequence).
- Each individual roll gets:
  - **+1 CMod per OTHER participant** (same coord bonus the lead got)
  - **+ the lead CMod** (from the first roll's outcome — see ladder below)
- The roller picks their own skill for what they're doing (Stealth, Athletics, Demolitions\*, Driving, etc.).
- **Only the FIRST roll's outcome propagates.** Subsequent helper rolls succeed or fail on their own — they don't add further CMods to the rest of the chain.

### Lead CMod ladder (outcome of the first roll)

| First-roll outcome | Lead CMod | Effect on chain |
|---|---|---|
| High Insight (6+6) | +3 | All subsequent rolls +3; first roller gets a personal +1 Insight Die |
| Wild Success (14+) | +2 | All subsequent rolls +2 |
| Success (9-13) | +1 | All subsequent rolls +1 |
| Failure (4-8) | -1 | Chain continues at -1 to all subsequent rolls |
| Dire Failure (0-3) | -3 | Chain continues at -3 — heavily penalized |
| Low Insight (1+1) | — | **Chain collapses immediately**. No subsequent rolls fire. First roller still earns a personal +1 Insight Die per canon HI/LI rule. |

The asymmetry (+1/+2/+3 vs -1/-3/abort) is intentional — bad lead rolls cascade hard, and the worst single roll outcome (LI) ends the effort outright.

### Chain end

The chain ends when one of these happens:
- The goal action is completed (last needed roll succeeds).
- Any participant **opts out** mid-chain (allowed at any time; remaining participants can continue without them OR call the effort off as a group).
- A participant **catastrophically fails** a roll in a way that makes the next step impossible (narrative judgment by the GM at the table — not a hard mechanic).
- The **lead roll is a Low Insight** (chain collapses before any subsequent rolls).

### Action cost (in combat)

If the Coordinated Effort runs during combat, **each individual roll** consumes 1 combat action from the roller — including the lead roll. Out of combat, rolls are free (matches normal roll behavior).

### Helper Insight Dice

- Any participant CAN spend an Insight Die on their own roll (3d6 keep-all or +3 CMod), same as any normal skill check.
- Any participant who rolls HI or LI on their personal roll earns a +1 Insight Die personally, independent of the Coordinated Effort outcome.

## Worked example — Heist at a tech warehouse

4 PCs: Alex (hacker), Sam (face), Riley (muscle), Jess (driver). Goal: steal a prototype.

1. **Alex initiates** a Coordinated Effort with all 4 PCs. She'll roll first.
2. **Alex rolls Mechanic\*** to bypass the security panel out back.
   - +3 CMod from Coord Effort (3 other participants chipping in)
   - + her own RSN AMod + Mechanic\* SMod
   - Rolls **Success** → lead CMod = **+1** for the rest of the chain
3. **Sam rolls Manipulation** to wave past the front desk guard.
   - +3 (Coord) + +1 (Alex's lead) = **+4** before his own mods
   - Rolls Success → guard waves him through. Sam's own outcome does NOT propagate further.
4. **Riley rolls Stealth** to slip into the lab.
   - +3 + +1 = **+4** before his own mods
   - Rolls **Wild Success** → in clean. Riley's WS does NOT propagate further; only Alex's lead does.
5. **Riley rolls Sleight of Hand** (second roll, same chain) to swap prototype for decoy.
   - +3 + +1 = **+4**
   - Rolls Success.
6. **Jess rolls Driving** to get them out before the swap is noticed.
   - +3 + +1 = **+4**
   - Rolls Success → goal achieved → chain ends.

## Worked example — Sneak and plant C4 (Xero's original)

3 PCs. Goal: sneak past guards and plant C4 charges.

1. **Player A initiates** Coordinated Effort with all 3 PCs. Picks **Tactics\*** as the first skill (formulating the plan).
2. **A rolls Tactics\***:
   - +2 CMod from Coord (2 others chipping in)
   - + own RSN AMod + Tactics\* SMod
   - Rolls Success → lead CMod = **+1**
3. **B rolls Manipulation** to distract the guard:
   - +2 (Coord) + +1 (A's lead) = +3 before B's own mods
   - Rolls Success
4. **C rolls Stealth** to slip behind the guard:
   - +2 + +1 = +3
   - Rolls Success
5. **C rolls Demolitions\*** to plant the C4:
   - +2 + +1 = +3
   - Rolls Success → goal achieved → chain ends.

## Open implementation questions

- **Feed shape:** one bespoke "Coordinated Effort" banner row that summarizes the lead roll + all sub-rolls with their outcomes, or a chain of individual rows with a wrapping header? Default recommendation: bespoke summary banner with an expand that shows each individual roll's dice + outcome in order.
- **Turn-gate during combat:** if combat is active, can a Coordinated Effort fire across multiple combatants' turns, or does the whole chain resolve on the initiator's turn before initiative advances? Default: chain resolves on the initiator's turn (initiative pauses until the chain ends or someone opts out).
- **GM oversight:** zero GM gate at start, but should there be a "GM can interject a -X CMod for table difficulty" affordance? Default: no — the standard CMod input on each roll modal already handles per-action GM difficulty.

## NOT in this model

- A fixed "leader" or "planning" role — the first roll just happens to set the tone.
- A required final/culminating roll by a specific player — chain ends when the goal is met or someone opts out.
- Helper roll outcomes propagating forward as additional CMods — only the FIRST roll's outcome propagates.
- One-skill-per-effort — each participant picks their own skill for what they're actually doing.

## Related canon

- Canon §02 → Insight Dice (HI/LI award rules).
- `tasks/spec-group-check.md` — distinct mechanic for pooled stats on a single roll; do NOT fold these together.
