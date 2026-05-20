# Player NPC folder reorder (Q2 Phase B) - test plan

Companion to commit `feat(npcs): player-side folder reorder (Q2 Phase B)`.

## What shipped

Player-side NPC tab now lets the player drag folder HEADERS to reorder
the folder list (mirrors GM's NpcRoster reorder, localStorage-backed).
Combat (`__combat__`) and Community (`__community__*`) buckets stay
non-draggable - they're computed views and would just snap back.

- Saved per `(user, campaign)` under localStorage key
  `npc_folder_order_player_<campaignId>` (distinct from the GM's
  `npc_folder_order_<campaignId>` so a user who GMs one campaign and
  plays another never cross-pollutes orderings).
- New folders pop in at the alpha tail and self-sync into the saved
  order on the next render (microtask-deferred state set).
- Stale folder keys (folder renamed by GM / NPCs hidden such that the
  folder vanishes) drop out on the same self-sync pass.

## Manual smoke

Open a campaign as a player (NOT the GM). The campaign needs to have
at least 2 NPCs in 2 distinct custom folders that the player has
revealed (or are auto-revealed via npc_relationships).

### 1. Folder reorder happy path
- Sidebar shows folders A, B, Unfiled in alpha order (default).
- Grab folder B's header (the orange folder name). Drag it above A.
- Green dashed border appears on A while hovering.
- Drop. Folder list now shows B, A, Unfiled.
- Reload the page. Order persists.

### 2. Combat / Community buckets don't drag
- Start combat with at least 1 NPC. Combat pseudo-folder appears at top.
- Try to drag the Combat header. Cursor stays as `default`; no drag start.
- Same for any 🏘 Community - X bucket if a community is loaded.

### 3. NPC cross-folder drop still works (Phase A regression check)
- Drag an NPC card from folder A onto folder B's header.
- Green dashed border appears (same visual as folder reorder hover).
- Drop. NPC moves to folder B; `campaign_npcs.folder` updates in DB.
- Other clients (GM, other player) see the move via realtime.

### 4. NPC reorder within folder still works (Phase A regression check)
- Drag an NPC card onto another NPC card within the same folder.
- Cards swap; `sort_order` persists.

### 5. New folder discoverability
- GM creates a new folder on their end and assigns a revealed NPC to it.
- On the player's view, the new folder appears at the alpha-sorted tail.
- Player can then drag it into place; it joins the saved order.

### 6. Folder rename by GM
- GM renames an existing folder (e.g. "Recruits" -> "The Family").
- Player's view shows the new name. The saved order (which referenced
  the old key) drops the stale entry on the next render and re-inserts
  the new key at the alpha tail. Player can drag back into place.

### 7. Cross-user independence
- Player A reorders to B, A, Unfiled.
- Player B's view stays at A, B, Unfiled.
- GM's view (own `folderOrder` from NpcRoster) unaffected.

## Automated coverage

No new unit tests for this commit - the new logic is pure DOM drag
state + localStorage + array reorder, which is identical in shape to
the GM's `handleFolderDrop` that already ships and hasn't regressed.
The shared NPC-move/reorder helpers in `lib/npc-drag-drop.ts` are
already covered (12 tests).

## Rollback

Revert the single commit. State and localStorage entries are
client-side only, so no DB rollback needed. Stale localStorage keys
(`npc_folder_order_player_*`) are harmless and self-cleaning if the
feature comes back.
