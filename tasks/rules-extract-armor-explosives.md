# Rules Extract - Armor & Special Weapons

Source: Distemper Quickstart Table 7 (Armor) + Table 19 (Special
Weapons). Image-extracted by Xero on 2026-05-09. Locked decisions
folded in. The XSE SRD doesn't cover Armor at all; CRB has prose
about armor stacking + Upkeep but no data table. QS is canon for
the data; user overrides documented inline.

**Status:** decisions locked 2026-05-09 by Xero.

---

## Special Weapons (QS Table 19)

| Name | Skill | Range | Rarity | Damage | RP% | ENC | Clip | Traits |
|---|---|---|---|---|---|---|---|---|
| Flame-Thrower | Demolitions* | Close | Rare | `3+2d6` | 50 | 2 | 30 | Burning (3) |
| Molotov Cocktail | Athletics | Close | Uncommon | `1+1d3` | 50 | 2 | 1 | Tracking; Burning (1) |
| Tranquilizer Gun (Xero override) | Ranged | Medium | Rare | `1d3` | 400 | 1 | 1 | Stun |

**Existing platform state** (`lib/weapons.ts`):

- **Flame-Thrower** already in `HEAVY_WEAPONS` matching QS canon. No change needed.
- **Molotov** in `EXPLOSIVE_WEAPONS` at `5+2d6` Rare 100% RP no Burning trait. Diverges from QS by a lot - flipping to canon: `1+1d3` Uncommon 50% RP + Tracking + Burning(1).
- **Tranquilizer Gun** missing. Adding to `RANGED_WEAPONS` with the override stats - QS canon is `0` damage / 50% RP which renders as 0/0 every hit (useless). Override per Xero: `1d3` base × 400% RP = up to 12 RP per hit (avg 8), one-shot KO on most NPCs, Stun trait fires. Range Medium, Rare ammo, Clip 1.
- **Other explosives** - Grenade / Mortar / Shiv-Grenade / Flash-Bang Grenade / Rocket Launcher - not in QS Table 19. Source for their canonical stats is in a different QS table not yet extracted. Existing values left as-is; flagged for follow-up audit.

---

## Armor (QS Table 7 + Xero overrides)

| Name | Rarity | ENC | DM | Notes |
|---|---|---|---|---|
| Improvised (replaces Chainmail) | Uncommon | 2 | 3 | Requires PHY 1 to wear or -1 CMod to all actions. |
| Leather | Common | 1 | 1 | - |
| Makeshift Shield | Common | 1 | 1 | - |
| Metal Helmet | Uncommon | 0 | 1 | - |
| Plate Steel | Common | 3 | 4 | Requires PHY 1 to wear or -2 CMod to all actions. |
| Riot Gear | Uncommon | 2 | 2 | - |
| Riot Shield | Uncommon | 1 | 1 | **Reactive: DM applies vs melee/unarmed attacks only.** |
| Tactical Armor | Uncommon | 1 | 2 | - |

Eight entries. Chainmail dropped (off-tone for post-apoc) and replaced with **Improvised** at the same stats - represents scrap-metal-lashed-together armor that fits the setting. Riot Shield knocked from -2 → -1 + a reactive flag so it doesn't double-stack with full Riot Gear in head-on engagements (only kicks in vs melee).

---

## Locked design decisions (2026-05-09)

| # | Question | Decision |
|---|---|---|
| 1 | Tranq Gun shape | Ranged · Medium · Rare. `1d3` base × 400% RP via Stun-aware damage path. ENC 1 / Clip 1 / Ammo Rare. Slot in `RANGED_WEAPONS`. |
| 2 | Special-weapon balance pass | Apply QS Table 19 canon to Molotov (significant nerf from existing). Flame-Thrower already matches. Other explosives left until QS Table 18 (or wherever) is extracted. |
| 3 | Chainmail | Replace with Improvised at same stats. |
| 4 | Riot Gear / Riot Shield | Riot Gear DM 2 (unchanged). Riot Shield DM 1 + reactive (applies vs melee/unarmed only). |
| 5 | Stacking | Multiple worn pieces stack DMs additively. Constrained by ENC capacity, not by piece count. |
| 6 | Slot model | **Inventory-driven.** Armor lives in `InventoryItem` with a `worn: boolean` flag. ENC stays same regardless of worn status. Multiple items can be worn at once; DMs aggregate at damage-resolution time. |
| 7 | Upkeep trigger | On Moment of Low Insight (1+1) involving the item during combat. Manual Upkeep button ships in Phase 1; the auto-trigger ships in Phase 2 once combat-state tracking can identify which items were "in scope" for a Low Insight roll. |

---

## Schema (planned)

### `lib/xse-schema.ts`

```ts
export type ArmorTrait =
  | 'reactive_melee_only'    // Riot Shield: DM applies vs melee/unarmed attacks only
  | 'requires_phy_1_or_cmod_1' // Improvised: PHY 1 to wear else -1 CMod
  | 'requires_phy_1_or_cmod_2' // Plate Steel: PHY 1 to wear else -2 CMod

export interface ArmorItem {
  name: string
  rarity: ItemRarity
  enc: number
  dm: number              // positive number, applied as -<dm> defensive modifier
  traits: ArmorTrait[]
  notes: string
}

export const ARMOR: ArmorItem[] = [ /* 8 entries above */ ]
```

### `lib/inventory.ts`

```ts
export interface InventoryItem {
  // existing fields ...
  worn?: boolean          // armor only; toggled from inventory UI
}
```

### Damage flow

`lib/damage.ts:calculateDamage` extends to factor armor:

```ts
calculateDamage(rawWP, rpPercent, defensiveModifier, options?: {
  rpFromRaw?: boolean
  armor?: { dm: number; reactive_melee_only?: boolean }[]
  attackerCategory?: 'melee' | 'ranged' | 'explosive' | 'heavy' | 'unarmed'
})
```

Caller (table page) walks the defender's worn armor, filters reactive pieces by attacker category, sums DMs, passes the array. `calculateDamage` adds the armor DMs to `defensiveModifier` before the WP clamp.

---

## Where rules-page goes

New page: `app/rules/equipment/armor/page.tsx`. Sub-nav anchor in
`lib/rules/sections.ts` under the `equipment` section, after
`upkeep`.

- Renders Table 7 + the Riot Shield reactive note.
- Stacking + Upkeep prose from QS, paraphrased.
- Cross-links to `/rules/equipment/upkeep` for the Upkeep Check
  table (existing).

For Special Weapons: nothing new needed. They land in the existing
`/rules/appendix-equipment` Table 18/19 rendering. The Tranq Gun
addition + Molotov flip propagate automatically once `lib/weapons.ts`
is updated.

---

## Implementation phases

**Phase 1 (this session):**
- Extract doc (this file)
- Tranq Gun in `RANGED_WEAPONS`
- Molotov rebalance
- `ARMOR` constant + `ArmorItem` interface in `xse-schema.ts`
- `worn?: boolean` on `InventoryItem`
- `/rules/equipment/armor` page + sub-nav
- `calculateDamage` armor-aware
- Inventory UI: "Worn" toggle on rows
- Character sheet: total DM aggregate display
- Manual Upkeep button on each worn armor

**Phase 2 (follow-up):**
- Auto-upkeep on Low Insight: track during combat which items
  were involved in Low Insight rolls; fire upkeep at combat-end
  on that subset.
- Other explosive weapons audit against QS Table 18 once available.
- Apprentice / First Impression / Inspiration / Recruitment
  disambiguation (separate todo).
