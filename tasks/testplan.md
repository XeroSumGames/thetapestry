# Test Plan: NPCs linked to campaign map pins

## 1. Apply schema + backfill

1. Open Supabase → SQL Editor.
2. Run the contents of `sql/npc-pin-link-backfill.sql` (paste-and-run). Idempotent — safe to re-run.
3. Verify the column exists:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'campaign_npcs' AND column_name = 'campaign_pin_id';
   ```
   Expected: one row.
4. Verify the backfill on an existing District Zero campaign:
   ```sql
   SELECT cn.name, cp.name AS pin_name
   FROM campaign_npcs cn
   LEFT JOIN campaign_pins cp ON cp.id = cn.campaign_pin_id
   WHERE cn.campaign_id = '<your-DZ-campaign-id>'
   ORDER BY cn.name;
   ```
   Expected: Linc Sawyer/Mitch Kosinski/District Deputy → `01 | City Hall`; Tom Orchard → `02 | Farmer's Market`; Gio Leone → `15 | The Refinery`; etc.
5. Same query against a Chased campaign — most NPCs should resolve to `01 | Best Nite Motel`, the Connor crew to `Connor Boys Farmhouse`, Dylan/Becky to `Stansfield's Gas Station`.

## 2. New campaign seeding (no manual SQL)

1. Run dev: `notepad dev-server.ps1` → start the dev server.
2. Visit `/stories/new`, name it "DZ Test", pick **District Zero**, click Create Story.
3. In Supabase, query:
   ```sql
   SELECT cn.name, cp.name AS pin_name
   FROM campaign_npcs cn
   LEFT JOIN campaign_pins cp ON cp.id = cn.campaign_pin_id
   WHERE cn.campaign_id = '<the-new-id>'
   ORDER BY cn.name;
   ```
   Expected: every seeded NPC has a `pin_name` already populated — no backfill needed.
4. Repeat for a fresh **Chased** campaign and a fresh **Empty** campaign.

## 3. Pin popup UI — GM view

1. Open the new DZ Test campaign in browser → click **Launch Story** → table view loads.
2. The campaign map sits in the center pane. Click the **City Hall** pin on the map.
3. Popup expected:
   - Title: `01 | CITY HALL`
   - Notes (gray text)
   - Divider line
   - `ALSO HERE` label
   - Three names: `Lincoln "Linc" Sawyer`, `Mitchell "Mitch" Kosinski`, `District Deputy`
4. Click **Farmer's Market** → `Tom Orchard`.
5. Click **The Refinery** → `Gio Leone`.
6. Click **The Bike Shop** → `Emma Hernandez`.
7. Click a pin with no linked NPCs (e.g. a Watchtower) → popup shows pin info only, no `ALSO HERE` section.

## 4. Pin popup UI — player view

1. As GM, open NpcRoster (Assets tab), edit Lincoln Sawyer, click **Reveal**, select all PCs, save.
2. Have a second user join the campaign and create a character.
3. **Before reveal**: log in as the player, open the table view, click City Hall → popup has no `ALSO HERE` section.
4. As GM, reveal Mitch Kosinski to that player's character via the NpcRoster reveal flow.
5. As the player, click City Hall again → popup now lists the revealed NPC(s) only.

## 5. Realtime — `campaign_npcs` channel

1. With the player still on the table view, GM reveals another linked NPC at City Hall.
2. The map should refresh popups in the background (the new `campaign_npcs_map_<id>` channel triggers `loadPins`). Re-click the pin within a couple of seconds → new NPC appears.

## 6. Dead-NPC styling

1. As GM, open Lincoln Sawyer's NpcCard in the NPC roster, drop his WP to 0 + tick the "Dead" status.
2. Click City Hall → his name should appear with strikethrough and dimmed.

## 7. Custom-setting safety

1. Create a new campaign with **setting = Custom**. No NPCs/pins are seeded.
2. Verify the table view loads without errors and pin popups (none expected) don't crash.

## 8. Hidden pin (GM-only) still shows linked NPCs

1. As GM in DZ Test, hide the City Hall pin via Assets → it now appears at 40% opacity for the GM only.
2. Click the dimmed pin → popup still shows `Hidden from players` AND the `ALSO HERE` list (linked NPCs are unaffected by pin reveal state).

## Rollback

If anything goes sideways, the column drop is:
```sql
ALTER TABLE campaign_npcs DROP COLUMN IF EXISTS campaign_pin_id;
```
The seed-wire revert is the single line in `app/stories/new/page.tsx` and the CampaignMap edits are localized.
