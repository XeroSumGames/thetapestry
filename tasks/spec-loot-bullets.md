# Spec: Loot Bullets

**Feature:** A looted ranged weapon comes with `1d6 - 1` rounds (0-5) of its own ammo type.
**Lane:** Hunt & Peck
**Confirmed:** 2026-06-23 (Xero)
**Status:** Ready to implement

---

## 1. Overview

When a player loots a ranged weapon -- from an NPC corpse or an object/container -- the system rolls `1d6 - 1` and grants that many rounds of the appropriate ammo type to the looting character's inventory. A result of 0 means the weapon is empty; no ammo item is added. Melee, explosive, and heavy weapons with no ammo type are skipped silently.

**Scope is weapon looting only.** Plain search of remains (non-weapon inventory items via `loot_npc_item`) does not spawn loose ammo. This matches Xero's note: "No standalone loose-ammo on a plain search."

---

## 2. Ammo Type Map

No ammo item names currently exist in the codebase. This spec defines them. Add a new exported constant to `lib/weapons.ts`:

```ts
// Maps weapon name to the inventory item name for its ammo.
// Weapons not in this map have no ammo (melee, explosives, etc.).
export const WEAPON_AMMO_ITEM: Record<string, string> = {
  // Common ammo (pistol caliber / shotgun / primitive projectiles)
  'Light Pistol':           'Pistol Rounds',
  'Shotgun (Pump-Action)':  'Shotgun Shells',
  'Shotgun (Sawed-Off)':    'Shotgun Shells',
  'Slingshot':              'Sling Stones',
  'Bow':                    'Arrows',
  'Compound Bow':           'Arrows',

  // Uncommon ammo (rifle caliber / crossbow bolts)
  'Automatic Rifle':        'Rifle Rounds',
  'Black Powder Rifle':     'Black Powder Charges',
  'Bolt-Action / Pump Rifle': 'Rifle Rounds',
  'Carbine':                'Rifle Rounds',
  'Crossbow':               'Crossbow Bolts',
  'Heavy Pistol':           'Heavy Pistol Rounds',
  'Hunting Rifle':          'Rifle Rounds',
  "Sniper's Rifle":         'Rifle Rounds',

  // Rare ammo
  'Tranquilizer Gun':       'Tranq Darts',
  'Taser':                  'Taser Cartridges',
}
```

**Design note:** The `ammoRarity` field on `RangedWeapon` (in `lib/xse-schema.ts`) distinguishes rarity tier but cannot distinguish caliber -- both `Light Pistol` (Common) and `Bow` (Common) are different ammo types. The map must key off weapon name, not rarity. The map above covers all 14 entries in `RANGED_WEAPONS` in `lib/weapons.ts` plus the 14 entries in `lib/xse-schema.ts:RANGED_WEAPONS`. Confirm the two arrays are consistent before shipping; add any weapon present in only one source.

**Weapons intentionally excluded (no ammo key):** all melee, Grenade, Flash-Bang, Molotov, Mortar, Rocket Launcher, Flame-Thrower. These either have no `ammo` field or their "ammo" is the weapon itself (thrown). If any of these appear in `WEAPON_AMMO_ITEM` via future additions, the feature will auto-handle them.

---

## 3. Dice Mechanic

```
rounds = Math.max(0, Math.floor(Math.random() * 6))   // equivalent to 1d6 - 1, range 0-5
```

Implement as a helper in `lib/weapons.ts` alongside the map:

```ts
/** Roll 1d6-1 to determine how many rounds come with a looted ranged weapon (0-5). */
export function rollLootedAmmo(): number {
  return Math.max(0, Math.floor(Math.random() * 6))
}
```

---

## 4. Trigger Points

There are two distinct loot paths. Both must be updated.

### 4a. NPC Corpse / Equipment Slot Loot (primary path)

**File:** `sql/loot-npc-equipment-rpc.sql`
**RPC:** `public.loot_npc_equipment_item(p_npc_id uuid, p_character_id uuid, p_weapon_slot text)`
**Called from:** `components/PlayerNpcCard.tsx` line 366 (`takeEquipmentItem`)

The RPC already writes the weapon to the PC's `data.inventory` JSONB array (lines 130-162 in the SQL file). After that write and before the `RETURN jsonb_build_object('ok', true)`, add a second inventory append for the ammo item if `ammo_rounds > 0`.

The RPC has access to the full weapon name (`v_weapon_name`) after it reads the NPC's skills slot. The ammo lookup and dice roll must happen inside the SQL function (so it's atomic and audited) or the client must make a second call immediately after the RPC succeeds.

**Recommended approach: SQL-side (same transaction)**

Add to the RPC after the weapon inventory write (around line 162):

1. Compute `v_ammo_rounds := floor(random() * 6)::int` (0-5).
2. Look up the ammo item name from a CASE expression or a new helper function keyed on `v_weapon_name`.
3. If `v_ammo_rounds > 0` and `v_ammo_name IS NOT NULL`:
   - Scan `v_new_pc_inv` for an existing `{ name: v_ammo_name, custom: false }` entry.
   - If found, increment `qty` at that index (same pattern as the existing weapon dedup logic at lines 136-149).
   - If not found, append `jsonb_build_object('name', v_ammo_name, 'qty', v_ammo_rounds, 'custom', false)`.
4. The final `UPDATE public.characters SET data = jsonb_set(...)` already covers this because `v_new_pc_inv` is what gets persisted -- just ensure the ammo append happens to `v_new_pc_inv` before that line.
5. Return `v_ammo_rounds` and `v_ammo_name` in the result JSON: `jsonb_build_object('ok', true, 'ammo_name', v_ammo_name, 'ammo_qty', v_ammo_rounds)`.

**The CASE expression for ammo name in SQL:**

```sql
v_ammo_name := CASE v_weapon_name
  WHEN 'Light Pistol'             THEN 'Pistol Rounds'
  WHEN 'Shotgun (Pump-Action)'    THEN 'Shotgun Shells'
  WHEN 'Shotgun (Sawed-Off)'      THEN 'Shotgun Shells'
  WHEN 'Slingshot'                THEN 'Sling Stones'
  WHEN 'Bow'                      THEN 'Arrows'
  WHEN 'Compound Bow'             THEN 'Arrows'
  WHEN 'Automatic Rifle'          THEN 'Rifle Rounds'
  WHEN 'Black Powder Rifle'       THEN 'Black Powder Charges'
  WHEN 'Bolt-Action / Pump Rifle' THEN 'Rifle Rounds'
  WHEN 'Carbine'                  THEN 'Rifle Rounds'
  WHEN 'Crossbow'                 THEN 'Crossbow Bolts'
  WHEN 'Heavy Pistol'             THEN 'Heavy Pistol Rounds'
  WHEN 'Hunting Rifle'            THEN 'Rifle Rounds'
  WHEN 'Sniper''s Rifle'          THEN 'Rifle Rounds'
  WHEN 'Tranquilizer Gun'         THEN 'Tranq Darts'
  WHEN 'Taser'                    THEN 'Taser Cartridges'
  ELSE NULL
END;
```

`NULL` means non-ranged or unmapped -- skip ammo entirely.

**After the RPC returns in `components/PlayerNpcCard.tsx` (line 376):**

The result type expands from `{ ok: boolean; error?: string }` to:

```ts
const result = data as { ok: boolean; error?: string; ammo_name?: string; ammo_qty?: number } | null
```

Pass `ammo_name` and `ammo_qty` to the roll-feed notification (see section 6).

### 4b. Object / Container Loot (secondary path)

**File:** `components/ObjectCard.tsx`
**Functions:** `takeOne` (line 113, player self-loot) and `giveOne` (line 137, GM gives to PC)

Object containers store items as `ContentItem` (type, name, quantity) -- no ammo field. When a weapon item is taken:

1. Import `WEAPON_AMMO_ITEM` and `rollLootedAmmo` from `lib/weapons.ts`.
2. After writing the weapon to `character.data.equipment` (the string array), check `WEAPON_AMMO_ITEM[item.name]`.
3. If a mapping exists, roll `rollLootedAmmo()`.
4. If `rounds > 0`: load the character's current `data.inventory` from the DB, append or increment the ammo entry, and write back. Use a single `supabase.from('characters').update(...)` call.
5. Pass `ammoName` and `rounds` to `onLoot?.(...)` so the parent (`page.tsx`) can include them in the roll-feed label.

**Note on the equipment vs inventory split:** Object loot currently writes weapons into `character.data.equipment` (string array), not `character.data.inventory` (JSONB). This is the existing behavior for object containers -- the spec does not change that. Ammo, however, should go into `data.inventory` (where all stackable items live) regardless of where the weapon goes.

The `onLoot` callback signature in `page.tsx` currently receives `(containerName, item, characterId, characterName)`. Extend it to include optional ammo fields:

```ts
onLoot?: (
  containerName: string,
  item: ContentItem & { quantity: number },
  characterId: string,
  characterName: string,
  ammoName?: string,
  ammoQty?: number
) => void
```

---

## 5. Edge Cases

| Case | Behavior |
|---|---|
| Roll is 0 | No ammo item added. Notification says "empty" (see section 6). |
| Character already has that ammo type | `qty` increments on the existing inventory entry. Do NOT create a duplicate row. |
| Weapon has no ammo type (melee, explosive) | `WEAPON_AMMO_ITEM` returns `undefined`. Skip ammo entirely, no roll. |
| Weapon name not in the map (unknown future weapon) | `WEAPON_AMMO_ITEM` returns `undefined`. Skip ammo. Log a warning in dev: `console.warn('[loot-bullets] unmapped weapon:', weaponName)`. |
| NPC has `ammoCurrent = 0` on their `CharacterWeapon` slot | Still roll. The NPC's loaded-ammo state reflects their combat use; the loot roll represents loose rounds elsewhere on the body, not the chamber. |
| "Take All" button in PlayerNpcCard (`takeAllItems`) | Calls `takeItem` in a loop, which calls `takeEquipmentItem` for each weapon slot. Each weapon gets its own independent roll. No change needed to the loop logic. |
| Container has multiple of the same weapon (quantity > 1) | Each individual `takeOne` call triggers one roll. If the player takes 3 Light Pistols one at a time, they get 3 independent rolls. This is correct behavior. |

---

## 6. Roll Feed / UI Notification

### NPC weapon loot (via `loot_npc_equipment_item`)

Current label (from `lib/roll-helpers.ts` line 953):
```
<PC> looted a <weapon> from <NPC>
```

New label when ammo is granted (`ammo_qty > 0`):
```
<PC> looted a <weapon> from <NPC> (with <N> <ammo_name>)
```

New label when roll is 0:
```
<PC> looted a <weapon> from <NPC> (empty)
```

The label is built in `lib/roll-helpers.ts` where `loot_npc_equipment_item` labels are parsed/constructed. The RPC now returns `ammo_name` and `ammo_qty` in the result JSON. The client must include them when it inserts the roll-log row, or the RPC can build the full label itself and emit it via its existing `INSERT INTO roll_log` call.

**Preferred:** let the SQL RPC build the full label (it already inserts into `roll_log` at line 173). Extend the SQL label string:

```sql
-- ammo suffix
v_ammo_suffix := CASE
  WHEN v_ammo_rounds > 0 THEN ' (with ' || v_ammo_rounds || ' ' || v_ammo_name || ')'
  WHEN v_ammo_name IS NOT NULL THEN ' (empty)'
  ELSE ''
END;

-- existing label line
v_label := v_pc.name || ' looted a ' || v_weapon_name || ' from ' || v_npc.name || v_ammo_suffix;
```

The `roll-feed-log-preview.html` at `tasks/roll-feed-log-preview.html` must be updated to show the new label variant. Add an example row for each case (weapon with ammo, weapon empty, melee weapon unchanged).

### Object container loot

Current label (from `page.tsx` ~line 7033):
```
<characterName> looted <item.name> from <objectName>
```

New label when ammo granted:
```
<characterName> looted <item.name> from <objectName> (with <N> <ammoName>)
```

New label when roll is 0:
```
<characterName> looted <item.name> from <objectName> (empty)
```

Implement in the `onLoot` handler inside `page.tsx` using the extended callback signature from section 4b.

---

## 7. New RPC vs Client-Side

**NPC loot path: extend the existing SQL RPC.** The existing `loot_npc_equipment_item` already runs as SECURITY DEFINER and owns the inventory write. Adding the ammo append inside the same transaction is the correct approach -- atomic, audited, consistent. No new RPC needed.

**Object container loot path: client-side.** The container loot path in `ObjectCard.tsx` already writes client-side (line 119: `supabase.from('characters').update(...)`). The ammo write follows the same pattern: read current `data.inventory`, append/increment, write back. No RPC is needed here because the client already has full access to the character row via the existing Supabase query.

---

## 8. Files to Change

| File | Change |
|---|---|
| `lib/weapons.ts` | Add `WEAPON_AMMO_ITEM` map and `rollLootedAmmo()` helper |
| `sql/loot-npc-equipment-rpc.sql` | Add ammo roll + CASE lookup + inventory append + label suffix |
| `components/PlayerNpcCard.tsx` | Extend result type to include `ammo_name`/`ammo_qty` |
| `components/ObjectCard.tsx` | Import map + helper; append ammo write; extend `onLoot` callback |
| `app/stories/[id]/table/page.tsx` | Extend `onLoot` handler to use ammo fields in roll-feed label |
| `tasks/roll-feed-log-preview.html` | Add example rows for weapon-with-ammo and empty-weapon loot |

Do NOT create a new SQL migration file for the RPC change -- follow project convention: update `sql/loot-npc-equipment-rpc.sql` in place and apply with `npx supabase db query --linked -f sql/loot-npc-equipment-rpc.sql`.

---

## 9. Test Approach

### Unit tests (`tests/lib/`)

Add to the existing roll-helpers test file (`tests/lib/roll-helpers.test.ts`) or create `tests/lib/loot-bullets.test.ts`:

1. **`rollLootedAmmo` distribution** -- call 1000 times, assert all results are integers 0-5 inclusive, assert 0 appears (it will).
2. **`WEAPON_AMMO_ITEM` coverage** -- assert every entry in `RANGED_WEAPONS` (from `lib/weapons.ts`) that has an `ammo` field is present in `WEAPON_AMMO_ITEM` as a key.
3. **`WEAPON_AMMO_ITEM` exclusions** -- assert that melee weapon names are NOT present as keys in the map (spot-check: `'Hunting Knife'`, `'Bat'`).
4. **Roll-feed label** -- mock `loot_npc_equipment_item` result with `{ ok: true, ammo_name: 'Pistol Rounds', ammo_qty: 3 }` and assert the rendered label contains `"(with 3 Pistol Rounds)"`.
5. **Empty roll label** -- mock result with `{ ok: true, ammo_name: 'Pistol Rounds', ammo_qty: 0 }` and assert label contains `"(empty)"`.
6. **Melee label unchanged** -- mock result with `{ ok: true, ammo_name: null, ammo_qty: 0 }` (melee) and assert label has no suffix.

### Manual smoke tests

Write to `tasks/loot-bullets-testplan.md` (separate file, per naming convention).

Key scenarios:
- Loot a Light Pistol from a downed NPC; confirm inventory shows "Pistol Rounds" with qty 0-5; confirm roll-feed label matches.
- Loot the same NPC again (already looted that weapon slot); confirm the slot is gone and the action is blocked.
- Loot a Hunting Knife from the same corpse; confirm no ammo is added.
- Loot a Bow; confirm "Arrows" appear (not "Pistol Rounds").
- Loot a weapon from an object container; confirm same ammo behavior.
- Loot a weapon when character already has matching ammo; confirm qty stacks, no duplicate entry.
- Roll result of 0: loot a weapon and see "(empty)" in the feed, no ammo in inventory.
