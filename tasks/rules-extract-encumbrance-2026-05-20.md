# Rules Extract - Encumbrance (restored 2026-05-20)

The full Encumbrance rule got dropped between manuscript versions and the platform shipped only a partial house-rule. Xero supplied the canonical text 2026-05-20; this captures it + tracks what's implemented vs deferred.

**Status:** canon-locked 2026-05-20 by Xero (verbatim text below).

---

## Canon (verbatim, Xero 2026-05-20)

> Characters can meet their Encumbrance limit without any adverse consequence. However, as soon as they exceed it, their movement speed drops in half and they suffer 1 RP damage per hour for each point they are over their Encumbrance limit.
>
> If the character reaches 0 RP, they become Incapacitated. Although they regain consciousness within moments and recover 1 RP, they must rest for four hours to recover half of their RP before carrying on.
>
> Alternatively, they can drop enough weight to meet their Encumbrance limit at which point they can then keep moving without incurring further RP damage.

(The worked example in the manuscript says "rest for 7 hours" while the rule says "four hours to recover half" - the rule text is canon; the example's 7 looks like a stale number. Flagged for Xero if it matters.)

---

## Mechanics distilled

- **Limit:** `6 + PHY AMod` (+2 if Backpack / Military Backpack). At-or-under = no penalty.
- **Over the limit (currentEnc > limit):**
  1. **Movement halved** until they drop weight or rest.
  2. **RP drain = 1 per hour PER POINT over** (not flat 1/hr). `overBy = currentEnc - limit`. Per-hour drain = `overBy`; over N hours = `N x overBy`.
- **0 RP -> Incapacitated:** regain consciousness + 1 RP immediately; must rest 4 hours to recover half RP before continuing.
- **Escape:** drop weight to meet the limit -> RP drain stops immediately.

---

## Implementation status

### SHIPPED 2026-05-20

- **`lib/encumbrance.ts`:** added `overBy: number` to the `Encumbrance` interface (`max(0, currentEnc - encLimit)`). 4 new unit tests.
- **Advance Time tick (`app/stories/[id]/table/page.tsx`):** RP drain now `hours x overBy` per character, was flat `hours`. PC + NPC branches both fixed. Preview rows show `(N over · -N/h)`. Modal copy updated to "1 RP per hour for every point over their limit." The RP=0 -> Incap + auto-Stress pipeline already existed and still fires.
- **Rules page (`app/rules/character-overview/secondary-stats`):** added the full over-encumbrance prose (limit formula + movement halved + per-point RP drain + incap + rest-4h-recover-half + drop-to-escape).

### DEFERRED (flagged follow-ups - bigger surfaces)

1. **Movement halved on the tactical map.** Canon says overloaded = half movement speed. The tactical-map move logic (`TacticalMap.tsx` / table-page move-mode) doesn't know a token's encumbrance state. Needs: compute `overloaded` per token at move time, halve the allowed move distance (round down). Cross-cut change; not a one-liner. Pre-playtest window argued against shipping it same-day. **Currently overloaded characters move at full speed on the map.**
2. **Rest 4h -> recover half RP.** Canon says hitting 0 RP from encumbrance requires a 4-hour rest to recover half RP. The Rest modal (`CharacterCard.tsx`) has its own RP-recovery rates; whether they match "half RP in 4 hours" needs an audit. The Incap-on-0-RP transition fires today (incap_rounds + Stress pip via the standard pipeline), but the specific "rest 4h -> half RP" recovery curve is not modeled as a distinct rule. **Audit the Rest modal's RP curve against this canon as a follow-up.**

---

## Cross-references

- `lib/encumbrance.ts` - `computeEncumbrance` + `overBy`.
- `app/stories/[id]/table/page.tsx` - GM Tools > Time (Advance Time / Overencumbered tick).
- `app/rules/character-overview/secondary-stats/page.tsx` - canon prose.
- `tests/lib/encumbrance.test.ts` - 13 tests incl. overBy.
- Companion extract: `tasks/rules-extract-armor-explosives.md` (armor + special weapons).
