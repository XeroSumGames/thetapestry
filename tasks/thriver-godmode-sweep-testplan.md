# Thriver Godmode UI Sweep - Test Plan 2026-05-14

## What changed

Widened `isGM` UI gates to `gmLike = isGM || isThriver` across the
remaining surfaces. DB-level godmode was already in place via RLS
policies (`sql/thriver-godmode-policies.sql`); this finishes the
matching UI layer so Thrivers see the full GM affordances on any
campaign.

**Files touched:**
- `app/stories/[id]/snapshots/page.tsx` - upstream gate widened to admit Thrivers
- `app/campaign-sheet/page.tsx` - `isThriver` lookup added; 7 gates widened
- `app/stories/[id]/page.tsx` - `isThriver` lookup added; 5 player branches + 1 remove gate
- `app/stories/[id]/table/page.tsx` - header bar, prop-passes to children, ~30 internal gates

**Files explicitly NOT touched (already widened or intentional):**
- `app/stories/[id]/community/page.tsx`, `app/vehicle/page.tsx` - done in `bea860a`
- `app/character-sheet/page.tsx` - uses `isMySheet || isGM || isThriver` pattern
- `app/gm-notes-popout/page.tsx` - upstream gate already admits Thrivers, no inner gates
- `app/communities/[id]/page.tsx` - `!isGM && !isThriver` gate already correct
- `app/stories/[id]/edit/page.tsx` - `setIsGM` is dead code there

**Strict `isGM` deliberately kept** (identity, not authority):
- `app/stories/[id]/table/page.tsx:6344` - "GM View / Player View" header label
- `app/stories/[id]/table/page.tsx:7387` - "(GM)" username badge
- `app/stories/[id]/table/page.tsx:6214` - telemetry log field
- Recorder toggle is `isThriver`-only (intentional, was already correct)

---

## Pre-flight

1. Have **three** test accounts handy:
   - **GM account** - owns the test campaign
   - **Thriver account** - has `profiles.role = 'thriver'`, NOT the GM of the test campaign, NOT a member
   - **Survivor account** - regular player, NOT the GM, NOT a member

2. Pick a test campaign. Note its `id` so you can deep-link
   `/stories/<id>/table` etc.

3. Verify pre-conditions in SQL:
   ```sql
   select id, role from profiles where id in ('<gm-id>', '<thriver-id>', '<survivor-id>');
   -- Expect: gm row exists with any role; thriver row has role='thriver'; survivor has role='survivor'.
   ```

---

## Section 1 - Snapshots page

**As Thriver** (not the GM of the campaign):
- [ ] Visit `/stories/<id>/snapshots`. Page renders the snapshot list +
      controls instead of "Access Denied".
- [ ] Try Save Snapshot, Download, Import flows - each should work.

**As Survivor** (not the GM):
- [ ] Visit `/stories/<id>/snapshots`. Page shows "Access Denied" +
      "Snapshots are GM-only (or Thriver godmode)." with a Back link.

**As GM** (regression):
- [ ] Visit `/stories/<id>/snapshots`. Page renders normally. No
      regression.

---

## Section 2 - Campaign-sheet popout

Open via `/campaign-sheet?c=<id>` (or from /table → Quick Tools → Campaign Sheet).

**As Thriver:**
- [ ] Header line "Campaign Day N ·… " shows Edit and Export Log buttons
      next to the date.
- [ ] Advance Time bar shows the GM controls (Eat / Rest / Heal +
      +1h/+4h/+8h/+12h/+24h buttons), NOT the player "Relax" placeholder.
- [ ] Click Edit Clock - modal opens with the dropdowns.
- [ ] Click Heal - modal opens with the queue-heal form.
- [ ] In the Pending Effects panel, each card shows a Cancel button.

**As Survivor:**
- [ ] Header line shows NO Edit / Export Log buttons.
- [ ] Advance Time bar shows the player "Relax" placeholder.
- [ ] Pending Effect cards do NOT show a Cancel button.

**As GM** (regression):
- [ ] Everything works as before. No regression.

---

## Section 3 - /stories/[id] hub

**As Thriver visiting a campaign they don't GM and aren't a member of:**
- [ ] No "Removed from Session" red banner above the action bar.
- [ ] The action bar shows the GM 7-button layout (Launch / Edit /
      Share / GM Kit / Snapshot / Publish / Delete), NOT the player
      Rejoin/Leave row.
- [ ] No "My Survivor" character-picker card. (Thrivers don't have a
      character at this campaign.)
- [ ] Member list shows a "Remove" button next to each non-GM row
      (Thriver can kick).

**As Survivor** (member of the campaign):
- [ ] Action bar shows the player layout with Launch + Share + Leave
      (and Rejoin if amKicked=true).
- [ ] "My Survivor" card visible.
- [ ] No Remove button on member rows.

**As GM** (regression):
- [ ] Same as before - full 7-button bar, no My Survivor, Remove
      buttons everywhere.

---

## Section 4 - /table page (the big one)

Log in as **Thriver visiting a campaign you don't GM**. Open
`/stories/<id>/table`.

### 4a. Header bar
- [ ] "GM View" label says **"Player View"** (identity stays strict -
      Thriver isn't impersonating the GM).
- [ ] Start Session button visible when `sessionStatus === 'idle'`.
- [ ] Click Start Session. Session starts.
- [ ] End Session button visible when `sessionStatus === 'active'`.
- [ ] Tactical Map toggle button visible and works.
- [ ] When Tactical Map is open: Share Map button + Map Setup popout
      button visible.
- [ ] Start Combat / End Combat buttons visible at appropriate states.
- [ ] GM Tools dropdown visible. Open it - Dashboard menu item present.
- [ ] Recorder toggle visible (Thriver-only - was already correct).
- [ ] "(GM)" suffix is NOT next to the Thriver's username (they aren't
      the GM).

### 4b. Tab bar / right rail
- [ ] GM Tabs (NPCs / GM Notes / Pins / Assets / Objects) visible.
- [ ] Click NPCs tab - full NpcRoster shows (add NPC button, folder
      operations, edit/delete NPCs all work).
- [ ] Click GM Notes - full GM Notes editor shows (not the Player
      Notes placeholder).
- [ ] Click Pins - pin management with edit/reveal toggles.
- [ ] Click Objects - Campaign Objects with full edit affordances.

### 4c. Tactical Map
- [ ] Map setup tools work - Thriver can paint fog, place walls/doors/
      windows, switch scenes, place tokens, drag tokens that aren't
      their own (none are; godmode).
- [ ] Thriver sees all tokens (including `is_visible=false` ones that
      players would have hidden).

### 4d. NPC cards
- [ ] Click any NPC in the roster - opens the GM-side `NpcCard` (with
      Edit / Publish / Place on Map controls), NOT the player-side
      `PlayerNpcCard`.
- [ ] Hidden-from-players NPCs are visible.

### 4e. Character sheets
- [ ] Click any player's portrait in the party bar - sheet opens (no
      "your stats only" gate).
- [ ] Sheet shows the Kick (×) button next to the player's name (this
      is the table-page kick, separate from /stories member-remove).
- [ ] Open a character sheet and roll on their behalf - Stat Check etc
      should fire normally with the Thriver as roller.

### 4f. Special checks
- [ ] Perception, Gut Instinct, First Impression, Recruit modals show
      all PCs in their pickers (not filtered to "self").

### 4g. Combat actions
- [ ] During combat, Thriver sees combat action buttons (Aim, Move,
      Defend, etc) for whichever combatant is active.
- [ ] The "you can't act this combat" mortal-wound banner does NOT
      show for the Thriver (they have no PC at risk).

---

## Section 5 - Regression as actual GM

Log in as the **GM** of the campaign. Walk the same surfaces:
- [ ] Header reads "GM View".
- [ ] Username has " (GM)" suffix.
- [ ] All controls work as before - Start/End Session, Start/End
      Combat, Map controls, GM Tools, tabs, character sheet edits,
      NPC management, kick affordances.
- [ ] Campaign sheet popout: full GM control panel (advance time,
      heal, edit clock, export log, cancel pending events).
- [ ] /stories/<id>: 7-button action bar, member-remove buttons,
      no My Survivor card.
- [ ] /stories/<id>/snapshots: page renders, all controls work.

**No regression should be visible to the actual GM** - they should
see exactly what they saw before this change.

---

## Section 6 - Regression as regular Survivor

Log in as a **regular Survivor** on a campaign they're a member of
(not the GM). Walk the surfaces:
- [ ] Header reads "Player View".
- [ ] No GM-side buttons (no Start Session / Start Combat / Tactical
      Map / GM Tools / Recorder).
- [ ] Tab bar shows only player-visible tabs (Pins / Assets / Objects
      / Player Notes - no NPCs/GM Notes admin views).
- [ ] Cannot open other players' character sheets (only their own).
- [ ] Sees only revealed NPCs in their sidebar / map.
- [ ] Hidden-from-players NPCs are NOT visible.
- [ ] In the Tactical Map, can drag only their own PC's token.
- [ ] On `/stories/<id>` hub: Rejoin/Leave row, My Survivor card,
      no Remove buttons on member rows.
- [ ] On `/stories/<id>/snapshots`: "Access Denied" page.
- [ ] On `/campaign-sheet?c=<id>`: player view (Relax placeholder,
      no advance/heal/edit-clock controls).

**No leak of admin affordances to the Survivor.**

---

## Acceptance

Sweep is considered shipped when:
- [ ] All Section 1-4 boxes checked as Thriver visiting a non-owned
      campaign.
- [ ] All Section 5 boxes checked as actual GM (zero regression).
- [ ] All Section 6 boxes checked as regular Survivor (zero leak).

---

## Known caveats / out of scope

- `entries.filter(e => isGM || e.userId === userId)` widening means a
  visiting Thriver sees every PC sheet and every player's rolls -
  intentional per Xero's spec call (2026-05-14).
- `onKick` widening means a Thriver can kick players from initiative -
  intentional per Xero's spec call (2026-05-14).
- `app/stories/[id]/snapshots/page.tsx:85` retains `isGM={true}` -
  correct, since the upstream gate above only lets GM-or-Thriver
  render past it.
- The Luxury Ration consume button on PartyCard remains visible to
  all players for their own PC - pre-existing behavior, out of scope.
- Recorder toggle stays Thriver-only (not widened to GM) - recorder
  is a Tapestry-team QA tool, not a campaign mechanic.
