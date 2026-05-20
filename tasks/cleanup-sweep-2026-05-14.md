# Cleanup sweep - 2026-05-14

## What was deleted

### sql/update-player-joined-trigger.sql (v1)
**Reason:** Superseded by v3. Defined only `notify_player_joined()` - GM-only notification on player join.

### sql/update-player-joined-trigger-v2.sql (v2)
**Reason:** Superseded by v3. Defined `notify_player_joined()` + `notify_character_changed()` - notified all members, but had no distinction between first assignment and reassignment.

Both are `CREATE OR REPLACE FUNCTION`, so v3 fully overwrites them when applied. v3 improves both: better GM-skip logic (checks `campaigns.gm_user_id` directly), splits "joined" vs "joined as" vs "is now playing as" messaging.  
**Commits:** `0827fcc`, `d23908c`

### scripts/build-open-work-docx.py (undated)
**Reason:** Superseded by `build-open-work-docx-2026-05-06.py`. The undated script generated `tasks/open-work-2026-05-05.docx` from the 05-05 snapshot. The dated variant is the post-marathon-session prune (05-06), marks two items DONE, adds a Security Hardening section, and is the current source of truth. `tasks/todo.md` line 155 explicitly records it as superseded. No cron, Makefile, or workflow file called the undated script.  
**Commit:** `9028295`

---

## What was skipped and why

### app/campfire/forums2/page.tsx
Live A/B test variant ("Forums B (preview)"), wired into the campfire tab strip with `preview: true`. Winner not yet decided - left alone per instructions.

### app/logging/page.tsx:183 - "Ghost" / "Survivor" in Leaflet popup
Human-readable display labels, not role comparisons. The role-literal guardrail targets comparison code paths, not UI strings. No action needed.

### sql/combat-actions-v2.sql
Low confidence on staleness - migration history is a single large commit and the file naming doesn't have a clear v3 successor. Skipped per instructions.

### sql/npc-folder-column.sql
Same situation - no clear successor or migration record confirms it was applied. Skipped per instructions.

---

## Additional dead-code candidates for owner decision

1. **`app/campfire/forums2/page.tsx` (A/B test winner)** - the file itself is fine, but the A/B test has been running since at least the initial large commit. Worth deciding the winner and either promoting `forums2` to the main `forums/page.tsx` or deleting it.

2. **`tasks/open-work-2026-05-05-printable.md`** - the 05-05 source markdown that `build-open-work-docx.py` read from. Now that the script is gone, this file has no generator and its content is stale relative to the 05-06 checklist. Candidate for deletion alongside the docx output it produced (`tasks/open-work-2026-05-05.docx`), unless you want to keep them as a historical snapshot.

3. **Multiple dated `tasks/handoff-*.md` files** - there are 10+ handoff snapshots going back to 2026-04-27. These are point-in-time notes; once superseded by the next handoff they have no operational value. A single archival pass could drop everything except the most recent two or three.

4. **`tasks/open-work-checklist-2026-05-05*.md` variants** - three files (`open-work-2026-05-05-printable.md`, `open-work-checklist-2026-05-05.md`, `open-work-checklist-2026-05-05-verified.md`) cover the same 05-05 snapshot in different forms. All superseded by the 05-06 checklist.

5. **`sql/update-player-joined-trigger-v3.sql`** - confirm this was actually applied to the database (via Supabase dashboard or migration runner). If it hasn't been applied yet, v1/v2 may still be the live DB state. The deletion of the files doesn't affect the DB, but worth a quick verification.
