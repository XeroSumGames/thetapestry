# Distract Migration Phase 2 - Test Plan (2026-05-20)

**Branch:** `claude/social-action-modals`
**Live URL:** thetapestry.distemperverse.com
**Time budget:** ~5 minutes manual smoke. Unit coverage already green (411/411, 11 new in `distract-helpers.test.ts`).

---

## Pre-flight (already verified)

- [x] `npx vitest run tests/lib/` - 411/411 pass (11 new).
- [x] `npx tsc --noEmit` - clean.
- [x] Guardrails (`check-em-dashes.mjs` / `check-font-sizes.mjs` / `check-role-literals.mjs`) - clean.
- [x] First Impression already migrated (FI streamline 2026-05-19); spec updated.

---

## Manual smoke - Distract success (target loses 1 action)

1. Open the campaign's `/table` page during an active combat.
2. Advance initiative to a PC's turn with Intimidation / Inspiration / Tactics* / Psychology*.
3. In the active-combatant action panel, find the **Distract** button.
4. Click. **Expected:** a new modal opens titled "Distract" with subtitle "&lt;roller&gt; distracts ..." (target empty until picked).
5. The modal shows a **Target dropdown** listing all combatants within 30 ft Close range. The closest target should be preselected. Distances appear in feet next to each name.
6. Confirm the roll formula reads "2d6 + INF + Skill + CMod" and AMod / SMod reflect the roller's stats.
7. Click "Roll Distract". **Expected:**
    - Dice fire visibly.
    - Outcome banner (Success / Wild Success / High Insight) shows.
    - **A green-bordered narrative box** says "&lt;target&gt; loses 1 action." (Success) or "&lt;target&gt; loses BOTH actions this turn." (WS / HI).
    - The TARGET's `actions_remaining` on the initiative bar drops accordingly.
    - The ROLLER's `actions_remaining` drops by 1 (attempt cost).
    - Rolls feed shows a "&lt;roller&gt; - Distract → &lt;target&gt;" row.
8. Click Close. Modal closes; state resets.

---

## Manual smoke - Distract failure (no effect)

1. Same setup. Apply -5 CMod in the modal before rolling.
2. Roll. **Expected:**
    - Outcome banner: Failure or Low Insight.
    - **A grey-bordered neutral narrative box** says "&lt;target&gt; shrugged off the distraction."
    - TARGET's actions_remaining UNCHANGED.
    - ROLLER's actions_remaining still drops by 1 (attempt still costs).

---

## Manual smoke - Distract Dire Failure (target Inspired)

1. Same setup. Set up a snake-eyes (1+1) or very negative CMod for a Dire Failure (total ≤ 3).
2. Roll. **Expected:**
    - Outcome banner: Dire Failure or Low Insight (LI maps to no-op, not Inspired - confirm Failure-class doesn't grant the +1).
    - For Dire Failure specifically: **An amber-bordered narrative box** says "&lt;target&gt; shrugs it off and gains an action - Inspired!"
    - TARGET's actions_remaining INCREMENTS by 1.

---

## Edge case - no valid targets in range

1. Set up a combat where no enemies are within 30 ft of the active combatant.
2. Click Distract. **Expected:** alert "No valid Distract targets within Close range (30 ft)." No modal opens.

---

## Edge case - target dropped between modal open and Roll click

1. Open the Distract modal with target X picked.
2. Have another player kill X (drop WP to 0) before clicking Roll.
3. Click Roll. **Expected:**
    - The cascade returns the no-op narrative ("X shrugged off the distraction.").
    - No DB write hits initiative_order (target is no longer in the list).
    - Roller's action still consumed.

---

## Console / network checks

- DevTools Console: zero `[distract] update error` or `SILENT RLS FAIL` warnings.
- Network tab per attempt:
    - 1× POST to `/rest/v1/roll_log` (saveRollToLog)
    - 1× PATCH to `/rest/v1/initiative_order` (consumeAction on the roller)
    - 1× PATCH to `/rest/v1/initiative_order` (cascade on the target, only when delta != 0)
    - WebSocket: `turn_changed` broadcast event after the cascade

---

## Rollback procedure

```sh
git -C /c/TheTapestry revert <distract-phase-2-commit> --no-edit
git -C /c/TheTapestry push origin main
```

The legacy `executeRoll` Distract branch is preserved unreachable; reverting restores the old `handleRollRequest('<roller> - Distract', ...)` path on the in-combat button. The dead `applySocialAction` Distract branch is gone (it was unreachable since 2026-04-29 per code comments) - if you want it back, revert touches that too.

---

## After playtest verifies clean

- Mark **Stabilize / Distract Phase 4** ready to ship.
- Delete BOTH the Stabilize and Distract legacy branches in `executeRoll` (combined ~75 lines).
- Update the spec's status block to "ALL PHASES SHIPPED."
