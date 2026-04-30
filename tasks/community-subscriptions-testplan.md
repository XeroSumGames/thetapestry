# Test Plan — Communities Phase E #B: Subscription value-add

Shipped 2026-04-30. Builds on the existing Follow/Unfollow + /communities Following list (already in place from Sprint 5).

## Pre-flight

Apply BOTH migrations in the Supabase SQL editor (in this order):

1. [sql/world-communities-subscriber-count.sql](../sql/world-communities-subscriber-count.sql)
2. [sql/world-communities-subscriber-notify.sql](../sql/world-communities-subscriber-notify.sql)

Verify each applied:

```sql
-- subscriber_count column should exist on world_communities
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'world_communities' AND column_name = 'subscriber_count';

-- both triggers should exist
SELECT trigger_name FROM information_schema.triggers
  WHERE event_object_table IN ('world_communities','community_subscriptions')
    AND trigger_name LIKE '%subscriber%';
```

You'll need at least one published, approved world community to test against (e.g., the Mongrels community).

## Subscriber count chip

1. Open `/map`. Find a community marker. Click it.
2. **Expected**: popup shows a new ★ N chip (purple, alongside size/status/faction). N matches the actual subscriber count.
3. Click ☆ Follow on the popup.
4. **Expected**: chip in the popup ITSELF doesn't update (the popup HTML is static after render — the ★ button label changes to "Following", but the count chip is from the initial fetch). Close the popup.
5. Re-click the marker.
6. **Expected**: re-rendered popup now shows ★ N+1.
7. Open `/communities`. Scroll to the Following section.
8. **Expected**: each card shows the same ★ N chip alongside size band and faction.
9. Click ✕ Unfollow on a card.
10. Reload `/map`, click the marker.
11. **Expected**: count is back to N−1.

## Subscriber notifications on update

1. As a different account (not the GM), follow a published community on the world map.
2. As the GM, edit that community's public face — change description, faction label, status, or homestead. Save.
3. Switch back to the follower account. Open the notifications bell (or wherever notifications surface in the app).
4. **Expected**: a `world_community_followed_updated` notification appears with title `★ <Community Name> updated` and a body summarizing what changed (e.g. "GM-name updated public info on 'Mongrels' (description, faction).").
5. Click the notification → routes to `/communities`.
6. **Expected**: the Following card for that community shows the new state.

## Editor-doesn't-self-notify

1. As the GM, follow your OWN published community.
2. Edit the community's public info (any human-readable field).
3. **Expected**: NO subscriber notification fires for the GM. The Thriver moderation notification still fires normally for any logged-in Thriver.

## Auto-status from Morale outcome

1. Pick a published community with `community_status='Holding'`. Note its current status on the world-map popup.
2. Run a Weekly Morale Check that resolves with **Wild Success** or **High Insight** (force the dice if needed for testing — temporarily edit the modal to force a roll, then revert).
3. **Expected**: after Finalize, the world map popup re-fetched on next render shows `community_status='Thriving'`. The Following card reflects this. Subscribers receive a notification because community_status changed.
4. Run another Weekly Morale Check that resolves with **Failure**.
5. **Expected**: status flips to `Struggling`. Notification fires.
6. Run a Morale Check that resolves with **Success**.
7. **Expected**: status STAYS at the previous value (Success doesn't auto-shift). The `last_public_update_at` timestamp DOES update — Following card still shows "Updated just now" — but no notification fires (the trigger requires a public field change to notify).

## Auto-status on dissolution

1. Force a community to its 3rd consecutive Morale failure. Let the Retention Check fail too.
2. Finalize the dissolution.
3. **Expected**: `community_status='Dissolved'` on world_communities. World-map dot turns gray. Subscribers get a final notification. The Following card shows the dissolution.

## Edge — unpublished community

1. Run a Weekly Morale Check on a community that has NOT been published to the Tapestry.
2. **Expected**: no errors. The world_communities UPDATE in finalizeAndSave is a no-op (no row matches `source_community_id`).

## Last-updated timestamp on Following cards

1. On `/communities`, find a Followed community card.
2. Hover the "Updated X ago" line.
3. **Expected**: tooltip shows the exact ISO timestamp.
4. Run a Morale Check on the source community as the GM.
5. Reload `/communities` as the follower.
6. **Expected**: the "Updated X ago" line shows "just now" or "X minutes ago".

## Regression — basic Follow / Unfollow still works

1. Click ☆ Follow on a world-map popup → button flips to ★ Following, persisted on reload.
2. Click ★ Following → flips back, row removed from `community_subscriptions`.
3. /communities Following section reflects both transitions.
