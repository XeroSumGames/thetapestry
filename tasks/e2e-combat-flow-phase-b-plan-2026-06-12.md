# E2E Combat-Flow Phase B - Plan

**Status:** READY TO RUN (testids shipped 2026-05-31; this was the only blocker)
**Target:** `e2e/combat-flow.spec.ts` - add Phase B after the existing Phases A + C
**Effort:** ~45-60 min
**Lane:** Playwright / E2E

---

## What Phase B covers

DOM ordering + action-decrement assertions. While Phase A proves combat starts
correctly and Phase C proves damage resolves, Phase B verifies the per-turn
mechanics players actually feel during play:

1. Initiative bar renders combatants in the correct order (highest Agility first,
   ties broken alphabetically).
2. The active combatant's row has `data-testid="initiative-row-active"`.
3. Attacking a target decrements the attacker's `actions_remaining` in the DOM.
4. When `actions_remaining` hits 0, `nextTurn` fires and the NEXT combatant
   becomes active (the `initiative-row-active` testid shifts).
5. Roll feed: each attack produces a row with `data-testid="roll-feed-row-<id>"`
   and the result row carries `data-testid="roll-feed-attack-result"`.

---

## Testids available (shipped 2026-05-31)

| testid | Location | Meaning |
|---|---|---|
| `initiative-row-<id>` | `initiative_order.id` | Each combatant row in the initiative bar |
| `initiative-row-active` | active combatant's row | The currently-acting combatant |
| `roll-feed-row-<id>` | `roll_log.id` | Each feed row |
| `roll-feed-attack-result` | result section of an attack row | Attack outcome chip |

---

## Spec shape (add after Phase C block in `e2e/combat-flow.spec.ts`)

```ts
test('Phase B - initiative ordering + action decrement + feed row testids', async ({ page, page2 }) => {
  // --- Setup: use the same campaign + PCs from Phase A ---
  // Assumes combat is already started (initiative_order populated).
  // If running standalone, start combat first per the Phase A helper.

  // 1. Initiative bar renders in order
  const initRows = page.locator('[data-testid^="initiative-row-"]')
  await expect(initRows).toHaveCount(/* expected combatant count */ 2)

  // 2. Active row exists
  const activeRow = page.locator('[data-testid="initiative-row-active"]')
  await expect(activeRow).toBeVisible()

  // 3. GM fires an attack (weapon roll via the Roll modal)
  // Fire via gm_apply_damage RPC to keep the test deterministic (same as Phase C)
  // OR use the Roll button if the combat is already set up with a targeted NPC.
  // The Phase C helper (applyGmDamage) is the preferred approach.
  await applyGmDamage(page, targetId, 1) // 1 WP damage

  // 4. Feed row appears with the attack testid
  const feedRow = page.locator('[data-testid^="roll-feed-row-"]').first()
  await expect(feedRow).toBeVisible()
  const attackResult = page.locator('[data-testid="roll-feed-attack-result"]').first()
  await expect(attackResult).toBeVisible()

  // 5. On page2 (player client), the feed row also appears
  await expect(page2.locator('[data-testid^="roll-feed-row-"]').first()).toBeVisible()

  // 6. After consuming all actions, nextTurn fires and active row shifts
  // consume second action via another gm_apply_damage or Roll
  await applyGmDamage(page, targetId, 1)
  // now the PREVIOUS active id should NOT have initiative-row-active
  // and a new id should have it
  await expect(activeRow).not.toBeAttached() // old active ref gone
  const newActiveRow = page.locator('[data-testid="initiative-row-active"]')
  await expect(newActiveRow).toBeVisible()
  // confirm the new active is a DIFFERENT combatant
  const newActiveText = await newActiveRow.textContent()
  const oldActiveText = /* capture before consuming actions */ ''
  expect(newActiveText).not.toBe(oldActiveText)
})
```

---

## Implementation notes

- **`applyGmDamage` helper** already exists in `combat-flow.spec.ts` from Phase C.
  Reuse it for Phase B - keeps the test deterministic (no dice variance).
- **Action cost for `gm_apply_damage`**: the RPC does NOT consume initiative
  actions - it's a pure DB write for testing. To test action-decrement, you need
  to fire an actual weapon roll through the UI (Roll button) OR directly update
  `initiative_order.actions_remaining` via a test-only RPC.
  Recommendation: write a minimal `consumeAction(entryId)` Supabase call in the
  test helper that decrements actions_remaining by the active entry's cost (2 for
  most attacks). This is safer than clicking through the full Roll modal.
- **Cross-client assertion (step 5)**: the feed row propagates via realtime
  broadcast. Wait for it with a reasonable timeout (default Playwright 5s is fine
  for prod).
- **State isolation**: run Phase B in the same `test.describe` as A + C, sharing
  the `beforeAll` campaign + PC setup. Do NOT create a separate campaign.

---

## Acceptance

- `npm run test:e2e` - Phase B passes in the full suite.
- Both the GM client and the player client see the feed rows.
- The `initiative-row-active` testid shifts to the next combatant after actions
  are exhausted.
- E2E results dashboard updated in place (add Phase B row to the spec table).

---

## After Phase B: remaining E2E items

1. **End-of-combat infection banner** - ~15 min standalone. `gm_apply_damage`
   v3 RPC is live. Locator target: the infection banner that appears after a
   mortal wound goes untreated (look for the infection-risk feed row or the
   yellow banner in the action area).
2. **Full re-cert** - `npm run test:e2e` green on prod, update
   `tasks/e2e-results.html` in place. This is the final gate.
