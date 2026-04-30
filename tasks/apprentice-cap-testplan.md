# Test Plan — Apprentice creation flow §2a: SRD per-skill training cap

Shipped 2026-04-30. Closes the only meaningful gap on the otherwise-built Apprentice creation wizard ([components/ApprenticeCreationWizard.tsx](../components/ApprenticeCreationWizard.tsx)).

## Pre-flight

No SQL migration this round. Uses existing `characters.data.skills` shape and existing wizard infrastructure.

## Setup

1. Pick a campaign with at least one PC (the master PC) and a community of 13+ members. The master PC's character sheet should have a few skills with known levels — note them down, e.g. Barter 3, Tactics 2, Inspiration 1, no Demolitions.
2. From the world map, run a Recruitment Check on an NPC and get a **Moment of High Insight (double-6)** outcome with the Apprentice toggle ON.
3. The community_members row gets `recruitment_type='apprentice'`, `apprentice_of_character_id=<master PC>`, and `apprentice_meta` with motivation/complication.
4. The Apprentice's NPC card now shows a "⭐ Set Up Apprentice" button. Click it.

## Golden path — caps respected

1. Walk the wizard: Identity (note the new "Game time: 1 month" framing card at the top) → Paradigm pick → RAPID spend → Skills.
2. On the Skills step:
   - Each row shows **base** (Paradigm baseline) + **cap** (the SRD per-skill cap).
   - Skills the master PC has ≥ 1 in show `cap N` where N = master skill − 1.
   - Skills the master PC doesn't have show `untrainable` (greyed row).
3. Hover ▲ on a skill the master PC has at level 3 (Barter, in our setup).
4. **Expected**: tooltip = "Step up". Clicking ▲ raises Apprentice's Barter by one tier per CDP. The button greys out when Apprentice's Barter reaches 2 (cap = 3 − 1 = 2).
5. Hover ▲ on a skill the master PC doesn't have (Demolitions).
6. **Expected**: tooltip = "Master PC doesn't have this skill — can't train". Button never enables.
7. The Confirm step shows the final breakdown.
8. Click Save. Verify in the DB:
   - `campaign_npcs.skills.entries` reflects the trained skills.
   - `campaign_npcs.notes` has the appended "── Apprentice ──" block with motivation/complication/paradigm/background.
   - `community_members.apprentice_meta.setup_complete = true`.
   - `progression_log` on the master PC has the "Took on apprentice" entry.

## Edge — master PC has the skill but at level 1

1. Master PC has Inspiration 1 (cap = 0).
2. Apprentice's Inspiration baseline from Paradigm is 0 (non-vocational, not in Paradigm).
3. **Expected**: ▲ stays disabled (0 < 0 is false). Apprentice can't gain Inspiration through training.
4. If Paradigm gives Apprentice Inspiration 1 already, baseline stands; ▲ stays disabled.

## Edge — master PC has the skill at level 4 (max)

1. Master PC has Tactics 4 (cap = 3).
2. Apprentice's Tactics from Paradigm is 0.
3. **Expected**: ▲ enabled until Apprentice reaches Tactics 3, then disabled. Cap matches SRD.

## Edge — vocational skill, master PC has it

1. Master PC has a vocational skill (e.g. Demolitions) at level 2 (cap = 1).
2. Apprentice's Demolitions baseline = -3 (vocational default, not in Paradigm).
3. **Expected**: 1 CDP brings Apprentice to -1; 2 CDP brings to 1 (above cap 1 → blocked). Final Apprentice value caps at 1.

## Edge — Paradigm gives Apprentice a skill the master PC doesn't have

1. Paradigm seeds Apprentice with Lock-Picking 2.
2. Master PC has no Lock-Picking (level 0; cap = -1).
3. **Expected**: Lock-Picking row shows `untrainable`, but base = 2 stays. The Apprentice keeps Lock-Picking 2 (Paradigm intrinsic), no further spend allowed.

## Loading state

1. Open the wizard.
2. Skip to the Skills step before the master PC fetch resolves (rare — the call is fast).
3. **Expected**: the SRD-cap explainer shows "fetching…" in amber. ▲ buttons are disabled across the board until the fetch resolves; once ready it flips to "ready" in green.

## Regression — wizard still completes end-to-end

1. With a master PC who has all relevant skills at level 4, walk the wizard normally. Allocate 5 CDP across whatever skills you want.
2. **Expected**: behavior is identical to pre-cap — the cap is `min(SKILL_MAX, 4-1) = 3` in this scenario, but since SKILL_MAX = 4 was the only constraint before, the behavior is the same as long as the master PC has the skills. No regressions.

## Identity step framing

1. Open the wizard, sit on Identity.
2. **Expected**: a blue framing card at the top reads "Game time: per SRD §08 p.21 the Apprentice ritual represents 1 month of in-game time…"
3. The card should NOT block input; Name + Background fields below stay editable.
