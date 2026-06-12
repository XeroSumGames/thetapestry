# Finding: Stabilize modal shows "STABILIZE" twice

**Date:** 2026-06-12
**Route:** HP lane
**Severity:** UX / LOW (cosmetic but confusing)
**Evidence:** Session 63 playtest (2026-06-12); Xero screenshot + recorder log confirms two "Roll Stabilize" events fired correctly.

---

## Symptom

The Stabilize RollModal renders:
```
STABILIZE        <- green eyebrow chip
STABILIZE        <- big white uppercase title
Mikey Shevik stabilizes Frankie Gibblets  <- subtitle
```

"STABILIZE" appears twice. The modal intent (`RollModalProps` jsdoc) is that `title` holds the **specific instance** ("Cree stabilizes Donnie") and `eyebrow` holds the **roll type** ("Stabilize").

## Root cause

In `app/stories/[id]/table/page.tsx` at the `<RollModal>` stabilize block (~L10146):

```tsx
title="Stabilize"        // <-- wrong: hardcoded type string
eyebrow="Stabilize"      // correct
subtitle={stabilizePending ? `${stabilizePending.medicName} stabilizes ${stabilizePending.targetName}` : undefined}
```

Both `title` and `eyebrow` are "Stabilize". The `subtitle` is already the correct specific-instance string.

## Fix

Change `title` to the specific-instance text (same content as `subtitle`):

```tsx
title={stabilizePending
  ? `${stabilizePending.medicName} stabilizes ${stabilizePending.targetName}`
  : 'Stabilize'}
```

Then either drop the `subtitle` prop (it's now redundant) or repurpose it to show context like:

```tsx
subtitle={stabilizePending?.deathCountdown != null
  ? `${stabilizePending.targetName} has ${stabilizePending.deathCountdown} round(s) until death`
  : undefined}
```

That second option requires threading `death_countdown` into the `stabilizePending` state object (currently it holds `medicEntryId`, `medicName`, `targetName`, `targetKind`, `amod`, `smod`). If not available at the call site, drop subtitle for now and just fix the title.

## Bonus UX note

The `rollFormula` prop reads `"2d6 + RSN + Medicine + CMod"`. The live modal shows `"2d6 CMOD [0]"` which strips the RSN and Medicine label text. If the formula label is important for player orientation (it is - tells them which stats matter), verify `rollFormula` renders correctly in the pre-roll phase and is not being suppressed.

## Test

1. Stabilize → modal opens.
2. "STABILIZE" appears once in the colored eyebrow chip.
3. The title reads "[medic] stabilizes [patient]" in uppercase.
4. Roll fires, cascade applies correctly (no behavior change).
