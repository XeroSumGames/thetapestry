# Skill-description tooltips testplan - 2026-05-12

Commit: `bc24db9 feat(character-card): skill chip hover tooltips show canonical descriptions`

Wires `lib/xse-schema.ts:SKILLS[].description` to a native `title` attribute
on every skill chip in the CharacterCard skills grid. Native browser
tooltip: ~500ms hover delay, plain styling, accessible by default.

## Where to test

- Any character sheet that surfaces `<CharacterCard>`. Easiest path:
  Campaigns -> open a campaign -> click a member's character name.
- Random-character generator: `/characters/random` also renders
  `<CharacterCard>` once a character is rolled.

## Golden path

1. Open a character with multiple raised skills (a Medic is ideal -
   they have Medicine* raised).
2. Hover over Medicine* (the green raised chip).
3. After ~500ms, the browser tooltip should appear:
   "Providing first aid, diagnosis, treatment, emergency stabilization
   and advanced medical care to the injured or ill"
4. Move to Mechanic* - tooltip should swap to:
   "Diagnose, repair, maintain, or build complex machines, tools,
   vehicles, and systems"
5. Hover an un-raised skill (grey, level 0). Tooltip should still
   appear with that skill's description (descriptions don't depend on
   level).

## Edge cases

- **Specific Knowledge.** The chip text shortens to "Specific Know."
  (truncated to fit the grid). The tooltip should still show the full
  canonical description: "Knowledge about the history, layout, and
  secrets of a specific area, community, person, or discipline".
- **Clickable chips still roll.** Hovering surfaces the tooltip;
  clicking still fires `handleSkillClick` -> roll modal. The new
  `title` attribute must not block the existing click handler.
- **Read-only view.** When `onRoll` is undefined (printing,
  detail-only views), the chip stays non-clickable but the tooltip
  should still appear on hover.
- **Custom-named skills.** If a character ever has a skillName that
  isn't in `SKILLS` (shouldn't happen post-canon-lock, but defensive):
  the lookup `.find(d => d.name === s.skillName)?.description ?? ''`
  returns an empty string and the browser shows no tooltip. No crash.

## Regression checks

- Border-hover highlight (blue `#7ab3d4` on `onMouseEnter`) still
  fires and the border returns to its raised/unraised color on
  `onMouseLeave`. The tooltip is independent of the mouseenter
  handlers; both should coexist cleanly.
- Skill chip layout (6-column grid, 13px font, ellipsis truncation)
  unchanged.

## Revert

```
git -C /c/TheTapestry checkout 9b44eb4 -- components/CharacterCard.tsx
git -C /c/TheTapestry commit -m "revert: skill chip hover tooltips"
git -C /c/TheTapestry push origin main
```
