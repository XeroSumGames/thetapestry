# Encumbrance Over-Limit RP Drain - Test Plan (2026-05-20)

Canon correction: overloaded characters take **1 RP/hour per point over the limit**, not a flat 1 RP/hour. Xero supplied the dropped manuscript rule 2026-05-20.

**Live URL:** thetapestry.distemperverse.com

---

## Pre-flight (verified)

- [x] `npx vitest run tests/lib/` - 476/476 pass (encumbrance.test.ts has 13, incl. 3 new overBy cases).
- [x] `npx tsc --noEmit` - clean.
- [x] Guardrails (em-dash / font-size / role-literal) - clean.

---

## Manual smoke - the over-by multiplier

Use the over-encumbered character from the bug report (campaign The Arena, char `044ea395-...`) or any PC loaded past their limit.

1. Open the campaign `/table` page as GM.
2. Confirm at least one PC is OVERLOADED (red badge on their card; ENC counter red).
3. GM Tools ▾ → **Time**. The "Overencumbered tick" modal opens.
4. **Verify the modal copy** reads "loses 1 RP per hour for every point over their limit."
5. **Verify each affected row** shows `(N over · -N/h)` next to the name, where N = points over the limit.
6. Set Hours = 1. **Expected per row:** `RP cur → cur-N` (drops by N, not by 1). A character 3 over loses 3 RP in one hour.
7. Set Hours = 2. **Expected:** drops by `2 × N`.
8. Click Apply. **Expected:**
   - Each PC's RP drops by `hours × overBy`.
   - RP floors at 0; any PC hitting exactly 0 (from >0) shows `· INCAP`, gets incap_rounds + a Stress pip via the normal pipeline.
   - Feed shows the `⏳ Time advances Nh · overencumbered: <names (cur→next)>` system row.
   - Campaign clock advances N hours.

## Manual smoke - exactly at limit = no penalty

1. Drop/adjust a character to be EXACTLY at their limit (currentEnc == encLimit).
2. Confirm no OVERLOADED badge.
3. GM Tools → Time. **Expected:** that character is NOT in the affected list (overBy = 0, not overloaded). "No one is overencumbered" if they were the only candidate.

## Manual smoke - drop weight to escape

1. With an overloaded PC, open their inventory, drop/unequip enough to get at or under the limit.
2. The OVERLOADED badge clears.
3. GM Tools → Time. **Expected:** that PC no longer appears in the tick list. RP drain stops (canon: "drop enough weight... keep moving without incurring further RP damage").

---

## NOT in this change (deferred, see todo.md)

- **Movement halved on the tactical map** - overloaded tokens still move at full speed. Canon says half. Deferred (tactical-map cross-cut).
- **Rest 4h → recover half RP** - the specific recovery curve after an encumbrance collapse isn't modeled; the Incap transition fires but recovery uses the existing Rest modal rates. Deferred (Rest-modal audit).

---

## Rollback

```sh
git -C /c/TheTapestry revert <commit> --no-edit
git -C /c/TheTapestry push origin main
```

Reverts to flat 1 RP/hour. No schema or data change - pure compute + UI copy.
