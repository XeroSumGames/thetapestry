# GM Notes Popout — Editable Fields Testplan

**Date:** 2026-05-06
**Branch:** `claude/vigorous-goldstine-dcf2bf` → `main`
**Files touched:** `app/gm-notes-popout/page.tsx`

The popout was read-only ("Read-only for v1"). It now click-to-edits every
field a GM might want to tweak mid-session, persisting via
`.update().select()` to surface RLS rejections.

## Editable surfaces

| Section | Fields | Widget |
|---|---|---|
| Header | `campaigns.description` | EditableText (multiline) |
| Plot Beats | `campaign_notes.title`, `campaign_notes.content` | EditableText (single + multiline) |
| Tactical Scenes | `tactical_scenes.name` | EditableText (single) |
| NPCs | `name`, `npc_type`, `disposition`, `motivation`, `notes`, `hidden_from_players` | Mix: Text / Text / Select / Text / Text-multi / Toggle |
| Pins | `name`, `notes`, `sort_order`, `revealed` | Text / Text-multi / Number / Toggle |

`campaigns.name` stays read-only (rename happens on Edit page — the H1 here mirrors that source of truth).

## How to launch

1. `notepad app/stories/<your-test-campaign-id>/page.tsx` is unnecessary —
   just open the live site:
2. Sign in as the campaign GM.
3. Navigate to `/stories/<id>` and click the **GM NOTES** button in the
   action bar. Popout opens at `/gm-notes-popout?c=<id>` (980×800).
   Or: from `/stories/<id>/table` use **GM Tools → GM Notes**.

## Verification — happy path

For each editable surface below, a hover should add a faint dotted
underline (single-line fields) or chip cursor (chips/toggles), and a
click should swap the field to an input/textarea/select.

### 1. Campaign description

- [ ] Click the description text under the campaign name. Textarea
      opens. Edit text. Click outside or press **Cmd/Ctrl+Enter** to
      save. Esc cancels.
- [ ] Empty value displays "Add a campaign description…" in italic gray.
- [ ] Reload the popout — change persists.
- [ ] Reload `/stories/<id>` — same change shown in the H1 description.

### 2. Plot beats (campaign_notes)

- [ ] Click a beat **title** → input. Edit, blur. Persists.
- [ ] Click the **content** body (rich-text rendered) → textarea
      with raw text. Edit, blur. Persists. Re-renders rich text on close.
- [ ] HammerTime tags inside content remain rendered after edit
      (raw goes through `renderRichText` again on display).

### 3. Tactical scenes

- [ ] Click a scene **name** → input. Edit, blur. Persists.
- [ ] Empty save defaults to `Untitled Scene`.

### 4. NPCs

- [ ] Click **name** → edit. Empty save defaults to `Unnamed NPC`.
- [ ] Click **type chip** → edit free-text (e.g. "Survivor" → "Bandit"). Persists.
- [ ] Click **disposition chip** (might show "—" if unset) → select dropdown
      with Friendly / Neutral / Hostile / —. Choose value, dropdown closes,
      chip updates color (red=hostile, green=friendly, gray=neutral/empty).
- [ ] Click **Hidden / Visible** chip → toggles boolean. Color flips
      (gray ⇄ green).
- [ ] Click **motivation** italic line → edit. Persists.
- [ ] Click **notes** → multiline textarea with full content. Cmd+Enter
      saves.

### 5. Pins

- [ ] Click **`#N`** → number input (60px wide). Type new number, blur. Persists.
      Empty value → null.
- [ ] Click pin **name** → edit. Empty → `Unnamed Pin`.
- [ ] Click **Revealed / Hidden** chip → toggles boolean. Color flips
      (green ⇄ gray).
- [ ] Click **notes** → multiline edit. Cmd+Enter saves.

## Verification — failure paths

- [ ] Open the popout as a player (non-GM). Should show **"GM access only."**
      (Should be impossible from UI; only verifies via direct URL.)
- [ ] Disconnect network mid-edit, blur to commit. Alert should fire
      ("Save failed: …") and the field reverts to its previous value.
- [ ] Edit two fields on the same NPC quickly (e.g. name then notes).
      Both should persist; no race or revert.

## Cross-checks

- [ ] Open `/gm-notes-popout?c=<id>` AND `/stories/<id>/edit` side-by-side.
      Edit description in the popout. Reload the Edit page — change reflects.
- [ ] Open the popout AND `/stories/<id>/table` side-by-side. Edit an
      NPC's disposition in the popout. Realtime — token border on the
      tactical map should NOT auto-recolor (color column on `scene_tokens`
      is updated only via the NpcRoster path; this is acceptable for v1
      and noted as a follow-up below).

## Known limitations / follow-ups

- **No realtime token recolor on disposition change.** Editing disposition
  here updates the `campaign_npcs` row, but doesn't ripple through to
  `scene_tokens.color`. NpcRoster does this via `getNpcTokenBorderColor`.
  If GMs lean on this surface for disposition flips, port that ripple in.
- **No "add new" affordances.** Adding new beats / NPCs / pins still
  happens on `/table`. Footer string says so.
- **Notes display un-truncated.** Original read-only popout truncated
  NPC notes at 280 chars and pin notes at 240. For editing usability the
  full text is now always visible. If long notes blow up the layout, add
  a collapse/expand toggle.
- **Disposition chip always shown** (with "—" when null). Adds a click
  target so GMs can SET disposition on dispositionless NPCs. Visually
  noisier than the read-only variant which hid the chip when null.

## Fingerprint

Look for the new helper components at the bottom of the file:
`EditableText`, `EditableSelect`, `EditableToggle`, `EditableNumber`.
