# Rules extract — Combat (TEMPLATE / IN PROGRESS)

**Source**: `docs/Rules/XSE SRD v1.1.17 (Small).pdf` §06 Combat (pp. 14–17) + §07 Weapons & Equipment (pp. 18–20). Precedence per `CLAUDE.md`: SRD > CRB > Quickstart > Chased > District Zero.

> **Status**: Skeleton. Fill in each section by running `scripts/extract-rules.sh "docs/Rules/XSE SRD v1.1.17 (Small).pdf" /tmp/combat.txt 14 17` and transcribing what lands. The combat chapter has two-column layout; try the default `flow` mode first, then `layout` mode if tables look broken.
>
> This template demonstrates the shape. Once filled in, it becomes the canonical combat-rules reference — much faster to grep than the PDF.

---

## 1. Combat Rounds

*Extract: Round structure, turn economy (2 actions), initiative order, action types.*

- TBD — how long a round is (in-fiction seconds)
- TBD — action types (1-action / 2-action / free)
- TBD — initiative: 2d6 + ACU + DEX, descending
- TBD — deferring / holding actions

## 2. Range

*CRB describes range bands as abstract movement-round increments
(Engaged → Close = 1 round, Engaged → Distant = 10 rounds). Below
is our tactical-grid translation in feet, locked 2026-04-27. Used
by `lib/range-profiles.ts`, the throw-mode highlight, the move
highlight, the blast-radius scaling, and every range circle drawn
on the canvas. **Do not change without flagging — these are
canonical and the user has corrected the assistant on them.***

| Band | Feet | Notes |
|---|---|---|
| **Engaged** | ≤ 5 ft | "Whites of their eyes." Melee reach. Point-blank. |
| **Close** | ≤ 30 ft | Pistol's ideal range. Grenade's ideal range. |
| **Medium** | ≤ 100 ft | Shotgun / carbine sweet spot. Far throw. |
| **Long** | ≤ 300 ft | Hunting rifle / sniper rifle territory. |
| **Distant** | ≤ 1000 ft | Heavy weapons, mortars, RPGs. |

CRB rules on weapon-band penalties:
- One band down from a weapon's listed range: no penalty.
- One band up from listed range: -3 CMod.
- More than one band down from listed: -2 CMod.
- Sniper's Rifle (and similar) carry weapon-specific extra penalties; see notes column on that weapon.

## 3. Combat Actions (Table 10)

*Extract: Every action type, cost (1 or 2 actions), effect.*

| Action | Cost | Effect |
|---|---|---|
| Aim | 1 | +2 CMod on next Attack this round; lost if anything but Attack |
| Attack | 1 | Weapon attack |
| Charge | 2 | Move + melee/unarmed attack with +1 CMod |
| Coordinate | TBD | |
| Cover Fire | TBD | |
| Defend | TBD | |
| Distract | TBD | |
| Inspire | TBD | |
| Move | 1 | Up to 9ft movement |
| Rapid Fire | 2 | Burst attack; −1 CMod then −3 CMod on follow-up |
| Ready Weapon | 1 | Reload / switch / unjam |
| Reload | 1 | Consumes a reload, restores clip |
| Sprint | 2 | 2×Move distance; Athletics check or become Winded |
| Subdue | TBD | |
| Take Cover | TBD | +2 Defensive Modifier until they take an active combat action |

## 4. Damage

*Extract: How to roll weapon damage, defensive modifier, RP vs WP split.*

- TBD — damage roll structure (base + dice + PHY bonus?)
- TBD — Defensive Modifier (target PHY for melee, DEX for ranged)
- TBD — WP vs RP split rules (rpPercent per weapon)
- TBD — Blast Radius scaling (Engaged/Close/further)

## 5. Incapacitation

*Extract: WP=0 → mortally wounded, RP=0 → incapacitated.*

- TBD — Mortally Wounded: death countdown formula
- TBD — Stabilize check (Medicine) — restores 1 WP, opens Insight Die Save
- TBD — Insight Die Save: trade all Insight Dice for 1 WP / 1 RP
- TBD — Incapacitation (RP=0): unconscious for 4 − PHY rounds

## 6. Stress & Breaking Point

*Extract: Stress Modifier, when it ticks, Breaking Point table 13.*

- TBD — Stress meter (0–5)
- TBD — Stress Modifier computation
- TBD — Stress Check trigger conditions
- TBD — Breaking Point: roll Table 13 when Stress 5

## 7. Weapons & Equipment (§07, pp. 18–20)

*Extract: Weapon data shape, traits list with effects, condition CMod table.*

### Weapon data shape
- `name`, `category` (melee/ranged/explosive/heavy), `skill`, `range`, `damage`, `rpPercent`, `ammo`, `clip`, `enc`, `rarity`, `traits`

### Traits glossary
| Trait | Effect |
|---|---|
| Automatic Burst (X) | TBD |
| Blast Radius | TBD |
| Burning (X) | TBD |
| Close-Up / Cone-Up | TBD |
| Cumbersome (X) | −X PHY AMod |
| Stun | TBD |
| Tracking | +1 CMod after Ready Weapon |
| Unwieldy (X) | −X DEX AMod |

### Condition CMod (`lib/weapons.ts CONDITION_CMOD`)
| Condition | CMod |
|---|---|
| Pristine | +1 |
| Used | 0 |
| Worn | −1 |
| Damaged | −2 |
| Broken | Unusable |

---

## How to fill this in

```bash
# Default: reflow prose
./scripts/extract-rules.sh "docs/Rules/XSE SRD v1.1.17 (Small).pdf" /tmp/combat.txt 14 17

# If tables look mangled, retry with layout preservation:
./scripts/extract-rules.sh "docs/Rules/XSE SRD v1.1.17 (Small).pdf" /tmp/combat.txt 14 17 layout
```

Then open `/tmp/combat.txt` and transcribe each section into this file's matching header.

## Diff against implementation (run periodically)

Once filled in, periodically diff this extract against:
- `app/stories/[id]/table/page.tsx` (combat loop, action buttons, executeRoll)
- `lib/weapons.ts` (weapon stats + condition CMod)
- `lib/range-profiles.ts` (range band distances)

Log discrepancies at the bottom of this file, same format as §7 of `rules-extract-communities.md`.
