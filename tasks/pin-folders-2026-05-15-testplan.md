# Pin Folders Phase 1 — Test Plan (2026-05-15)

## What shipped

Per-user pin-folder system on the `/table` PINS tab (and the campaign
hub PINS section, since both surfaces render `<CampaignPins>`).

**Schema** (`sql/pin-folders-2026-05-15.sql`):
- `pin_folders` — `(id, user_id, campaign_id, name, sort_order, created_at)`
- `pin_folder_assignments` — `(pin_id, user_id, folder_id, PRIMARY KEY (pin_id, user_id))`
- RLS on both: `user_id = auth.uid()`. No GM/Thriver bypass — folders
  are PRIVATE per-user.

**UI** (`components/CampaignPins.tsx`):
- Folder rail above the pin list: `[All (N)] [Unfiled (N)] [📁 Folder1 (N)] ... [+ New]`
- Active folder shows `Rename` + `Delete` chips after `+ New`
- Per-pin `<select>` on the right column of each pin row: `📂 Unfiled` /
  `📁 FolderName ...` — only renders once the viewer has at least one
  folder (encourages `+ New` first)
- Filter state: `'all'` / `'unfiled'` / `<folder-id>`. Empty-state message
  adapts to the filter.

## Pre-flight

- Test campaign with at least 3 revealed pins.
- Two test accounts: GM + at least one Survivor in the campaign.
- Optional: Thriver account NOT GMing this campaign, to verify folders
  are truly per-user (Thriver godmode should NOT bypass).

## Section 1 — GM creates folders, files pins

As **GM** on `/table` → PINS tab.

- [ ] Folder rail visible above the pin list with `All`, `Unfiled`, `+ New`.
- [ ] `All (N)` count matches the pin count you see.
- [ ] Click `+ New`, name it "Waypoints". New chip appears, becomes active,
      pin list filters to empty ("No pins in this folder").
- [ ] Click `All`. Full list returns. Each pin row now shows a small
      select on the right reading `📂 Unfiled`.
- [ ] Pick "Waypoints" on a pin's select. Confirm:
      - The Waypoints chip count increments by 1.
      - The Unfiled chip count decrements by 1.
      - The select itself recolors blue.
- [ ] Click the Waypoints chip. The filtered list shows the pin you just
      moved.
- [ ] On the Waypoints chip with it active, click `Rename`. Rename to
      "Waypoints (Mongrels)". Chip label updates immediately.
- [ ] Move 2-3 more pins into Waypoints. Counts update live.
- [ ] Create a second folder "Set Pieces". Move a pin into it. Verify
      the same pin can't be in two folders simultaneously (the move
      removes the prior assignment).
- [ ] Delete "Set Pieces" via the Delete chip. Confirm prompt fires;
      after confirm, chip disappears and that pin returns to Unfiled.
      The pin itself is NOT deleted.

## Section 2 — Player has their own folders

As **Survivor** in the same campaign, on `/table` → PINS tab.

- [ ] Player sees the folder rail with only `All` / `Unfiled` / `+ New`
      — the GM's "Waypoints (Mongrels)" folder is INVISIBLE.
- [ ] Counts only reflect pins the player can see (revealed-to-player).
- [ ] Create a player folder "My Notes". File a revealed pin into it.
- [ ] GM cannot see "My Notes" in their own rail (switch tabs to verify).
- [ ] Player can rename + delete their own folder.

## Section 3 — Thriver godmode does NOT bypass folder privacy

As **Thriver** (not GM of the test campaign), on `/table` → PINS tab.

- [ ] Thriver sees their own folder rail (empty until they create one).
- [ ] Thriver does NOT see the GM's "Waypoints (Mongrels)" or the
      Survivor's "My Notes".
- [ ] Thriver creates "Audit", files a pin. GM + Survivor still don't
      see it.

## Section 4 — Pin deletion cascades

As GM:
- [ ] File a pin into "Waypoints (Mongrels)".
- [ ] Delete that pin via the `×` button.
- [ ] Waypoints count decrements automatically (assignment row cascade-
      deleted by `ON DELETE CASCADE` on `pin_folder_assignments.pin_id`).
      No orphan rows.

## Section 5 — Folder deletion does not delete pins

As GM:
- [ ] Create "Temp", file 3 pins into it.
- [ ] Hit Delete on the active "Temp" chip. Confirm.
- [ ] The 3 pins all reappear in Unfiled. None of the pins are deleted
      from the database.

## Section 6 — Edge cases

- [ ] Create a folder with an empty name → input is `prompt()` so empty
      string returns null and the create call no-ops. (Same path: paste
      whitespace-only → trim catches it, no folder created.)
- [ ] Two folders with the same name → allowed (no UNIQUE constraint on
      name). Display differentiates via the `id` key. Acceptable for
      Phase 1; Phase 2 may add uniqueness.
- [ ] Folder with 0 pins, click chip → "No pins in this folder" empty
      state.
- [ ] All pins filed, then click `Unfiled` → "No unfiled pins" empty
      state.

## Acceptance

All Section 1-5 boxes ticked, Section 6 edges all behave gracefully
(no console errors / no orphan rows / no leaked folders).

## Out of scope for Phase 1 (flagged for Phase 2+)

- Drag-and-drop pin into folder (currently dropdown only)
- Reorder folders (sort by `created_at` for now; `sort_order` column
  reserved but unused)
- Bulk file/unfile from the rail
- GM "reveal-and-auto-file" — GM reveals waypoints, players get them
  auto-filed into a folder the GM names on their behalf. Cross-user
  write requires a SECURITY DEFINER RPC; bigger build.
- Realtime broadcast when a folder is renamed in another tab (current
  behavior: refetch on next mount; cross-tab drift possible if a user
  has both `/table` tabs open in different windows).
