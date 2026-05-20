# Spec - Healing on GM Time-Tick

**Status:** design locked 2026-05-13. Not built yet. Builds on canon (First Aid Kit / Doctor's Bag), extends with outcome-tier upsides and queued application.

## Concept

A Medicine\* check from one PC on another doesn't apply WP immediately. The heal is **queued** against the target's record and resolves over the next 24 hours of in-world time as the GM advances the clock. Mirrors real-world healing time and gives the system somewhere to put "WS/MOI always has an upside" without making heals feel like spike fixes.

## Initiating the heal

- **Roll:** Medicine\* check. Healer rolls.
- **Equipment options:** naked check, or with a First Aid Kit (+1 CMod), or with a Doctor's Bag (+2 CMod). Healer picks which (if any) when initiating.
- **Range:** Engaged with the target (matches Stabilise).
- **Range:** Healer + target both at Engaged range when the check resolves.

## Outcome table - WP healed (locked 2026-05-13)

| Outcome | No kit (naked Medicine\* check) | First Aid Kit (canon) | Doctor's Bag (canon) |
|---|---|---|---|
| Wild Success | Medicine\* level + 1 | `1+1d3` + 1 | `1+2d3` + 1 |
| High Insight | Medicine\* level + 2 (+ Insight Die badge to healer) | `1+1d3` + 2 (+ badge) | `1+2d3` + 2 (+ badge) |
| Success | Medicine\* level | `1+1d3` | `1+2d3` |
| Failure | 0 | 0 | 0 |
| Dire Failure | -1 WP to target (immediate) | -1 WP | -1 WP |
| Low Insight | Target makes an Infection check (+ Insight Die badge to healer) | same | same |

Notes:
- "Medicine\* level" = healer's SMod in Medicine\* at roll time. A character with Medicine\* 0 (Untrained) heals 0 on a naked Success - the +1/+2 from WS/HI is the only WP they can deliver bare-handed.
- The +1 / +2 from Wild Success and High Insight are FLAT additions, not multipliers on the dice/level.
- A Medicine\* Lv4 character with a Doctor's Bag on a High Insight heals: `1+2d3+2`. Min 4, max 9.

## Time-tick application

- **Banking:** when the heal queues, the total WP amount is split 50/50 across two checkpoints:
  - **+12h checkpoint:** target gains `floor(total / 2)` WP
  - **+24h checkpoint:** target gains `total - floor(total / 2)` WP (the remainder)
  - Total banked = the full computed heal amount; the rounding split just decides which half gets the extra WP on odd totals.
  - Example: heal total of 5 → +12h applies +2 WP, +24h applies +3 WP.
- **Trigger:** any GM-driven time advance that crosses the +12h or +24h boundary fires the pending heal. The Inventory `+1h` button counts; the Campaign Clock `Advance Time` modal counts; End Session counts. (Specifically: drain rows where `scheduled_canon_hour <= current_canon_hour` after the advance, same pattern as the existing campaign-clock drainer.)

## Storage attachment (locked 2026-05-13)

- **Pending heal lives on the TARGET, not the healer.** Junie heals Marv → +3 WP gets queued onto Marv's record at the moment of the Medicine\* check. If Junie dies before the +12h tick, Marv still gets the +3 WP because it's already attached to him.

## Stacking (locked 2026-05-13)

- **Multiple successful heals stack.** Junie's +3 + Marv-the-Medic's +2 = +5 total queued on the target (split across two ticks). No "best wins" overwrite.
- Each pending heal is its own row in the queue with its own +12h / +24h schedule, computed from its own check time. So heals queued at different in-world hours apply at different actual tick moments.

## Negative-outcome handling

- **Dire Failure:** -1 WP to target, applied IMMEDIATELY (not queued). If this drops the target to 0 WP, the standard Mortally Wounded flow fires (death countdown, +1 Stress auto, etc.).
- **Low Insight:** target makes a **Wound Infection check** (post-combat single Physicality check, per canon §06 → Infection, Sickness & Disease → Wound Infection). The healer earns 1 Insight Die per canon HI/LI rules. The botched medical procedure is the "wound" that triggers the infection check.

## Open implementation questions

- **Schema:** likely a row in `campaign_events` with `type='pending_heal'`, `target_character_id`, `scheduled_canon_day`, `scheduled_canon_hour`, `payload: { wp_amount }`. Two rows per heal (one for +12h, one for +24h).
- **Roll modal trigger:** does the healer click a dedicated "Heal" button on their character card, or do they just roll Medicine\* with the target-picker open? Recommend a dedicated button to gate the "pick target" → "pick kit" flow cleanly.
- **Kit consumption:** the existing First Aid Kit / Doctor's Bag entries in `EQUIPMENT` don't have a charges/uses field. Canon doesn't mention kit depletion. Treat kits as infinite-use for now? Flag for Xero design call later if depletion is wanted.
- **Untargeted heals:** can a healer self-heal? Probably yes - same flow, target picker just allows self.
- **Bystander rules:** if the target moves out of Engaged or off the map before the +24h tick, does the queued heal still apply? Default: yes, the medical care was administered, the body heals on its own clock after that.
- **Feed shape:** one bespoke "🩹 Junie successfully treated Marv (+5 WP over 24h)" row at check time, plus "🩹 Marv recovers +2 WP (treatment continues)" system rows at the +12h and +24h ticks. Mirror the loot / rations / subsistence System-row pattern.

## Related canon

- Equipment notes for First Aid Kit and Doctor's Bag (`lib/xse-schema.ts:274-276`).
- Canon §06 Combat → Incapacitation, Mortally Wounded, Stabilise, Death.
- Canon §06 Combat → Infection, Sickness & Disease (Wound Infection branch).
- Canon §02 Core Mechanics → Insight Dice (Moment of Insight badge awards).
