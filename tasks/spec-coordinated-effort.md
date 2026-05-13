# Spec — Coordinated Effort (player-initiated)

**Status:** design locked 2026-05-13. Not built yet. Not folded into Group Check (separate code path / separate UI).

## Concept

A player who wants to attempt something significant where multiple PCs can each meaningfully contribute via their own checks initiates a Coordinated Effort. The initiating player drives the entire sequence: they pick the skill, they pick the participants, the sequence of rolls runs, and they make the final culminating roll. The GM is **not in the loop** — no approval gate, no notifications they have to respond to, no orchestration.

## Flow

1. Initiating player presses a "Coordinated Effort" button (location TBD — likely on the table page action bar or in the skill check modal).
2. They pick the **skill** for the effort (e.g. Scavenging, Medicine\*, Tactics\*).
3. They pick the **participants** — the PCs joining the effort, including themselves.
4. Each non-initiator participant makes an **individual check** of the chosen skill. Order: the system fires roll requests one after another, in pick order; each participant resolves their own roll modal as if it were any other skill check.
5. After all helper rolls resolve, the **initiator makes the final check**. Their roll is modified by the outcomes of the helper rolls (modifier table TBD — likely Success +1, Wild Success +2, High Insight +3, Failure -1, Dire Failure -2, Low Insight -3, same as the original Group Check Redesign proposal).
6. The final check's outcome is the result of the Coordinated Effort.

## Key decisions (locked)

- **2a.** Initiating player picks the skill — not the GM.
- **2b.** Initiator picks participants directly. No Yes/No opt-in prompt per participant. Discussion happens at the table before the button is pressed.
- **2c.** GM does not gate the flow at any point. No approval, no notification, no review step.
- **2d.** Separate feature from Group Check — different code path, different UI affordance. Group Check stays as the single-leader-pooled-stats model (see `tasks/spec-group-check.md`); Coordinated Effort is the multi-individual-roll model.

## Open implementation questions (resolve before coding)

- **Helper Insight Dice:** can a helper spend an Insight Die on their helper roll? Default assumption: yes, same as any normal roll.
- **Helper insight award:** if a helper rolls HI or LI, does THEY get a +1 Insight Die personally? Default assumption: yes — HI/LI award the rolling character regardless of whether the roll is part of a Coordinated Effort.
- **Modifier ladder for final roll:** Success +1 / WS +2 / HI +3 / Failure -1 / DF -2 / LI -3 — confirm or specify a different ladder.
- **Initiator's eligible skills:** are they restricted to skills they have a level in, or can they initiate on a skill they're untrained in? Default: anyone can initiate on any skill (the helpers might carry them).
- **Action consumption:** does each helper roll consume one of that character's combat actions if combat is active? Default: yes if combat-tied, no if out of combat (matches normal roll behavior).
- **Feed shape:** one bespoke "Coordinated Effort" banner row that summarizes all the sub-rolls, or one row per helper + a final-result banner? Recommend bespoke summary banner with an expand showing each helper's dice.

## Schema impact

Likely zero schema changes — feed rows can use `outcome='coordinated_effort'` and stash the participant + sub-roll metadata in `damage_json`. Confirm during implementation.
