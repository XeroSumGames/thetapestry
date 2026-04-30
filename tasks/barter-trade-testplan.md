# Test Plan — Inventory #5: Barter Trade Negotiation

Shipped 2026-04-30. Per CRB §05 Acumen Skills, Barter is an Opposed Check skill where the winner convinces the other side. This modal automates the roll + the item transfer for trades with NPCs and community stockpiles.

## Pre-flight

No SQL migration. Reuses existing inventories (PC `characters.data.inventory`, NPC `campaign_npcs.inventory`, `community_stockpile_items` table).

Setup: a campaign with a session-active PC + at least one NPC with items in their inventory + a community with a stockpile (any non-empty stockpile from Inventory #4).

## Golden path — trade with NPC

1. Open an NPC's card from the roster.
2. **Expected**: a new **⚖ Trade** button (orange) appears alongside Map/Inventory/etc.
3. Click it.
4. **Expected**: Trade Negotiation modal opens with two columns:
   - Left (You offer): your PC's inventory.
   - Right (You want): NPC's inventory.
   - Each item shows rarity chip on the right (Common = grey-blue, Uncommon = green, Rare = orange).
5. Click + on items in each column to add to the trade. Counts update; selected rows turn green.
6. **Fairness gauge** at the bottom shows "Even-handed (X ↔ Y)" or "You're overpaying / underpaying" based on rarity-weighted totals. Common = 1, Uncommon = 2, Rare = 4.
7. Click **🎲 Roll Barter**.
8. **Expected**: outcome panel shows. PC's roll: 2d6 + ACU AMod + Barter SMod. NPC's roll: 2d6 + their Barter level. Higher total wins. Outcome badge per result (see below).
9. If PC won (and not Dire/Low Insight): **✓ Apply Deal** button enables. Click it.
10. **Expected**: items move both ways. PC inventory and NPC inventory updated. roll_log entry: `⚖ Trade · <PC name> (X+Y+mods → Z) vs. <NPC name> ... · gave <items> got <items>`.

## Outcome badges

| PC Outcome | Won? | Badge |
|---|---|---|
| High Insight (6+6) | Yes | ✦ Generous Deal — purple |
| Wild Success (14+) | Yes | ✓ Deal Struck — green |
| Success (9-13) | Yes | ✓ Deal Struck — green |
| Anything | No (NPC higher) | ⚖ Counter-offered — amber, deal not auto-applied |
| Dire Failure (0-3) | — | ✗ Refused — red, deal not applicable |
| Low Insight (1+1) | — | ✗ Insulted — red, deal not applicable |

Apply Deal disabled on Refused/Insulted/Counter-offered outcomes. GM adjudicates manually if they want to apply terms anyway.

## Re-roll

1. After a roll, the **Roll Barter** button label flips to **↻ Re-roll Barter**. Click it.
2. **Expected**: new roll, outcome updates. Same selections kept.

## Trade with community stockpile

1. Open the community panel, expand a community with stockpile items.
2. **Expected**: a **⚖ Trade** button on the Stockpile header (next to + Add).
3. Click it.
4. **Expected**: Trade modal opens. Right column shows stockpile items. NPC name = community name, subtext = "Stockpile". Barter SMod = community leader's Barter level (NPC leader's `skills.entries[].level` for `Barter`, or PC leader's `data.skills[].level`, or 0 if no leader).
5. Build deal, roll, apply. **Expected**: stockpile rows update accordingly (qty decrement, INSERT new entries on PC give).

## Edge — empty inventory on either side

1. NPC has no items, or PC has empty inventory.
2. **Expected**: that column shows italic "X's inventory is empty" / "Your inventory is empty". The other side still works; deal can be one-way (e.g., gift only).
3. Selecting items only on one side: fairness gauge shows that side overpaying / underpaying. Deal still rollable.

## Edge — selecting more than available

1. Try to + an item past its `qty`.
2. **Expected**: button disables when at max.

## RLS — non-member trying to trade with another campaign's community

1. Player A in Campaign X opens InventoryPanel and somehow targets a community in Campaign Y (UI doesn't expose this, but if it did): RLS on `community_stockpile_items` should reject the write.
2. **Expected**: `Apply Deal` errors. (Manual test — UI doesn't actually present this option.)

## Regression — existing flows untouched

1. NPC Inventory panel (loot from NPC) still works — `Give to PC` chip still functions independently.
2. PC inventory `Give to` modal still shows PC / NPC / community recipients.
3. Community stockpile add/remove from inline form still works.

## Followups (not shipped)

- **Multi-round haggling** — current single-roll resolution is simple. If counter-offers turn out to matter in play, we add a "Counter-offer" path that lets the NPC suggest different terms and the PC re-roll.
- **Barter Lv4 cheat** — SRD says level 4 Barter on a successful attempt gets DOUBLE what was asked. Currently silent — Lv4 traits are blocked behind the all-or-nothing Trait list per `project_lv4_traits.md`.
- **Relationship penalty** — Dire/Low Insight should drop `npc_relationships.relationship_cmod`. Currently just shows the failure badge.
- **Cross-PC trade sub-flow** — PC ↔ PC trade still uses the existing InventoryPanel "Give to" picker (no roll), since PCs negotiating with each other doesn't need a Barter check.
