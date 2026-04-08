# Revealed NPC Icons — Test Plan

## What changed
Fixed z-index on revealed NPC icons at bottom of center panel so they appear above map overlays and character sheets during combat.

## Steps to test
1. Open a story table as a **player** (not GM)
2. The GM should reveal at least one NPC to your character (via the NPC roster Show button)
3. Verify small NPC icons appear at the bottom of the center panel
4. Open your character sheet (inline mode) — verify the NPC icons still show above it
5. Enter combat — verify the icons persist
6. If no NPCs appear, check that `npc_relationships` has rows with `revealed = true` for your character
