# Finding - GM-only hidden NPCs in initiative (no-spoiler combat prep)

**Lane:** routed to **Hunt & Peck**.
**Severity:** feature gap. NOT a blocker (Xero worked around it by
manually moving Dylan around during the 2026-05-31 playtest), but the
workaround is awkward and the encounter setup pattern is too common to
leave un-shipped. Real GM UX win.

## Trigger

2026-05-31 playtest. Xero (recovered note):

> "there may be times i want to add an NPC to combat without playings
>  seem them in the initative bar. when we were testing, I was manually
>  moving Dylan so that the players didn't see him. would have been good
>  for him to be in the list and part of the order and moving around
>  like other chars without the surprise being spoiled for the players"

The use case: the GM wants to prep an ambush, a flanker, or a hidden
adversary that's already in the initiative order, taking turns, moving
on the GM's map view - but invisible in the players' initiative bar
and on the players' map view until the GM chooses to reveal.

## Where

- DB: [initiative_order schema](sql/_baseline/schema.sql) - add a new
  column.
- Render: [components/InitiativeBar.tsx](components/InitiativeBar.tsx) -
  filter the visible list for non-GM viewers.
- Token coupling: [scene_tokens.is_visible](components/TacticalMap.tsx)
  already exists for per-token visibility; reuse it for the NPC token.
- Add-NPC flow: wherever the GM picks an NPC and pushes them into
  initiative (search `setInitiativeOrder` / the Add NPC modal in
  page.tsx) - add a "Hidden from players" toggle.

## DB change

Add a column to `initiative_order`:

```sql
ALTER TABLE initiative_order
  ADD COLUMN hidden_from_players boolean NOT NULL DEFAULT false;
```

- Nullable would invite confusion; NOT NULL DEFAULT false makes every
  existing row trivially correct.
- No RLS update needed: only the GM can INSERT/UPDATE initiative_order
  today (membership check via campaign), and that's exactly who needs
  to set this column.
- No realtime publication change needed: `initiative_order` is already
  in supabase_realtime.

Ship as `sql/initiative-hidden-from-players-2026-05-31.sql`. HP applies
when they pick up the feature (puffer wrote the SQL; the apply belongs
in the same commit as the UI consumer to avoid an orphan column).

## UI changes (HP)

### 1. Add-NPC flow gets a "Hidden from players" toggle

Wherever the GM Add-NPC modal is rendered, add a small toggle/checkbox
above the Add button: "Hidden from players (no initiative-bar entry,
no map token visible)". Defaults OFF so existing behavior is unchanged.

On submit, the new initiative_order row is INSERTed with
`hidden_from_players: true` AND the matching scene_tokens row spawned
with `is_visible: false`. (Token visibility is per-row, GM-only-can-see
by existing convention.)

### 2. InitiativeBar filters for non-GM viewers

[components/InitiativeBar.tsx](components/InitiativeBar.tsx) currently
receives the full `initiativeOrder` array and renders every entry.

Two changes inside InitiativeBar:

- **Non-GM viewers:** filter `initiativeOrder` to drop entries where
  `hidden_from_players === true` BEFORE the render loop. The bar
  collapses to the visible cast.
- **GM viewer:** render the full list, but visually mark hidden entries
  with a small chip (e.g. `[HIDDEN]` in muted text + a 50% opacity
  treatment) so the GM can see at a glance which NPCs are still
  unrevealed.

### 3. Active-turn handling when a hidden NPC is up

When a hidden NPC is the active entry (`is_active: true`):

- **GM view:** behaves like any other active entry. GM acts for them
  normally.
- **Player view:** the players' initiative bar would otherwise show
  no one as active (because the hidden entry is filtered out). Render
  a generic placeholder slot in the active position: a portrait-less
  card with the label "Waiting…" or "(GM acting)". This preserves the
  party-knows-the-rhythm feel (players see that someone's taking a
  turn) without leaking the NPC's existence.

Recommend the "Waiting…" wording - it's neutral and matches the
GM's perspective that *something* is happening but the players don't
yet know what.

### 4. Reveal action

GM needs a one-click reveal on the hidden entry. Add a small "👁
Reveal" button next to the existing GM-only controls in the entry
chip. On click:

- UPDATE `initiative_order.hidden_from_players = false` for that row.
- UPDATE `scene_tokens.is_visible = true` for the matching NPC token.
- INSERT a roll_log row: `outcome: 'reveal'`, label:
  `"<NPC name> reveals themselves!"` so the players see the reveal
  moment in the rolls feed.
- Realtime fan-out makes the NPC pop into the players' initiative bar
  and onto the map in the same tick.

### 5. Removal still works the same

The existing `handleInitiativeBarRemove` flow doesn't need any change -
removing a hidden NPC is the same as removing a visible one.

## Acceptance

- GM adds an NPC with "Hidden from players" toggled on. The NPC appears
  in the GM's initiative bar (chip labelled HIDDEN) and on the GM's
  map. Players see neither in their initiative bar nor on their map.
- Initiative advances; when the hidden NPC's turn comes up, the GM
  acts for them normally. Players see a "Waiting…" placeholder slot
  in the active position.
- GM moves the hidden NPC's token around the map. Players never see
  the token. GM-broadcast `token_changed` events flow as normal; the
  filter is purely on the render side.
- GM clicks Reveal. Initiative bar updates on every client to show the
  NPC by name; token becomes visible per existing visibility rules
  (the LoS sweep then re-runs and may immediately hide it again via
  fog if it's behind cover, which is correct).
- Existing non-hidden NPC flow is byte-identical (DEFAULT false on the
  column means every previously-added NPC behaves exactly as before).
- Build + 822 unit tests + font/role/em-dash/arch all green.

## Edge case to note (don't fix in V1)

If a hidden NPC attacks a PC on their hidden turn, the attack reveals
their existence by necessity (damage land in the roll_log). The right
behavior is to auto-reveal the NPC the moment they take an offensive
action against a player-visible target. That auto-reveal can be a
follow-up - V1 ships with manual-reveal only and the GM remembers to
hit the 👁 button when the ambush triggers. Capture as a follow-up
todo if you don't ship it in V1.

## Tracking

Append to `tasks/todo.md` CURRENT OPEN under PLAYTEST POLISH ROUTES:

```
- [ ] **[ROUTED -> HUNT & PECK 2026-05-31] hidden NPCs in initiative (GM-only, no-spoiler combat prep)** - `initiative_order.hidden_from_players` boolean (SQL committed at `sql/initiative-hidden-from-players-2026-05-31.sql`); Add-NPC flow gets a toggle; `components/InitiativeBar.tsx` filters for non-GM viewers + shows HIDDEN chip on GM side; active-turn shows "Waiting…" placeholder on player tabs; 👁 Reveal button updates row + token + posts a reveal roll_log line. Couples to existing `scene_tokens.is_visible`. Finding: `tasks/finding-hidden-npc-in-initiative-2026-05-31.md`.
```
