# Quickstart Canon Promotion - Test Plan (2026-05-08)

Batch: Stabilise FIX, Dice Check action, Subsistence Damage canon,
Rations rarity fix, new Rations rules page. Lasting Wounds Table 12 +
Item Condition Table 10 already shipped - verified in audit.

Live URL: `https://thetapestry.distemperverse.com`

---

## 1. Stabilise duration FIX

**File:** `app/rules/combat/incapacitation/page.tsx:71` - copy now reads
`1d6 − PHY AMod rounds (minimum 1 round)`. Code at
`app/stories/[id]/table/page.tsx:5076` and `:5091` already uses
`Math.floor(Math.random() * 6) + 1 - phyAmod` (1d6 − PHY); only the
rules page copy was wrong.

**Smoke (rules page):**
1. Open `/rules/combat/incapacitation`.
2. Find the **Stabilise** section.
3. Confirm copy reads `1d6 − PHY AMod rounds`. **Not** `16 − PHY AMod`.

**Smoke (in-game, optional regression):**
1. Open `/dashboard` → an active campaign with a downed PC (WP=0).
2. Have an adjacent PC click **Stabilize** → roll Medicine* succeeds.
3. Confirm the result line reads
   `Stabilized! Incapacitated for N round(s), then regains 1 WP + 1 RP.`
   where `N` ∈ `[1, 6 − PHY AMod]` (cap at min 1). Same for NPC target.

---

## 2. Dice Check 18th combat action

**File:** `app/rules/combat/combat-rounds/page.tsx` - new row inserted
between `Defend` and `Distract`.

**Smoke:**
1. Open `/rules/combat/combat-rounds`.
2. Scroll to the Actions table.
3. Confirm 18 rows total. Confirm `Dice Check` is row 7 (between
   Defend and Distract), Cost = 1, effect = `Use to make any Attribute
   or Skill check.`

---

## 3. Subsistence Damage canon update

**File:** `app/rules/combat/damage/page.tsx` - `Starvation & Dehydration`
sub-section renamed to `Subsistence Damage`, anchor id changed from
`starvation` → `subsistence`. Copy updated to QS canon:
- Day 1: no impact.
- Day 2+: `1 WP and 1 RP per day`.
- RP=0 → Incapacitated; WP=0 → Mortally Wounded; must be fed +
  Stabilised or dies.
- Recovery: `1 WP and 1 RP per day` once food/water is restored.
- Link to `/rules/equipment/rations`.

**Smoke (rules page):**
1. Open `/rules/combat/damage`.
2. Scroll to Environmental Damage. Confirm sub-section title is
   `Subsistence Damage` (not `Starvation & Dehydration`).
3. Click the inline link to `Rations` - should land on
   `/rules/equipment/rations` without 404.

**GM tool spot-check:**
1. On the table page, click a PC's row to open their inline
   character sheet. (You can also click `🎲 Dice Check` in the
   action bar during their turn - same sheet opens.)
2. Scroll to the bottom row labeled `GM Actions: Rest, Stress,
   Environmental Damage`. The three buttons are
   **Rest | Reduce Stress | Env. Damage**.
3. Click **Env. Damage** → prompt asks 1=Falling / 2=Drowning /
   3=Subsistence. Confirm option 3 reads
   `Subsistence (1 WP + 1 RP/day, day 2+)`.
4. Pick option 3 - confirm the PC loses **both** 1 WP and 1 RP
   (previously only RP was deducted).

---

## 4. Rations rules page (new)

**File:** `app/rules/equipment/rations/page.tsx` - Table 16 reference;
3 entries: Standard / Luxury / Military Grade. `lib/rules/sections.ts`
gets a new `rations` anchor in the `equipment` section.

**Smoke:**
1. Open `/rules/equipment` → confirm sub-nav has a `Rations` pill at
   the end (after Item Condition, Item Traits, Upkeep).
2. Click into `Rations`. Confirm 3 rows in the table:
   - Standard Rations - Common - ENC 0.5
   - Luxury Rations - Uncommon - ENC 0.5
   - Military Grade Rations - Rare - ENC 0.25
3. Confirm the closing paragraph notes `2 Rations` as the starting
   default.

---

## 5. Wizard Rations rarity fix

**File:** `components/wizard/StepEight.tsx` - Luxury Rations
`Uncommon` → `Common`; copy tightened to `1 day food + water`.

**Smoke:**
1. Open `/characters/new` → walk through to **Step 8 (Equipment)**.
2. Scroll to the Rations row. Confirm:
   - Standard Rations chip header: green `COMMON`.
   - Luxury Rations chip header: blue `UNCOMMON`.
   - Military Grade chip header: amber `RARE`.

---

## 6. Type-check + guardrail

- `npx tsc --noEmit` → exit 0.
- `node scripts/check-font-sizes.mjs` → OK; no offenders.

---

## Out of scope (parked)

- **`2 starting Rations` data-model change.** `XSECharacter.rations`
  is currently a single string. Promoting to a quantity (e.g.
  `{ type: 'Standard', count: 2 }`) requires a wizard + persistence
  + edit-page change and a DB-side migration on existing characters.
  Flagged in `tasks/open-work-checklist-2026-05-06.md`. The new
  rules page documents the canonical default; the wizard still
  takes a single optional pick.
- **Special / Explosive Weapons + Armor system** - both still parked
  on Xero design call (per the May-06 checklist).
