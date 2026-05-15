# Thriver Godmode UI Sweep — Plan 2026-05-14

## Background

DB-level done weeks ago (sql/thriver-godmode-policies.sql etc).
Partial UI widening has shipped across multiple commits — most recently:
- `bea860a` (today) — /stories/[id]/community + /vehicle pages
- `ae0933a` — character sheet edit for non-owned PCs
- `92f9243` — table page partial (4/5 surfaces, ~3 weeks ago)

This plan finishes the sweep across the remaining surfaces. Pilot was rolled
back per Xero's request to land the rest in one pass.

## Pattern (locked)

```ts
const gmLike = isGM || isThriver
```

Derived once at the top of each surface that has `isGM` state. Then:

- **Widen at the caller** (prop pass): `isGM={gmLike}` instead of rewriting
  every child component's internals.
- **Keep strict `isGM`** ONLY for identity-labeled UI ("GM View",
  "(GM)" username badge). Thrivers don't impersonate the GM; they get
  godmode access, not GM identity.
- **Widen edit-gates, visibility-filters, and action-gates** to `gmLike`.
- **No `canEdit={true}` hard-codes** — always route through a derived var.

## Surfaces to touch

### 1. `app/stories/[id]/table/page.tsx` (main work)

Current state: `gmLike` already derived at line 364. Some props already use
it (`CampaignObjects`, `VehicleCard`, `GmNotes`, `CampaignSnapshots`,
`CharacterCard.canEdit`, `gmTab === 'notes'` gate). Many still on raw `isGM`.

#### 1a. Header bar — widen all action buttons (`isGM` → `gmLike`)
- L6349 — Start Session
- L6371 — End Session
- L6401 — Tactical Map toggle (GM branch)
- L6408 — Tactical Map toggle (player branch) — becomes `!gmLike`
- L6415 — Share/Unshare Map
- L6426 — Map Setup popout
- L6439 — Start Combat
- L6446 — End Combat
- L6492 — `Dashboard` menu item (`hidden: !isGM` → `hidden: !gmLike`)
- L6534 — GM Tools menu trigger

#### 1b. Prop passes — widen to `gmLike`
- L6701 — `<StoryActionBar isGM={...}>`
- L7479 — `<NpcRoster isGM={...}>`
- L7495 — `<TacticalMap isGM={...}>`
- L7517 — `<CampaignMap isGM={...}>`
- L7775 — `<InitiativeBar isGM={...}>`
- L7893 — `<CharacterCard isGM={...}>`
- L8621 — `<GenericPCBarPanel isGM={...}>`
- L8251 — `<CampaignPins isGM={isGM} isThriver={isThriver}>` — leave as-is
  (already takes both, internal logic widens itself)

#### 1c. Internal logic gates — widen to `gmLike`
Edit/visibility/action gates (widen):
- L1117, L1437 (real-time event routing — Thrivers see all)
- L1598-99 (NPC reveal-fetch — Thrivers fetch all)
- L1672, L2437, L2463, L2487, L2842, L2874, L2962, L3190, L3228 (handlers
  that early-return for non-GM — Thrivers should be allowed)
- L3436, L10800, L10813, L10884, L10915, L11127 — `entries.filter(e => isGM || e.userId === userId)` — widen to `gmLike` (Thrivers see every PC)
- L3438, L10887, L10918 — `isGM && combatActive` (combat affordances)
- L4199, L4207, L4208 — `rollerName` resolution (Thrivers roll as the
  selected entry like GMs do)
- L6213 — context value passed to children — widen if used for gating
  (need to check the context shape)
- L6644 — `!isGM && combatActive` non-GM banner — becomes `!gmLike`
  (Thriver-as-godmode shouldn't see "your char isn't in this combat" banner)
- L6718 — `canAct = isMyTurn || gmLike`
- L7031 — `selectedMapTargetName` (Thriver can target NPCs like GM)
- L7406 — `isGM ? (...) : (...)` (need to read context to confirm
  edit-vs-identity)
- L7526, L7545, L7652 (same)
- L7807 — `canControl = gmLike`
- L7895 — `onRoll` gate: `selected.userId === userId || gmLike`
- L7897 — `onKick` — widen (GM kick affordance, Thriver godmode includes
  it)
- L7956 — `n.hidden_from_players` filter — widen (Thrivers see hidden
  NPCs)
- L8504, L8518, L8559, L8618, L8623 — various edit/action gates → `gmLike`

#### 1d. Keep strict `isGM`
- L6343 — `'GM View' / 'Player View'` identity label
- L7386 — `' (GM)'` username badge
- L6363 — `isThriver &&` recorder toggle is intentionally Thriver-only
  (already correct, leave alone)

### 2. `app/campaign-sheet/page.tsx`
Derive `gmLike` from `isGM + isThriver` (currently only computes `isGM` at L82).
Widen:
- L277 (Advance Time handler), L319/L325 (Edit affordances), L340 (GM view branch),
- L425 (canCancel), L469 (heal modal), L489 (edit clock modal)
- Identity label "(GM)" stays strict if any

Need to add isThriver lookup if not already present.

### 3. `app/gm-notes-popout/page.tsx`
L21: `setIsGM`. L61 passes `isGM={isGM}` to `<CampaignCommunity>`.
Add isThriver lookup, derive gmLike, pass `isGM={gmLike}` to child.

### 4. `app/stories/[id]/page.tsx`
L250: `isGM = gm_user_id === userId`. Add `isThriver` lookup, derive
`gmLike`. Lines 259/271/302 are "non-GM" branches — these become
`!gmLike` so Thrivers see the GM-side UI (extraButtons, no kicked
banner, no Player Notes card).

### 5. `app/stories/[id]/snapshots/page.tsx`
L85: `<CampaignSnapshots isGM={true} />` — hard-coded `true`. Per
lessons.md ("`canEdit={true}` is a wide-open bug"), this is suspicious.
**Action: read the page top-to-bottom to confirm this is gated upstream**
(e.g. server-side redirect for non-GM/non-Thriver) — if yes, document
that in a comment; if no, replace with a real `gmLike` derivation.

### 6. `app/stories/[id]/edit/page.tsx`
L77: `setIsGM` defined but seemingly unused below (no other matches in
grep). Verify — if dead code, remove; otherwise widen.

### 7. Verify already-shipped
- `app/character-sheet/page.tsx` — lines 98, 105 already use
  `isMySheet || isGM || isThriver`. L101 (`isGM={isGM}` to CharacterCard) +
  L111 (prefix) + L144 (canEdit). Confirm whether L101+L144 should widen
  (probably yes — Thriver clicking a non-owned PC sheet should get the
  GM-side controls inside CharacterCard).
- `app/vehicle/page.tsx` — bea860a touched this. L77 has bare `setIsGM`;
  read to confirm if rest of file already widened.
- `app/communities/[id]/page.tsx` — L97-99 already `!isGM && !isThriver`
  pattern. ✅

### 8. Sub-component sanity check (low-risk, mostly handled by prop-widening)
After table-page prop changes, walk through each receiving component
to confirm no internal identity-label collides with a widened gate:
- `components/NpcRoster.tsx` — uses isGM for add/edit/delete/place-on-map
  (all edit-gates, widening at caller is the right pattern)
- `components/TacticalMap.tsx` — uses isGM for scene picker, fog paint,
  token drag, scene switch, etc. All edit/action; widening is correct.
  Check for any "GM" badge label inside the canvas overlay.
- `components/CampaignMap.tsx`, `InitiativeBar.tsx`, `StoryActionBar.tsx`,
  `CharacterCard.tsx`, `CampaignObjects.tsx`, `ObjectCard.tsx`,
  `TableChat.tsx`, `CampaignSnapshots.tsx`, `CampaignCommunity.tsx`,
  `CampaignPins.tsx` — same review pattern.

## What's deliberately NOT in scope
- `app/dashboard`, `app/characters`, `app/campfire/*`, `app/rumors/*`,
  `app/moderate/*`, `app/record`, `app/tools/*` — most of these already
  use isThriver for their gates (the original Thriver-aware codepaths).
  Grep `\bisGM\b` in those returns moderate-page admin gating, character
  list affordances, etc. — separate concerns from "campaign GM in the
  table view godmode."
- `app/rumors`, `app/campfire` — those have their own author/Thriver
  gates and shipped already.
- Any RLS changes (DB-level already done).
- The `isThriver`/`gmLike` state types — keep current shape.

## Risk

Medium. The pilot was rolled back because piecewise widening surfaces
inconsistencies (some buttons show, some don't, players confused).
Mitigation: this plan ships all surfaces in one commit (or a tight
sequence of related commits) so the visible state is "Thrivers see
every GM affordance, full stop."

False-positive risk: if a `gmLike` widening accidentally hits an
identity-only label, Thrivers will see "GM View" on a campaign they
don't GM. Identity labels are explicitly catalogued above (1d) and
left strict.

Schema-cache risk: zero (no DB changes).

## Test plan (writes to tasks/thriver-godmode-sweep-testplan.md)

1. Log in as a Thriver who is NOT the GM of a campaign.
2. Open the campaign's table page.
3. Confirm in the header bar the Thriver sees:
   - Start Session (when idle), End Session (when active)
   - Start Combat (active+no-combat), End Combat (in combat)
   - Tactical Map toggle, Share Map, Map Setup
   - GM Tools dropdown
   - Dashboard menu item under it
   - Recorder toggle (Thriver-only, was already present)
4. Confirm "GM View" label says "GM View" only if actually GM — for a
   Thriver-visiting-other-campaign it should say "Player View" (we left
   that strict).
5. Confirm "(GM)" username badge only shows if actually GM.
6. Confirm Thriver can add/edit/delete NPCs, folders, place tokens on
   the tactical map, paint fog, switch scenes, kick players, edit any
   character sheet, edit pins, add objects, manage vehicles.
7. Confirm the GM Notes tab shows the GM Notes UI (not the Player Notes
   placeholder).
8. Confirm Campaign Sheet popout edit-clock and heal-event GM controls
   work for the Thriver.
9. Repeat (1–8) as the actual GM on a campaign — confirm zero regression.
10. Repeat (1–8) as a regular Survivor on a campaign they don't GM —
    confirm zero affordances leak.

## Open questions for Xero (flag before mass edit)

- [ ] `app/stories/[id]/snapshots/page.tsx:85` hard-codes `isGM={true}`.
      Is the page upstream-gated, or is this the bug the lessons memo
      flags? Should the snapshots page allow Thriver access?
- [ ] `entries.filter(e => isGM || e.userId === userId)` (8+ sites).
      Widening to `gmLike` means a visiting Thriver sees every PC on
      the campaign (including all character sheets, all rolls in feed,
      etc). This is the godmode intent — confirming it's what you want
      before I ship.
- [ ] `onKick` — Thriver godmode includes kicking players via the
      initiative panel? Yes I think, but flagging because it's
      irreversible-feeling.
