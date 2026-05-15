# Pin Folders v2 — Test Plan (2026-05-15)

## What shipped

Pins now group into GM-shared folders, mirroring the NPC tab pattern
exactly. The earlier per-user-folders attempt (`139edcf`) was reverted;
this version is the right shape.

**Schema** (`sql/pin-folder-column-2026-05-15.sql`):
- Single `folder text` column on `campaign_pins`. NULL or empty =
  "Uncategorized." No separate folders table.

**UI** (`components/CampaignPins.tsx`):
- Edit form has a `Folder` text input with `<datalist>` autocomplete
  from existing folder names in the campaign. Free-form — the GM
  types a folder name to create / move-into.
- Pin list groups by folder. Each folder header:
  - `▼` / `▶` collapse arrow
  - Folder name (UPPERCASE)
  - `Show` / `Hide` bulk button — GM/Thriver only, single UPDATE on
    all pins in the folder
  - Count badge on the right
- Per-viewer collapse state in `localStorage` under
  `pin_folders_<campaignId>` and `pin_folder_order_<campaignId>`.
  "Uncategorized" is always pinned last regardless of saved order.

## Pre-flight

- Test campaign with at least 6 revealed pins.
- GM account + Survivor account in the same campaign.

## Section 1 — GM creates folders, files pins

As **GM** on `/table` → PINS tab:
- [ ] All existing pins start under one "Uncategorized" folder.
- [ ] Click the folder header — it collapses (▼ → ▶) and the pin
      rows disappear.
- [ ] Click again — expands back. Open state persists across page
      reload (localStorage).
- [ ] On a pin, click Edit. The form now has a `Folder` input below
      the latitude/longitude row.
- [ ] Type "Waypoints" into the Folder input. Save.
- [ ] Pin list now shows TWO folder sections: "WAYPOINTS" (1) and
      "UNCATEGORIZED" (rest). Uncategorized stays pinned last.
- [ ] Edit a second pin, click the Folder input — the datalist
      suggests "Waypoints" as an auto-complete option.
- [ ] Move 3 more pins into "Waypoints". Counts update.
- [ ] Create a new folder via Edit → type "Set Pieces". A second
      named folder appears above Uncategorized.

## Section 2 — Per-folder Show/Hide bulk reveal

As **GM**:
- [ ] In the "Waypoints" header, click `Show`. All pins in the folder
      flip to revealed. The button label becomes `Hide`.
- [ ] Click `Hide`. All pins in the folder flip back to unrevealed.
- [ ] If only SOME pins in the folder are revealed (mixed state),
      clicking `Show` should reveal the rest. Click `Hide` should
      hide all. (`allFolderRevealed` only true when every pin is
      revealed.)
- [ ] The top-level "Reveal All" / "Hide All" still works on every
      pin regardless of folder.

## Section 3 — Player sees the folder structure

As **Survivor** in the campaign:
- [ ] Folder headers are visible (UPPERCASE name + count).
- [ ] `Show` / `Hide` buttons are NOT visible (GM-only).
- [ ] Folders only contain REVEALED pins. Hidden pins don't count
      toward the badge or appear inside.
- [ ] An empty folder (all pins hidden) does NOT render at all for
      the player — the `if (!folderPins || folderPins.length === 0)
      return null` guard skips it.
- [ ] Collapsing/expanding folders is per-viewer — the GM toggling
      a folder closed doesn't affect the player's view.

## Section 4 — Folder rename via edit

As **GM**:
- [ ] On any pin in "Waypoints", click Edit. Change the folder
      input from "Waypoints" to "Mongrels Route". Save.
- [ ] That ONE pin moves to a new "MONGRELS ROUTE" folder. The
      other Waypoints pins stay in "Waypoints" until each is
      edited individually.
- [ ] (No bulk-rename UI in this phase — per-pin only. Phase 2.)

## Section 5 — Folder count + visibility edge cases

- [ ] Delete a pin in a folder. Folder count decrements. If it was
      the last pin, the folder section disappears.
- [ ] Edit a pin's folder to empty string. Pin moves to
      Uncategorized.
- [ ] Hidden pins for the GM still show in the folder header count;
      the `Show` / `Hide` bulk button toggles them correctly.

## Section 6 — localStorage persistence

- [ ] Collapse "Waypoints" and "Uncategorized" on the GM's view.
      Reload `/table`. Both stay collapsed.
- [ ] Open in a second tab — same collapse state (localStorage is
      shared per-origin per-browser).
- [ ] Sign in as the Survivor in the same browser. Their collapse
      state is INDEPENDENT (different localStorage entries keyed
      by user via auth callback). Actually — localStorage isn't
      user-scoped, so a same-browser Survivor would see the GM's
      collapsed state. Acceptable for Phase 1; per-user collapse
      can ship later if it becomes friction.

## Acceptance

All Section 1–4 boxes ticked. Sections 5–6 behave as described.

## Phase 2 deferred

- Drag-drop pin into folder header (currently edit-form only)
- Folder reorder by dragging the folder header itself
- Bulk rename: rename folder name → all pins in folder follow
- Folder delete: delete folder name → all pins fall to Uncategorized
- "+ New Folder" button on the rail (currently created via the edit
  form's datalist + type)
- Per-user collapse state (currently per-browser-per-origin)
