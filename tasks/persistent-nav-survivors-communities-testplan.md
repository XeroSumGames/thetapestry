# Persistent GM Nav + Survivors Gallery + Community Auto-expand
Commit: af15ca1 — pushed to main 2026-04-29

## What changed
- **`components/StoryToolsNav.tsx`** (new) — Launch / GM Tools / Edit /
  Snapshot / Sessions / Community / Share button row, with active-page
  highlighting via `usePathname()`.
- **Mounted at** `/stories/[id]/edit`, `/snapshots`, `/sessions`, `/community`.
  Hub page (`/stories/[id]`) is intentionally NOT updated — its full
  inline button row already has GM Kit, Publish Module, Archive, Delete
  which the shared nav doesn't carry.
- **Evolution button** added to `CharacterCard.tsx` between Inventory
  and Apprentice. Purple. Scrolls to Progression Log on the same card.
- **My Survivors gallery** swapped to CSS grid `auto-fill 1fr` — tiles
  fill the row evenly.
- **`/communities/[id]`** auto-expands the clicked community via new
  `initialOpenId` prop on `CampaignCommunity`.

## Test cases

### Persistent GM nav
1. Open `https://thetapestry.distemperverse.com/stories` → click GM Tools
   on a story you GM.
2. From the GM Tools landing, click **Edit** → confirm the StoryToolsNav
   row appears at the top of the Edit page, with **Edit** highlighted.
3. Click **Snapshot** in that row → page changes, **Snapshot** is now
   the highlighted button. The full snapshot management UI still loads
   below the nav.
4. Click **Sessions** → page changes, **Sessions** highlighted; the
   "Back to The Table" link is gone (replaced by Launch button in nav).
5. Click **Community** → same nav, Community highlighted, Community
   Dashboard loads below.
6. Click **GM Tools** → returns to hub. Click **Launch** → opens table
   in a new tab (new-tab is intentional only for Launch — all other
   in-nav links are same-tab).
7. Click **Share** on any sub-page → clipboard now contains the invite
   link, button briefly shows "Copied!".

### Player path
8. Sign in as a player and visit a campaign you're a member of (not GM).
   The hub page only shows Launch/Share/Leave — not affected by this
   change. Player has no need to visit Edit/Snapshot/Sessions/Community
   pages so they're not exposed via the nav for non-GMs.

### My Survivors gallery
9. Visit `/characters` with 9+ characters.
10. Confirm the portrait/name tiles fill the gallery box edge-to-edge
    (no big block of empty space on the right).
11. Resize the window narrower → tiles re-flow into fewer columns and
    still fill each row.

### Evolution button
12. On any character sheet under `/characters`, click the purple
    **Evolution** button.
13. Page should smooth-scroll down to the Progression Log section on
    that character's card.

### /communities/[id] auto-expand
14. Visit `/communities` → click into a community card (e.g. "The
    Mongrels" if you have a Mongrels campaign).
15. Confirm the Mongrels accordion is already expanded showing Homestead,
    Leader, Role Coverage, Add Member, etc. — NO extra click needed.
16. Visit `/communities` again → click a different community → that
    one auto-expands.

## Regression checks
- Hub page `/stories/[id]` still shows the full button row with GM Kit,
  Publish Module, etc. — should be unchanged.
- `/communities` list view (the parent) — unchanged.
- Existing CharacterCard buttons (Map / Edit / Inventory / Apprentice /
  Popout / Print / Duplicate / Delete) all still present and working.
