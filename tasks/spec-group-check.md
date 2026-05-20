# Spec - Group Check

**Status:** canon locked 2026-05-13. Current implementation matches this spec - no code change required at lock time.

## Concept

A group check fires when one player initiates a specific skill check (e.g. Scavenging a big building) and multiple PCs can plausibly help. The whole party pools relevant attribute + skill values into a **single roll** made by the most-qualified party member. The original "helpers each roll individually and feed modifiers" redesign is **DEAD** as of 2026-05-13.

## Flow

1. Player triggers a skill check.
2. If multiple PCs are present and the GM/initiator decides it's a group situation, the check is escalated to a Group Check (via the existing Group Check modal - `setShowSpecialCheck('group')`).
3. Initiator picks the participating PCs and the skill.
4. System computes for each participant:
   - **AMod** = their value in the relevant attribute (e.g. ACU for Scavenging)
   - **SMod** = their level in the relevant skill (e.g. Scavenging)
   - A zero value is fine - they just contribute 0 (no warm-body bonus, no auto-+1 for showing up).
5. The participant with the highest **AMod + SMod** is the leader and rolls.
6. Everyone else's **AMod** and **SMod** are summed and added to the leader's roll (alongside the leader's own AMod + SMod).
7. The leader's outcome is the group's outcome.

## Key rules

- **No participation bonus.** A PC with ACU 0 and Scavenging 0 contributes nothing. They can still be selected (it's "irrelevant"), but they don't help.
- **AMod and SMod both count.** Pre-2026-04 the implementation only summed SMods, which under-counted multi-person checks. The current implementation sums both. Don't regress this.
- **Leader = highest combined AMod+SMod.** Tiebreak isn't defined formally; current code uses array sort which is stable, so the first selected wins ties. Good enough until a real tie-driven bug surfaces.

## Example

Cree Hask (ACU +2, Scavenging +1), Marv (ACU 0, Scavenging +1), Wilson (ACU +1, Scavenging 0), Frankie (ACU 0, Scavenging 0) scavenge a building together.

- Cree: AMod +2, SMod +1, total +3 → leader
- Marv: AMod 0, SMod +1 → contributes +1
- Wilson: AMod +1, SMod 0 → contributes +1
- Frankie: AMod 0, SMod 0 → contributes 0

Cree rolls 2d6 +2 AMod +1 SMod from her own, +2 AMod +2 SMod pooled from helpers = **2d6 +4 AMod +3 SMod**.

## Implementation reference

- `app/stories/[id]/table/page.tsx:3881` (`triggerGroupCheck`)
- `components/RollsFeed.tsx:586+` (bespoke Group Check banner)
- Banner narrative composition uses `r.outcome` directly; `groupOutcomeTag` only adds "Moment of Insight" text on HI/LI per canon rule. Badge gates on outcome being HI or LI.

## What's NOT in this model

- Individual helper rolls (was the proposed redesign - killed).
- Per-helper Insight Die contributions (no helper rolls = nothing to spend an Insight Die on).
- Per-helper HI/LI award from a group check (only the leader's roll can award).
- A separate "modifier from helper outcome" ladder (Success +1, WS +2, etc.) - that's Coordinated Effort, see `tasks/spec-coordinated-effort.md`.
