# Test Plan — Map selection → Attack target pre-pop + Object card on double-click

## Changes under test

1. Single-clicking a token on the tactical map now reports the selection up to the table page.
2. When the active combatant clicks ATTACK, the target dropdown is pre-populated with the map-selected token (if valid). Map selection overrides `last_attack_target`.
3. Double-clicking an object token on the map now opens an **Object Card** with name, WP/integrity bar, portrait/color, and (revealed) properties. GM also sees hidden properties and contents.

## Setup

- `npm run dev` running on `http://localhost:3000` (or 3001).
- Open the campaign's table page in two browsers:
  - **GM** — signed in as campaign GM.
  - **Player** — a player with a PC in the story.
- Have a tactical scene active with: the player's PC, at least 2 NPCs ("Goon 1", "Goon 2"), and at least one object token with WP (e.g., a "Crate" with wp_max > 0).
- Start combat.

---

## Test cases

### 1. Selection pre-pop — PC attacker targets an NPC
- **Setup:** Player's PC is the active combatant. Equipped weapon ready.
- **Steps:**
  1. Player single-clicks "Goon 1" on the map (selection ring appears).
  2. Player clicks ATTACK.
- **Expect:**
  - Target dropdown shows "Goon 1" pre-selected.
  - CMod reflects Goon 1's rapid defensive modifier (DEX for ranged, PHY for melee), any coord bonus.
  - Range band auto-set from token distance.

### 2. Selection pre-pop — object target
- **Setup:** Player's PC active, crate visible with WP.
- **Steps:** Click the "Crate" token, then click ATTACK.
- **Expect:**
  - Target dropdown shows "Crate" pre-selected.
  - CMod has defensive mod = 0 (objects don't dodge).
  - Range band auto-set.

### 3. Selection overrides `last_attack_target`
- **Setup:** Active PC has already attacked "Goon 1" this turn (so `last_attack_target === "Goon 1"`).
- **Steps:** Click "Goon 2" on map, click ATTACK again.
- **Expect:**
  - Target = "Goon 2" (not Goon 1).
  - No +1 same-target bonus (different target than last attack).

### 4. Invalid selection falls back to last target
- **Setup:** A dead NPC token remains visible (wp_current = 0), `last_attack_target = "Goon 1"` (alive).
- **Steps:** Click the dead NPC, click ATTACK.
- **Expect:** Target pre-populates to "Goon 1" (the last target) — dead selection is rejected, fallback kicks in. No crash.

### 5. Attacker cannot target themselves
- **Setup:** Active PC.
- **Steps:** Click own PC token, click ATTACK.
- **Expect:** Target dropdown falls back to `last_attack_target` or empty. Never pre-selects the attacker's own name.

### 6. Clearing selection
- **Setup:** No previous attack this turn.
- **Steps:** Select Goon 1, then click an empty cell on the map (selection clears). Click ATTACK.
- **Expect:** Target dropdown empty (no pre-pop).

### 7. Regression — double-click NPC opens NpcCard
- **Steps:** Double-click any NPC token.
- **Expect:** Existing behavior — `NpcCard` opens. Close button works. No new object card appears.

### 8. Regression — double-click character opens sheet
- **Steps:** Double-click a PC token.
- **Expect:** Existing behavior — `CharacterCard` / sheet opens.

### 9. Double-click object opens ObjectCard (GM)
- **Setup:** Crate with properties including some `revealed: false`.
- **Steps:** GM double-clicks the crate.
- **Expect:**
  - Draggable inline card appears: name, WP bar, portrait/color swatch.
  - All properties visible, hidden ones labeled `(hidden)`.
  - Contents list shown under "Contents (GM)".
  - Close button dismisses.

### 10. Double-click object opens ObjectCard (player)
- **Setup:** Same crate.
- **Steps:** Player double-clicks the crate.
- **Expect:**
  - Card shows name, WP bar, portrait/color.
  - Only **revealed** properties shown. No hidden properties. No contents list.

### 11. Live WP sync on ObjectCard
- **Steps:** Open ObjectCard for Crate (WP 10/10). GM damages the crate via any existing flow so its `wp_current` updates.
- **Expect:** The open card's WP bar decreases without re-opening the card.

### 12. Multiple ObjectCards simultaneously
- **Steps:** Double-click two different objects.
- **Expect:** Both cards visible, each draggable and closeable independently.

### 13. Toggle-off by re-double-clicking same object
- **Steps:** Double-click an object (card opens). Double-click the same object again.
- **Expect:** Card closes.

### 14. Selection ring still drawn in TacticalMap
- **Steps:** Single-click any token.
- **Expect:** Existing selection ring appears — no visual regression.

### 15. Manual target change still works
- **Steps:** Open attack modal with pre-populated target. Use the dropdown to change target.
- **Expect:** CMod, defensive mod, range band recompute on change (existing `onChange` behavior unchanged).

---

## Pass criteria
All 15 cases behave as described with no console errors related to the new code path and no regressions in the combat flow.
