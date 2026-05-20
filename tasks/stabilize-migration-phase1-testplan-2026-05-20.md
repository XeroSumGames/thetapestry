# Stabilize Migration Phase 1 - Test Plan (2026-05-20)

**Branch / commit:** `2255ced refactor(stabilize): Phase 1 migration to dedicated <RollModal>`
**Live URL:** thetapestry.distemperverse.com
**Time budget:** ~10 minutes manual smoke. Unit coverage already green (400/400, 10 new).

---

## Pre-flight (already verified)

- [x] `npx vitest run tests/lib/` - 400/400 pass (10 new in `stabilize-helpers.test.ts`).
- [x] `npx tsc --noEmit` - clean.
- [x] Guardrails (`check-em-dashes.mjs` / `check-font-sizes.mjs` / `check-role-literals.mjs`) - clean.
- [x] Pushed to main, Vercel auto-deploys on push.

---

## Manual smoke - PC stabilize success

The 80% case. Run in The Arena or any campaign with multiple PCs.

1. Open `https://thetapestry.distemperverse.com/stories/<campaign-id>/table`.
2. Start a combat (or join an existing one) where you control a PC medic.
3. Knock one PC ally down to WP=0 (use GM Tools → Apply Damage, or shoot them).
4. Confirm the wounded PC's card shows the red **🩸 MORTALLY WOUNDED - Death in N rounds** banner.
5. Confirm the **per-card Stabilize button is GONE** from the wounded PC's card (it was removed in this commit; only the in-combat dropdown remains).
6. Advance the initiative to the medic's turn.
7. In the active-combatant header (top of the table), confirm the **🩸 STABILIZE ▾** dropdown appears.
8. Click the dropdown - confirm the wounded PC's name shows in green (engaged) if within 5ft of the medic on the tactical map, or amber (not engaged) if further.
9. If green: click the name. **Expected:** a new modal opens titled "Stabilize" with subtitle "&lt;medic&gt; stabilizes &lt;target&gt;", formula "2d6 + RSN + Medicine + CMod", AMod = medic's RSN, SMod = medic's Medicine, CMod = 0 (editable).
10. Click "Roll Stabilize". **Expected:**
    - Dice fire visibly.
    - Outcome banner (Success / Wild Success / High Insight) shows.
    - **A green-bordered narrative box** below the outcome says "&lt;target&gt; stabilized! Incapacitated for N rounds, then regains 1 WP + 1 RP."
    - The medic's `actions_remaining` decrements by 1 (header pill).
    - Rolls feed shows a STABILIZE row with the canon narrative ("STABILIZE &lt;medic&gt; stabilizes &lt;target&gt;" or HI variant).
11. Click Close. **Expected:**
    - Modal closes.
    - The wounded PC's card transitions out of "Mortally Wounded" - the red banner is replaced by a blue/cyan **💤 Incapacitated - N rounds remaining** badge.
    - The death_countdown is now null (visible by absence of the "Death in N rounds" text).
12. Check `appendProgressionEntry` log: the PATIENT's progression log (NOT the medic's) should have a "🩸 Stabilized by &lt;medic&gt;." entry.

---

## Manual smoke - PC stabilize failure

1. Same setup as above, but reduce the medic's effective dice (apply -5 CMod in the modal before rolling).
2. Roll. **Expected:**
    - Outcome banner shows Failure / Dire Failure / Low Insight.
    - **A red-bordered narrative box** says "Failed to stabilize &lt;target&gt;."
    - The patient's death_countdown is UNCHANGED (still bleeding out).
    - Medic's actions_remaining still decrements by 1 (the attempt costs an action even on failure).
    - Rolls feed shows "STABILIZE &lt;medic&gt; fails to stabilize &lt;target&gt;" (or the Dire / LI variant).

---

## Manual smoke - NPC stabilize

1. Drop a friendly NPC to WP=0 mid-combat (GM Tools → Apply Damage to a campaign NPC).
2. Confirm the NPC roster card shows the mortally wounded banner.
3. Advance to a PC medic's turn.
4. Click 🩸 STABILIZE ▾. **Expected:** the NPC's name appears in the list alongside any wounded PCs.
5. Click the NPC's name. **Expected:** same modal flow as the PC path.
6. Roll a success (high CMod if needed). **Expected:**
    - Cascade narrative says "&lt;NPC&gt; stabilized! Incapacitated for N rounds..."
    - The NPC's roster card transitions to Incapacitated.
    - `campaign_npcs.death_countdown` is null in DB (verify via Supabase dashboard if paranoid).

---

## Edge case - race: target healed between dropdown open and roll

If the target's WP is restored to &gt; 0 between when the dropdown opens and when you click Roll (e.g. another player heals them), the cascade should:
- Return narrative: "&lt;target&gt; is no longer mortally wounded."
- NOT write to `character_states` / `campaign_npcs`.
- Medic's action still consumed (the medic committed to the attempt).

This is hard to reproduce manually; mostly a code review check.

---

## Console / network checks (during all of the above)

- Open DevTools Console. **Expected:** zero `[stabilize] character_states update error` or `SILENT RLS FAIL` warnings. (If you see them, RLS gap - check `sql/character-states-rls-fix.sql` is applied.)
- Network tab: each Stabilize attempt should produce:
  - 1× POST to `/rest/v1/roll_log` (saveRollToLog row)
  - 1× PATCH to `/rest/v1/initiative_order` (consumeAction)
  - 1× PATCH to `/rest/v1/character_states` OR `/rest/v1/campaign_npcs` (the cascade write)
  - 0× POST/PATCH for an "action" row (silent pre-consume - matches legacy behavior)

---

## Rollback procedure (if something is wrong)

```sh
git -C /c/TheTapestry revert 2255ced --no-edit
git -C /c/TheTapestry push origin main
```

The legacy `executeRoll` Stabilize branch is preserved unreachable; reverting this commit restores the old `handleRollRequest` dispatch path on the dropdown side. The CharacterCard button removal would also revert (restoring the broken-stats button, but at least giving a working trigger fallback).

---

## After playtest verifies clean

- Mark the **Stabilize Phase 4 - retire legacy executeRoll branch** todo item ready to ship.
- Delete the `if (pendingRoll.label.includes('Stabilize '))` block in `app/stories/[id]/table/page.tsx` (around L6207-6250).
- Decide whether to design a post-combat Stabilize surface (separate todo item).
