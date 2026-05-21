# Testplan: Grenade/Molotov throw-time auto-decrement (2026-05-21)

**What shipped:** explosives now spend 1 from their weapon-slot `qty` every time they are thrown in combat, and the Attack button locks when the count hits 0. Explosives were also removed from the clip/ammo "Reload" system (root-cause fix - see below).

**Surface:** all in `app/stories/[id]/table/page.tsx`. No schema change (qty is jsonb on the weapon slot).

**Live site:** https://thetapestry.distemperverse.com (Vercel deploy = the test env; give it ~1-2 min after the push to build).

---

## Why this also touched the ammo system (read first)

Grenades/Molotovs carry `clip: 1` in `lib/weapons.ts`. The old ranged-ammo decrement and the "empty, Reload" button gate both key off `clip`, so BEFORE this fix, throwing a grenade quietly drained its `ammoCurrent` to 0 and greyed the Attack button as "empty, Reload" - the qty carry-count feature was dead after one throw. This fix excludes `category:'explosive'` weapons from BOTH the ammo decrement and the `outOfAmmo` gate, so `qty` is now their only counter. If you see a grenade ask to "Reload," this fix regressed.

---

## Setup

1. Open a campaign with an active tactical scene and combat running.
   `notepad` not needed - this is all in-app at the table page.
2. Give a PC an explosive in a weapon slot with a known count:
   - Character sheet -> weapon slot -> pick **Grenade** -> set the **Quantity** stepper to **3**.
3. Give an NPC an explosive too:
   - GM NPC editor (NpcRoster) -> weapon slot -> pick **Molotov** -> set **Quantity** to **2**.
4. Put both the PC and NPC token on the map, in an active combat with initiative running.

---

## Golden path

### PC grenade decrement
1. On the PC's turn, click **Attack (Grenade)**. Throw it at an enemy token or an empty cell.
2. Resolve the roll (any outcome).
3. **EXPECT:** the PC's Grenade slot now reads **×2** (was ×3). Check on the character sheet / weapon chip.
4. Throw again -> **×1**. Throw again -> **×0**.
5. At ×0: the **Attack (Grenade)** button is greyed, reads **"- none left"**, and clicking it pops `Grenade - none left to throw.` The grenade is still listed in the slot (not deleted).

### NPC molotov decrement
6. On the NPC's turn (GM rolls), click **Attack (Molotov)**, throw it.
7. **EXPECT:** the NPC's Molotov chip on the NpcCard drops from **×2** to **×1** immediately (no refresh needed).
8. Throw again -> ×0 -> button greys + "none left".

### Decrement on a MISS (the important edge case)
9. Reset a thrower to qty 2. Throw and roll a **Failure / Dire Failure** (a miss/fumble).
10. **EXPECT:** qty STILL drops by 1. A thrown explosive is consumed whether or not it lands - pin pulled / bottle lit regardless.

### Molotov + Flash-Bang specifically (no Blast Radius trait)
11. Confirm a **Molotov** throw decrements (it has no Blast Radius trait, so it takes a different internal path than a Grenade). Then confirm a **Flash-Bang Grenade** throw decrements too.

---

## Regression checks (must NOT break)

- **R1 - no "Reload" on grenades.** Throwing a grenade must NEVER grey the button as "empty, Reload". Only "none left" at qty 0.
- **R2 - real ammo weapons still gate.** A Bow / Pistol / Crossbow still decrements `ammoCurrent` and still shows "empty, Reload" at 0. This fix only carved explosives out of that system.
- **R3 - non-explosive attacks unaffected.** Melee, unarmed, ranged - no qty behavior, no new gating.
- **R4 - blast/fumble still resolves.** SMOKE-1/2/3 behavior (self-blast turn advance, coord-effort banner, faction-aware friendly-fire) unchanged - this fix is additive in `executeRoll` and doesn't touch the blast AoE.
- **R5 - legacy explosive (no qty set).** An explosive set before the qty feature (no `qty` field) is treated as throwable (defaults to 1 remaining); it should NOT be locked at 0 on sight.

---

## Known open follow-up (flagged to Xero, NOT a bug in this ship)

**Mortar + Rocket Launcher** are also `category:'explosive'` and carry their own `ammo` rarity + reloads. With this fix they now decrement by `qty` like grenades and no longer use the clip/reload gate. If you intend those two to be reloadable heavy weapons rather than carry-N consumables, that is a separate weapon-classification decision - say the word and it gets its own ticket.

---

## Automated gates (all green at ship)

- `npx tsc --noEmit` - clean
- `node scripts/check-font-sizes.mjs` / `check-role-literals.mjs` / `check-em-dashes.mjs` / `check-preview-sync.mjs` - clean
- `npm test --silent` - 476/476
- No unit test added: the change is inline combat-surface + supabase-write logic (no extractable pure unit beyond a trivial `Math.max(0, n-1)`), consistent with how the carry-qty feature itself shipped. Verification is this manual smoke.

## Revert

Single commit, single file (plus docs). To undo:

```
git revert <commit-sha> --no-edit && git push origin main
```
