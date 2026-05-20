# Soft-Delete Stance

Closes Pre-Launch Audit item **Y11**. Documents the current per-table behavior across the codebase as of 2026-05-19, calls out the inconsistencies, and leaves the open policy questions for Xero. Pure documentation - no schema changes ship with this doc.

Recovery from accidental delete is covered separately in [tasks/ops-backup-playbook-2026-05-19.md](ops-backup-playbook-2026-05-19.md) (Y12).

---

## TL;DR

**Default is hard-delete.** ~30 distinct tables receive `.delete()` calls from app code (112 sites across 32 files). Four tables use a soft-delete column (`archived_at` or `left_at`) for specific reasons captured below. There is no global "soft-delete every row" policy, and no audit log of deletes.

If a row is deleted from any non-soft-delete table, recovery requires Supabase PITR (point-in-time restore). See the backup playbook.

---

## Tables that soft-delete (4)

| Table | Column | Set when | Why soft-delete |
|---|---|---|---|
| `modules` | `archived_at` + `archived_by` | Author or Thriver archives | Modules with `>=1` active subscriber MUST archive instead of hard-delete (sql/modules-archive.sql). Hard-delete would orphan running campaigns mid-session. Private/Unlisted modules with 0 subs may still hard-delete. Thrivers may hard-delete anything (moderation). |
| `scene_tokens` | `archived_at` | Token is "unmapped" via the GM unmap flow | Preserves token position + state for the next remap. `archived_at IS NULL` = on the map. Partial index `idx_scene_tokens_archived_at WHERE archived_at IS NULL` keeps the active-token query fast (sql/scene-tokens-archived-at.sql). |
| `community_members` | `left_at` + `left_reason` | Member self-leaves OR is removed by leader/GM | Preserves the history of who was in the community when, who left when, and why. Useful for both community storytelling + audit (sql/community-members-self-leave.sql). |
| `conversation_participants` | `archived_at` | User archives a DM thread | Keeps message history readable to the other party; hides the thread from the archiver's list (sql/messages-actions.sql). |

---

## Tables that hard-delete (the default)

Hard-delete is used everywhere else. Notable cases below grouped by what's lost:

**Session-scope (cleared deliberately on session start; expected hard-delete):**
- `roll_log` - feed cleared at session start (intentional - rolls don't persist across sessions per Xero's UX call)
- `chat_messages` - same as roll_log
- `initiative_order` - cleared at end of combat
- `notifications` - cleared after the user dismisses

**Campaign content (hard-delete on user action; recovery = Supabase PITR):**
- `characters` - delete via "Delete character" button; CASCADEs to `character_states`
- `campaigns` - "Delete campaign" wipes the campaign and all its rows
- `campaign_npcs`, `campaign_pins`, `campaign_notes`, `tactical_scenes` - GM-initiated removals
- `campaigns.vehicles` (JSONB array) - array element removal on uninstall/decommission
- `community_stockpile_items` - hard-delete when item count drops to 0 OR when item is moved
- `community_events`, `community_subscriptions`, `world_communities` - hard-delete via admin / leader actions

**Forum + social content (hard-delete on author action; soft-delete via moderation_status='rejected' is an orthogonal concept):**
- `forum_threads`, `war_stories`, `lfg_posts` - author or Thriver delete; CASCADEs to replies/reactions
- `module_reviews` - reviewer hard-delete
- `player_notes`, `whispers` - hard-delete on user action

**Map content:**
- `map_pins` - GM hard-delete; settings-level pins (`world_communities`) follow setting-admin rules

**Bulk teardown:**
- `delete-user` edge function hard-deletes EVERYTHING owned by the user across all tables (sql + storage). Triggered by user-initiated account deletion or Thriver moderation. By design - GDPR right-to-erasure.

---

## Inconsistencies + open questions for Xero

These are the spots where current behavior is unclear or could go either way. Stance to be locked when Xero is ready:

1. **`characters` + `character_states` cascade** - currently hard-delete from `characters` via the "Delete character" button. CASCADE on the FK pulls `character_states` with it. **Question:** should a PC death + revive cycle preserve historical state, or is the current "delete and start fresh" correct? Today it's the latter. (See Pre-Launch Audit R12.)
2. **`campaigns` deletion** - GM hits "Delete campaign" and everything tagged by `campaign_id` is wiped via CASCADE. **Question:** for a paying GM whose laptop crashed mid-delete, is "Are you ABSOLUTELY sure (type DELETE)" double-confirm enough? Today there's a single confirm. (See bright-line in operating-mode.md.)
3. **`modules` archive vs hard-delete decision tree** is the only place we have written-out logic for which kind of delete to use. Could be a template for other tables IF Xero decides to converge.
4. **`campaign_snapshots` hard-delete** - snapshots are themselves a recovery mechanism; deleting one is intentional. No soft-delete needed.
5. **`roll_log` clear at session start** - this LOSES rolling history forever. Recent feature: Export Session Log (`22d75dc`) gives the GM a one-shot save before clear. **Question:** should the clear be a soft-delete (`session_archived_at`) so the GM can scroll back into prior sessions inside the app? Today they have to keep the Export JSON to look back.

---

## How to add a new table

Default to **hard-delete**. Add a `archived_at` / `left_at` / equivalent column only if at least one of these is true:

- Other rows reference this row and would break without it (modules <- subscriptions).
- The row carries history that's valuable post-delete (community_members audit).
- There's a "restore" UX the user expects to find (scene_tokens unmap -> remap).
- Compliance / moderation requires keeping the record visible to admins but hidden from the user (no current example; would apply if we add GDPR-tombstones).

If none of those apply, hard-delete is simpler + cheaper + fewer "where archived_at IS NULL" clauses to maintain.

---

## What's NOT in scope here

- **Audit log of deletes.** There is no `deleted_records` table that captures who deleted what when. Recovery from accidental delete relies entirely on Supabase PITR. If this becomes a paying-customer concern, the doc to write is the audit-log spec.
- **GDPR right-to-erasure exception handling.** The `delete-user` edge function does the right thing for normal account closure. Edge cases (user demands erasure of a community history that other players want preserved) aren't documented anywhere.
- **Soft-delete on `profiles`.** Account deletion hard-deletes the profile via the edge function. There's no "tombstone profile" state. If we want one (e.g. to preserve attribution on war stories the deleted user authored), it's a separate design.

---

## Maintenance notes

Update this doc when:
- A new table is added with a soft-delete column - add a row to the table above.
- A table is converted from hard-delete to soft-delete (or vice versa).
- An "open question" gets a Xero ruling - move it to the "Tables that..." sections.

Last full audit: 2026-05-19. Re-audit any time pre-launch + every 6 months thereafter; or when Y11 in the pre-launch punch list reopens.
