# Handoff — 2026-05-15 Playtest Triage

Live-playtest triage session. 20 commits from this chat, ~10 more from
parallel sessions on vehicle / pins / moderation work. Nothing
in-flight; main is at `67555a1` clean.

---

## What shipped today (this chat)

### Tactical map / vehicle

1. **Minnie scaled-token click-snap** (`7feb8d9`) — `handleMouseUp`'s `moved` check now mirrors `getTokenAt`'s visual-radius hit test for `scale > 1` tokens. Followup to `ae1a2a2`; that fix covered `grid_w/grid_h` footprint but not the rendered circle. Clicking Minnie's portrait edge no longer snaps her anchor cell.
2. **Vehicle MOVE-button carries passengers** (`7736347`) — extracted `syncVehiclePassengers` helper; called from both `handleMouseUp` (drag) and `handleMouseDown` moveMode commit (popout MOVE). Driver / navigator / shooter / passenger_seats all translate with the vehicle.
3. **Popout slot confirm-gate** (`5a54773`) — slot select changes stage a pending value; Confirm/Cancel chip persists assignment + auto-snaps the assignee's scene token to a slot-specific cell on the vehicle (rotation-aware). Locked Minnie floorplan offsets per Xero. Superseded by `891c2a1` (parallel session) which made MOVE HERE the implicit confirm.
4. **Popout sheet redesign** (`c6c8ad1`) — Driver + Navigator side-by-side at top, Brewer below, Shooter row in mounted weapons, passenger seats in their own grid. MOVE HERE button per slot; NAVIGATE button on Navigator opens a roll modal with full skill picker (defaults to Navigation / ACU).
5. **NPC attribute backfill for Navigate** (`ddf5172`) — `campaign_npcs` query widened to pull `physicality` + `influence` alongside `dexterity` + `reason`. NPC navigators rolling PHY/INF-based skills now get correct AMod. ACU column gap queued separately (canon NPC schema lacks it).

### Recorder

6. **Strict tab-local capture** (`e53211b`) — `record()` now gates on `r.enabled`. Default OFF per tab. Removed the `playtest_recorder_config` fetch + realtime subscription that coupled every authed tab to a shared flag.
7. **Orphan `/record` admin page deleted** (`20aee55`) — UI + sidebar link gone; `playtest_recorder_config` table left in DB (zero callers).

### Combat / rolls feed

8. **Infection-check broadcast routing fix** (`56c0534`) — listener gate now reads `userIdRef.current` instead of stale `userId = null` closure. PC modal opens on patient's tab; NPC modal stays on GM. The bug was both tabs dropping the broadcast because gate evaluated `'<id>' !== null` → true on first mount.
9. **"Hatchet attacked was deflected" feed line** (`f59cb35`) — when `damage_json.finalWP===0 && finalRP===0`, feed swaps from `Successfully Attacked` to the deflected wording. Makes Defend visible at the table.
10. **Infection check narrative + actual days** (`fbc19ef` → `f157e69`) — replaced verbose `[d+d] +AMod -CMod = N Outcome` with canon-shaped consequence lines per (Wound|Sickness) × (shrug|fail|dire). Days plumbed through `damage_json.infection_days` so the line shows the rolled number, not "1d3/1d6".

### Infection / Day-0 Lasting Damage

11. **Day-0 Lasting Damage drainer + modal + Table 12 auto-apply** (`c4bc13b`) — new `drainInfectionDays` in `lib/campaign-clock.ts`. On clock advance, decrements `infection_days_left`. On hitting 0:
    - `severity='auto'` (Dire Failure) → 2d6 server-side, look up `LASTING_WOUNDS`, append to `data.lastingWounds`, log feed.
    - `severity='check'` (Failure) → broadcast `lasting_damage_check_request` to PC owner / GM-for-NPCs; modal opens; `executeRoll` resolves outcome.
    - Schema add: `infection_severity text` on `character_states` + `campaign_npcs` (Failure='check', Dire='auto').
12. **Pending-check persistence** (`ab5a6ae`) — schema add: `infection_pending_lasting_check boolean`. Drainer sets it true alongside the broadcast (belt-and-suspenders). Auto-open useEffect on table page scans for the flag on every entries refresh and opens the modal even if the broadcast was missed (closed tab, stale bundle, websocket dropped). Recovers Cree's pre-deploy missed case.
13. **Lasting Wound named in feed + announcement row** (`4a41b10` → `2d6ad6f`):
    - `damage_json` now carries `{wound_name, wound_effect, wound_roll}` so the compact roll line reads `Cree Hask suffered a Lasting Wound: Skittish (-1 Initiative Modifier) [2d6=7]`.
    - New `OUTCOME.lasting_wound_acquired` row inserted after every Lasting Damage Check resolution: `<name> has picked up a Lasting Wound and is now <wound> (<narrative>)`. Mirrors the wound_infection_warning two-row pattern.
    - New `LASTING_WOUND_NARRATIVE` map in `xse-schema.ts` for player-facing override wording. Skittish locked per Xero: `-1 CMod on initiative rolls`. Expandable per wound.
    - Cree's historical row backfilled in live DB.

### Campaign sheet

14. **Player agency over effects** (`e90b5ff`) — Heal / Eat / Rest / Relax buttons now visible to everyone. Advance Time stays GM-only. Note for non-GMs reworded from "Only the GM can advance the clock or queue effects" → "Only the GM can advance the clock." Heal modal's `gmLike` gate dropped.

### Documentation (lessons.md)

15. **PC vs NPC before treating infection-modal-on-GM as a bug** (`4088149`) — NPCs route to GM by design; verify the kind before chasing routing regressions.
16. **Stale-closure gate in long-lived realtime listeners** (`3ccd06b`) — use refs, not React state, in listeners registered by single-deps useEffects.
17. **Dump timestamps vs fix commit timestamps** (`6e4d226`) — cross-reference before drawing conclusions from a recorder dump.

---

## Schema migrations applied (live DB)

- `infection_severity text` on `character_states` + `campaign_npcs` (`sql/infection-severity-column.sql`). Backfill: existing `lasting_risk=true` rows set to `'check'`.
- `infection_pending_lasting_check boolean NOT NULL DEFAULT false` on both tables (`sql/infection-pending-lasting-check.sql`). One-time recovery `UPDATE` flagged Cree Hask so tony's reload picked the modal up.
- Backfill on `roll_log.damage_json` for Cree's first Lasting Damage Check (wound metadata stash).
- Backfill insert: Cree's Lasting Wound announcement row at `23:09:11.001 UTC`.

---

## Closing-bundle sweep (`475592c`)

After the initial handoff was written, Xero asked to knock out the
remaining cheap follow-ups. One commit covering 7 items:

1. **Sickness Dire Failure → Mortally Wounded on Day 0** — drainer
   sets wp_current=0 + death_countdown=max(1, 4+PHY) when severity='auto'
   AND kind='sickness'. Wound-kind Dire skips the mortal drop (canon:
   the wound IS the consequence). System feed row gets `+ Mortally
   Wounded` tag for sickness rows.
2. **NPC `lasting_wounds jsonb`** column + write path in drainer +
   executeRoll's Lasting Damage Check branch. NPCs now persist
   wounds same shape as PCs (array of names).
3. **NPC ACU read path fixed** — initially shipped a duplicate
   `acuity smallint` column thinking ACU was missing from
   campaign_npcs. Xero caught it: ACU = **Acumen**, not Acuity.
   The `acumen` column existed all along; my diag query missed it
   because I filtered against 'acuity' (stale rules-page wording)
   instead of listing every column. Dropped the duplicate
   (`sql/drop-duplicate-acuity-column.sql`); vehicle popout's NPC
   mapper now reads the real `acumen`. Three stale rules pages
   (`character-overview/rapid`, `combat/combat-rounds`,
   `core-mechanics/modifiers`) updated to say Acumen.
4. **`DROP TABLE playtest_recorder_config`** — zero callers post
   `e53211b` + `20aee55`. Dropped clean.
5. **Typo**: `Hatchet attacked was deflected` → `Hatchet attack was
   deflected` (`lib/roll-helpers.ts` + preview HTML).
6. **All 11 Lasting Wound narrative overrides** locked in
   `LASTING_WOUND_NARRATIVE`. Skittish stays Xero's verbatim
   `-1 CMod on initiative rolls`; the other 10 follow the pattern
   I proposed (`-N XYZ attribute` / `-1 max RP|WP` / `-N CMod on ...
   checks`).
7. **`todo.md` updates**: marked vehicle drag-lock shipped (parallel
   session `8ee54f4` made it moot via passenger-vanish), marked
   NPC ACU (Acumen) gap resolved as non-issue (column existed
   all along), queued NpcCard surface for `lasting_wounds` display.

## Still open (genuinely, after the closing sweep)

### Schema present, UI surface missing
- **NpcCard display for NPC `lasting_wounds`** — column exists,
  drainer writes to it, no UI shows the array yet.

### Untouched by today's work
- `tasks/polish-pass-2026-05-14-testplan.md` and
  `tasks/thriver-godmode-sweep-testplan.md` are still listed
  "untested live" in `tasks/todo.md` — those carry forward.

---

## Lessons captured today

`tasks/lessons.md` head section gained 6 new entries:
- Hit-test parity across getTokenAt + handleMouseUp
- Worktree freshness — `git log HEAD..origin/main` in state check
- Stale-closure gate in long-lived realtime listeners (use refs)
- Dump timestamps vs fix commit timestamps
- Verify PC vs NPC before treating infection-modal-on-GM as a bug
- ACU = Acumen, not Acuity — cross-check canon sources; use `SELECT column_name FROM information_schema.columns` (no filter) for column-existence diagnostics

---

## Schema migrations applied (live DB, today)

1. `infection_severity text` on `character_states` + `campaign_npcs`
2. `infection_pending_lasting_check boolean NOT NULL DEFAULT false` on both
3. `campaign_npcs.lasting_wounds jsonb NOT NULL DEFAULT '[]'`
4. `DROP TABLE playtest_recorder_config`
5. `DROP COLUMN acuity` on `campaign_npcs` (the duplicate I mistakenly added; `acumen` already existed)

Plus backfills: Cree's `damage_json` (wound metadata) and her
Lasting Wound announcement row (Skittish, 23:09:11.001 UTC).

---

## State at handoff

- Worktree: `claude/keen-lamarr-7b6cf7` at `475592c`, clean, rebased.
- Main checkout `/c/TheTapestry`: synced to `475592c`. Pre-existing
  local edits on `tasks/backlog-2026-05-11-comprehensive.md` and the
  CRB-rewrite untracked files left untouched per the original handoff.
- 5 stash entries in main checkout, all from parallel sessions,
  none mine.
