# Modal Unification — Pass 2 testplan

Verifies the Recruit modal's result step migrated to the shared `<RollModal>` shell. The bespoke pick-step picker (PC / NPC / community / approach / skill / Insight pre-roll) is unchanged — that's recruitment-specific UI. Only the post-roll display + Apprentice toggle moved to the shell.

**No SQL migration required** — UI-only refactor.

---

## 0. Smoke test — pick step unchanged

1. As GM or PC roller in a campaign with at least one revealed NPC, open the NPC card and click **Recruit**.
2. The pick-step modal renders exactly as before:
   - Header: green "RECRUITMENT" eyebrow + "Pick target & approach" title.
   - Roller PC dropdown (filtered by `isGM` rule).
   - Target NPC dropdown.
   - Community dropdown OR auto-set to "+ Found a new community" if zero communities exist.
   - Approach buttons (Cohort / Conscript / Convert).
   - Suggested skill chips per approach + skill dropdown.
   - GM CMod input.
   - Insight Die pre-roll buttons (none / 3d6 / +3 CMod) IF roller has ≥1 Insight Die.
   - Cancel + Roll Recruitment buttons.
3. Conscript pressgang warning + blocking confirm() at submit still fire.
4. Poaching warning (NPC already in another community = -3 CMod hint) still renders.

## 1. Roll the recruit — result step opens via shared shell

1. Fill in pick step (any approach / skill / community), no Insight pre-roll, click **Roll Recruitment**.
2. The pick modal closes; a NEW shared-shell modal opens for the result.
3. Visual confirmation:
   - Header reads **RECRUITMENT** with × close (matches Stress Check / Breaking Point chrome from Pass 1).
   - Subtitle: `<RollerName> → <NpcName> · <Approach>` (e.g. "Vera Oakes → Nolan Penn · Cohort").
   - Two dice tiles (or three if Insight 3d6 was spent), 52×52 dark squares with the rolled face values.
   - Below the tiles, the **renderOutcome** custom card:
     - Math line: `[d1+d2] +X AMod +Y SMod +Z CMod = Total` color-coded.
     - Outcome banner (e.g. "WILD SUCCESS" green, "DIRE FAILURE" red) using the existing `outcomeColor` helper.
     - Joined/failed card: green-bordered "X joined Y as a Cohort" OR red-bordered "The attempt failed. X is not joining Y."
     - (If applicable) Insight Die reroll buttons in the purple-bordered box.
     - (If High Insight + inserted + roller has no apprentice) Apprentice eligibility card with "Take as Apprentice" button.
   - Bottom: **Close** button using the shell's standard teal-outlined style.

## 2. Compare visual chrome to Pass 1 modals

Open Stress Check / Breaking Point on a PC sheet side-by-side with the Recruit result modal:
- Header bar layout matches (title + × close — same font, same letter-spacing).
- Dice tiles are 52×52 with identical Carlito 24px digits.
- The Close button at the bottom uses the same teal-outlined style across all three.
- Background overlay opacity / centering / padding match.

Any discrepancy = bug — report file/line.

## 3. Insight Die pre-roll (3d6) → result shows 3 dice tiles

1. As a roller with ≥1 Insight Die, open Recruit, click "Roll 3d6" pre-roll button, click Roll Recruitment.
2. Result modal opens with **THREE** dice tiles (not two). Confirm via the math line: `[d1+d2+d3]`.
3. Reroll row shows three buttons: Re-roll Die 1, Die 2, Die 3 (each labeled with the current face).
4. Click any reroll → the corresponding tile updates + the outcome may flip if the new total crosses a threshold.

## 4. Reroll mechanics — 2-die case

1. As a roller with ≥1 Insight Die remaining (post-roll), open Recruit without pre-roll spend.
2. Roll Recruitment.
3. Result modal shows two reroll buttons in the purple panel: Re-roll Die 1 / Re-roll Die 2.
4. The reroll panel is HIDDEN if outcome is `Low Insight` or `High Insight` (rules: Moments lock the dice).
5. Click Re-roll Die 1 → die1 updates, total recomputes, outcome may flip. The membership state (NPC joined / didn't) updates in the join card if the outcome crossed the success line.

## 5. Apprentice toggle — High Insight only

1. Force-roll a High Insight (double-6) by dev-tweaking the dice or just keep rolling. Confirm:
   - Apprentice eligibility card renders (purple-bordered).
   - "Take as Apprentice" button is visible.
2. Click → button writes `community_members.apprentice_meta` + flips `apprenticeApplied=true`.
3. Card disappears (the toggle hides post-Apply because `recruitResult.apprenticeApplied` is now true).
4. Master PC's progression log gets a new `⭐ Took X (age Y, ...) as your Apprentice` entry.
5. The Apprentice creation wizard (separate modal) opens for the player.

## 6. Apprentice toggle — Wild Success does NOT show it

1. Roll a Wild Success (e.g. 14+ total without double-6).
2. Confirm the Apprentice card does NOT render. (SRD §08 p.21 — only High Insight unlocks the path.)

## 7. PC already has an apprentice — toggle suppressed

1. Sign in as a PC who already has one Apprentice. Roll a High Insight on a new NPC.
2. Confirm the Apprentice card does NOT render. Tooltip not needed; it just doesn't appear (consistent with prior behavior).

## 8. Cancel paths

1. Pick-step modal — click outside the modal OR Cancel → modal closes, no roll fires.
2. Result modal — click Close OR × → modal closes, state resets via `closeRecruitModal`.
3. Mid-pick → click outside → returns to no-modal state.

## 9. Multi-community + new-community paths

1. With multiple communities, pick "+ Found a new community" → name input + "Make public" toggle render.
2. Roll → on success, a new `communities` row gets created (the inserted check confirms via the join card).
3. With zero communities, the picker auto-selects `__new__`.

## 10. roll_log integration

After any successful Recruit roll, confirm a `roll_log` row exists with:
- `outcome='recruit'`
- `damage_json` carrying `{ npc_id, community_id, recruitment_type, approach, skill_name }` (existing schema; refactor preserved this).
- `label` reading `<RollerName> recruited <NpcName> as <Approach>` or the failure variant.

## 11. TypeScript / guardrails

- `npx tsc --noEmit` clean ✅
- `node scripts/check-font-sizes.mjs` — only the two pre-Phase-4 offenders flag.

---

## What this pass did NOT touch

- The bespoke pick-step picker (PC / NPC / community / approach / skill setup) is fully preserved.
- `executeRecruitRoll`, `rerollRecruitDie`, `closeRecruitModal`, `computeRecruitCmods`, etc. — unchanged.
- The Apprentice creation wizard that opens after "Take as Apprentice" — unchanged.
- The universal `pendingRoll` modal (Attack Roll / Stabilize / Distract / Coordinate / Group / Gut Instinct / First Impression) — already canonical, no migration.

---

## Open follow-ups

- **Pass 3 (optional):** swap the universal `pendingRoll` modal in [app/stories/[id]/table/page.tsx:7350-7833](app/stories/%5Bid%5D/table/page.tsx) to also use `<RollModal>`. ~480 lines of inline JSX would shrink considerably. Visual UX is already canonical there, so this is a code-organization win (reduce table/page from ~10,200 lines toward ~9,700). ~half day if attempted; not necessary for the user-facing modal-unification goal.

---

## Rollback

`git revert <commit>`. The pick step's bespoke JSX is preserved; the result-step block was simply replaced with a `<RollModal>` call + custom `renderOutcome`. Reverting restores the inline result block.
