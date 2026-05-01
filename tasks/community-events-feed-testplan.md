# Phase 4D — Per-community Campfire feed testplan

Verifies the new `community_events` table + auto-post hooks (Morale finalize / Schism / Migration / Dissolution) + manual GM composer + UI surfaces (CampaignCommunity Feed section + /communities Following card chip row).

---

## 0. Prerequisites — apply the migration

**Before any UI test:** run `sql/community-events.sql` in Supabase SQL editor against prod.

The migration adds:
- `community_events` table (id / community_id / event_type / payload jsonb / author_user_id / created_at)
- Indexes on `(community_id, created_at DESC)` and `(event_type, created_at DESC)`
- Five RLS policies:
  - `ce_select_member` — campaign members read all events for communities in their campaign
  - `ce_select_published` — any signed-in user reads events for communities whose `world_communities` mirror is `moderation_status='approved'` (drives the Following-card chip row)
  - `ce_insert` — campaign members can post (auto-post hooks + manual composer)
  - `ce_update_gm` — GM can amend
  - `ce_delete_gm` — GM can remove (retract noisy auto-posts)
- `NOTIFY pgrst, 'reload schema'`

Confirm in Supabase Studio → Tables that the table + indexes exist.

---

## 1. Morale finalize auto-post

**Setup:** sign in as the GM of a campaign with at least one `status='active'` community at 13+ members.

1. Open the community in /stories/[id]/community (or the table page's Community tab).
2. Click "Run Weekly Check". Fill in CMods if needed; finalize the modal.
3. After finalize, the community accordion's new **🔥 Community Feed** section should show a `📊` event row at the top: `"Week N · <outcome> · X left"` (or no `· X left` if zero departures).
4. Authoring: card subtitle reads `by <GM username> · <date>`.
5. **Database sanity:** `SELECT event_type, payload, author_user_id FROM community_events ORDER BY created_at DESC LIMIT 1;` — should show `event_type='morale_outcome'`, payload with `week`, `outcome`, `fed_outcome`, `clothed_outcome`, `departures_count`, `modifiers_summary`, `total`, `leader_name`, and `author_user_id` matching your user id.
6. Repeat with a Failure outcome → confirm `departures_count` matches the number who left, and the row's accent is teal `#7ab3d4`.

## 2. Dissolution auto-post

**Setup:** trigger a Morale Check that takes the community to 3 consecutive failures (or pre-seed `consecutive_failures=2` in `communities` for fast repro).

1. Run Weekly Check, accept the failure, click the red "Finalize — Dissolve Community" button.
2. After finalize, the Feed section should show TWO new rows: a `📊` morale_outcome card AND a `☠️` dissolution card with summary `"Dissolved week N · X scattered"`.
3. The dissolution card's accent is red `#c0392b`.
4. **DB sanity:** two new rows in `community_events` — one `morale_outcome` and one `dissolution`. Both share `author_user_id`.
5. Confirm `members_lost` in the dissolution payload equals the `members_before` count from the morale check.

## 3. Schism auto-post

**Setup:** GM of a community with ≥10 members.

1. Open the schism modal from the Community ▾ menu.
2. Pick at least 2 members for the breakaway, name the new community, save.
3. Reload — the SOURCE community's Feed section should show a `⚡` event card: `"Schism — N left to form <New Name>"`. The new community's Feed section is empty (its events accumulate from THAT point forward).
4. **DB sanity:** one `event_type='schism'` row whose `payload.new_community_id` matches the newly-inserted communities row, and `members_left` = picked count.

## 4. Migration auto-post

**Setup:** a dissolved community (with `dissolvedSurvivors` populated) and at least one approved `world_communities` target.

1. Open the dissolved community's expanded card. Click "Migrate Survivors".
2. Pick a target community, select 1+ survivors, click submit.
3. Source community's Feed section shows a `🚶` event card: `"N migrated → <Target Name>"`.
4. **DB sanity:** one `event_type='migration'` row, `payload.target_community_id` matches the picked target, `payload.members_moved` = count.

## 5. Manual GM "Post update"

1. As GM, expand any active community. The Feed section header has a `📝 Post update` button.
2. Click → composer textarea expands inline. Type free-form note.
3. Click "Post to feed" → composer collapses, new card appears at the top of the feed with the typed body, `📝` icon, and `by <GM username> · <date>` byline.
4. **Empty body guard:** typing nothing or only whitespace and clicking Post should alert "Write something first" and not insert.
5. **Cancel discards:** type something, click Cancel → no insert, draft body cleared.

## 6. Non-GM viewer

**Setup:** sign in as a campaign member who is NOT the GM (player role).

1. Open the same community.
2. Feed section RENDERS (player can read events) but the `📝 Post update` button is HIDDEN.
3. The per-row `×` delete button on each event card is HIDDEN.
4. **DB sanity:** RLS blocks the player from inserting via the API directly — confirm by attempting `INSERT INTO community_events ... author_user_id=<your id>` with their JWT (should fail unless they're a campaign member, which they are — so this actually succeeds; the UI gate is the policy here, not RLS).

## 7. Delete affordance (GM only)

1. As GM, click the `×` button next to any event row.
2. Confirm modal explains "Auto-posts can be reposted by re-running the action; manual posts are permanent on delete."
3. Confirm → row removed from feed.
4. **DB sanity:** corresponding `community_events` row gone. RLS allows GM via `ce_delete_gm` policy.

## 8. /communities Following card chip row

**Setup:** the user follows a community published to the Tapestry (via the world map subscribe flow) that has at least 1-3 events posted (Morale finalize / Schism / Migration / Manual).

1. Navigate to /communities.
2. The "★ Following" section's card for the followed community should show a chip row of up to 3 most-recent events between the size-band tags and the "Updated X ago" line.
3. Each chip = type icon (📊/⚡/🚶/☠️/📝) + summary line in the type's accent color.
4. Hover any chip → tooltip shows the exact ISO timestamp.
5. **RLS sanity:** the user is NOT a campaign member of the source campaign — the public-published RLS branch on `community_events` is what makes this work. Confirm by checking the user's profile against `campaign_members` for the source campaign id (should be empty) and confirming the chips still render.
6. **Unpublished case:** unpublish the community via the GM's Tapestry strip. Refresh /communities → chips disappear from that card (the public-published RLS branch no longer applies; user is not a campaign member so they can't see events at all).

## 9. Feed reload after page refresh

1. After auto-post or manual post, hit browser refresh.
2. Feed events should re-fetch from the DB and render in the same order (most-recent first, capped at 20 in the accordion view, capped at 3 on Following cards).

## 10. Database sanity (post-flow)

```sql
SELECT event_type, count(*)
FROM community_events
GROUP BY event_type
ORDER BY count DESC;
```

Confirm:
- `morale_outcome` count ≈ number of Morale finalizes
- `dissolution` count = number of dissolved communities
- `schism` + `migration` counts match user-triggered events
- `manual` count = number of free-form GM posts

```sql
EXPLAIN ANALYZE
SELECT * FROM community_events
WHERE community_id = '<some-uuid>'
ORDER BY created_at DESC
LIMIT 20;
```
Plan should hit `idx_community_events_community`.

---

## Open follow-ups (NOT in 4D scope)

1. **Realtime subscription on `community_events`.** Today the feed re-renders on `load()` calls (post-finalize, post-schism, post-migration, post-manual) but doesn't auto-update if another GM in the same campaign posts an event from a different browser. Add a Supabase realtime subscription on `community_events` filtered by community_id when a community accordion is expanded. Cheap; about ~20 lines.

2. **Pagination beyond the most-recent 20.** The accordion view caps at 20 events; older ones aren't reachable. Add a "Load older" button that fetches the next 20 by `created_at < oldest`.

3. **Manual post body — rich text + linkify.** Today the manual composer is plain `<textarea>`. Should probably reuse the existing `renderRichText` utility (used in `/messages` and `/campfire/lfg`) to auto-linkify URLs in the rendered card body.

4. **Schism: also post to the NEW community's feed.** Today only the source community gets the `⚡ Schism` auto-post. The new community's feed starts empty. Could fire a complementary "founded by schism from <Source>" entry on the new community to anchor its history.

5. **Notification on auto-posts to subscribers.** A follower currently sees event chips on their Following card after refresh. Could also trigger a notification (`type='community_event'`) so they know without visiting the page. Pairs with the existing subscriber-notify trigger pattern from Phase E.

---

## Rollback

```sql
DROP POLICY IF EXISTS "ce_select_member" ON community_events;
DROP POLICY IF EXISTS "ce_select_published" ON community_events;
DROP POLICY IF EXISTS "ce_insert" ON community_events;
DROP POLICY IF EXISTS "ce_update_gm" ON community_events;
DROP POLICY IF EXISTS "ce_delete_gm" ON community_events;
DROP INDEX IF EXISTS idx_community_events_community;
DROP INDEX IF EXISTS idx_community_events_type;
DROP TABLE IF EXISTS community_events;
NOTIFY pgrst, 'reload schema';
```

UI changes are git-revertable. The `lib/community-events.ts` helpers + the four auto-post hooks + the Feed section UI + the Following-card chip row all live in commits that revert cleanly.
