# Phase 4E (final bundle) testplan — reactions + threading + FTS + invitations

Verifies the four heavier polish items shipped in this final 4E sprint: reactions on Forums B + War Stories + LFG, comment threading on War Stories + LFG, full-text search across all three feed surfaces, and the formal `campaign_invitations` accept/decline flow that replaces the old DM-with-link.

---

## 0. Prerequisites — apply the migration

**Run `sql/campfire-polish-4e.sql` in Supabase SQL editor against prod.**

This single migration adds:
- **Reactions tables:** `forum_thread_reactions`, `war_story_reactions`, `lfg_post_reactions` — each with `(target, user_id, kind text in 'up'|'down')` + UNIQUE(target, user_id) + RLS (read all signed-in, write own).
- **Reply tables:** `war_story_replies`, `lfg_post_replies` — mirror `forum_replies` shape. Plus `reply_count` + `latest_reply_at` columns on `war_stories` and `lfg_posts` (maintained by triggers).
- **FTS columns:** `search_tsv tsvector GENERATED ALWAYS AS (...) STORED` on `forum_threads`, `war_stories`, `lfg_posts` (title weighted A, body weighted B). GIN indexes on each.
- **Invitations table:** `campaign_invitations` with status enum + RLS + 2 triggers:
  - `notify_campaign_invitation` on INSERT → creates a `campaign_invitation` notification on the recipient with `metadata.invitation_id` + `metadata.campaign_id`.
  - `handle_campaign_invitation_response` on UPDATE → if `accepted`, auto-INSERT into `campaign_members` (idempotent on unique violation); always emits a `campaign_invitation_response` notification back to the sender.
- `NOTIFY pgrst, 'reload schema'`.

Confirm in Supabase Studio that all 6 new tables + 3 GIN indexes + 2 triggers exist.

---

## 1. Reactions (▲ ▼) on War Stories

1. Navigate to `/campfire/war-stories` as user A.
2. On any story card, the reaction row shows **▲ 0  0  ▼ 0** between the setting/campaign meta line and (if owner) the Edit/Delete buttons.
3. Click ▲ → button highlights green, count becomes ▲ 1, score chip changes to **+1** (green).
4. Click ▲ again → retracts. Counts back to ▲ 0 / 0.
5. Click ▼ → highlights red, ▼ 1, score **-1** (rose).
6. Click ▲ while ▼ active → flips: ▼ 0, ▲ 1, score +1.
7. **DB sanity:** `SELECT count(*) FROM war_story_reactions WHERE user_id = '<your id>';` should match the active votes you can count visually.
8. **Cross-user:** as user B, vote ▲ on the same story. As user A refresh — the ▲ count shows 2 (yours + B's).
9. **Author can vote on own story:** confirmed (matches Forums B convention).

## 2. Reactions on LFG

Same flow as §1 against `/campfire/lfg`. Reactions row appears next to the existing "I'm Interested" / Edit / Delete / Share / Replies cluster.

## 3. Reactions on Forums B (persisted for the first time)

1. Visit `/campfire?tab=forums2` (preview tab).
2. The vertical vote rail on each card now reads ▲ / score / ▼ from `forum_thread_reactions` instead of in-memory state.
3. Click ▲ → highlight green, score increments. Refresh page — vote PERSISTS (was the whole point).
4. Header tagline now reads "Votes persist across refreshes" (was "local-only").
5. Note: the deterministic `seed_score` pseudo-baseline is gone; pre-vote scores are 0. This is intentional — the preview now mirrors what production would look like with real engagement.

## 4. Comment threading on War Stories

1. Each story card has a new **💬 N replies ▾** button alongside the reactions / Edit / Delete buttons.
2. Click → inline panel expands below the card showing replies + a textarea composer.
3. Empty state: "No replies yet — be the first."
4. Type a reply, click "Post reply" → reply appears at the bottom of the list with `<your username> (you) · timestamp`. Body renders via `renderRichText` (timestamp tokens + URLs auto-format).
5. The card's reply count badge ticks +1 immediately.
6. Click "💬 1 reply ▴" → panel collapses.
7. Click another story's button → switches focus (only one panel open at a time).
8. **Delete own reply:** click `×` on your own reply → confirm → row disappears, parent count ticks -1.
9. **DB sanity (trigger):** `SELECT reply_count, latest_reply_at FROM war_stories WHERE id = '<id>';` — reply_count matches visible count, latest_reply_at = newest reply's created_at (or null after the last is deleted).
10. **Cross-user:** as user B, post a reply on user A's story. As user A refresh → see B's reply with no `(you)` label.

## 5. Comment threading on LFG

Same flow as §4 against `/campfire/lfg`. The 💬 button sits at the end of the existing action-button row (after Reactions / I'm Interested / Edit / Delete / Share). Replies render below the action row but above the author-only "Interested" roster.

## 6. Full-text search — Forums

1. Top of `/campfire/forums` now has a **🔍 Search** input + button + (when active) Clear.
2. Type a keyword that appears in a thread's title — submit. The thread list replaces with up to 50 hits matching that keyword via the new `search_tsv` GIN index.
3. While search is active, the input border highlights teal AND the "Load older threads" pagination button is hidden.
4. Click **Clear** → returns to the standard paginated feed.
5. Empty results → "No threads in this category" empty state still shows (same as if the filter eliminated everything).
6. **DB sanity:** `EXPLAIN ANALYZE SELECT * FROM forum_threads WHERE search_tsv @@ plainto_tsquery('english', 'foo') ORDER BY latest_reply_at DESC LIMIT 50;` — plan should hit `idx_forum_threads_fts`.

## 7. FTS — War Stories

Same flow as §6 against `/campfire/war-stories`. Search box sits between the migration-banner area and the Setting filter chip strip.

## 8. FTS — LFG

Same flow as §6 against `/campfire/lfg`. Search box sits just above the Setting filter chip strip.

## 9. Campaign invitations — sender flow

**Setup:** sign in as user A who GMs at least one campaign. Have user B post a "Player seeking game" LFG ad. As user A, click "I'm Interested"... actually no — invitations only flow via the existing roster on user A's OWN GM-seeking-players posts. Better setup: post your own LFG, have user B click Interested, then invite them.

1. As user A, post an LFG ad (kind=GM seeking players) — confirm + post.
2. As user B (other browser), click "I'm Interested" on user A's post.
3. Back as user A, the post's Interested roster now shows user B with `💬 Message` + `🎟 Invite` buttons.
4. Click `🎟 Invite` → dropdown appears with user A's GM'd campaigns. Pick one.
5. Button flashes `✓ Invite Sent`.
6. **DB sanity:** `SELECT status, sender_user_id, recipient_user_id FROM campaign_invitations ORDER BY created_at DESC LIMIT 1;` — pending row keyed to user B.
7. **Old DM behavior is GONE.** Confirm by checking /messages — no auto-DM with the join link was sent (this is the explicit Phase 4E change).
8. **Duplicate guard:** click `🎟 Invite` for the same campaign + same user again → the second insert fails with `23505` and the alert says "You already have a pending invite to this player on this campaign." UI flash still fires (treat as success).

## 10. Campaign invitations — recipient flow

1. As user B, the bell shows a new notification: `<UserA>` invited you to join `"<Campaign Name>"`.
2. The body has username (teal bold) + campaign name (orange) inline.
3. The notification card has inline **✓ Accept** + **✗ Decline** buttons (mirrors the existing community_encounter / community_link / community_migration shape).
4. **Accept flow:** click ✓ Accept → buttons disable briefly → "✓ Responded" confirmation appears → page navigates to `/stories/<campaign-id>`. Confirm user B is now in `campaign_members` for that campaign.
5. As user A, the bell shows a new `campaign_invitation_response` notification: `<UserB>` **ACCEPTED** your invitation to `"<Campaign Name>"` (status word green/uppercase). Clicking the row navigates to `/stories/<campaign-id>`.
6. **Decline flow:** repeat from a fresh invitation; click ✗ Decline → status flips to declined, no campaign_members insert, sender gets a `campaign_invitation_response` with status word in rose/uppercase.

## 11. Campaign invitations — edge cases

1. **Recipient is already a member.** Send an invite to a user who's already in the campaign. Accept → trigger's `INSERT … ON unique_violation` swallows the conflict; status still flips to accepted; no second campaign_members row. Sender gets the response notification. User B navigates to the campaign as expected.
2. **Sender is no longer the GM.** RLS `ci_insert_gm` requires `campaigns.gm_user_id = auth.uid()` at insert time. Transfer GM role on a campaign, then attempt to invite from LFG as the previous GM → insert is rejected at the API. (Edge case; manual repro only.)
3. **Cancellation by sender.** Today there's no UI affordance to cancel a pending invite. The `ci_delete_sender` policy + `cancelled` status enum value are in place for a future "Withdraw invitation" button — out of scope for this sprint.

## 12. Sanity / regression

- **Forums replies (existing) unchanged.** `/campfire/forums/[id]` reply UX still works exactly as before.
- **Pagination (4E partial) still works.** "Load older …" buttons appear when search is NOT active.
- **Setting filter (4A) still works.** Click DZ chip — list filters; search bar still works on the filtered set if you submit while a chip is active... actually, search BYPASSES the chip filter (fetches by `search_tsv` only). Document this as expected behavior — search is a global override; clear search to return to filtered view.
- **Pre-existing font-size guardrail offenders** (TradeNegotiationModal:217, CampaignCommunity:2415) remain — predate Phase 4E.

---

## Open follow-ups (NOT in this sprint)

- **Reactions on replies.** Today only top-level threads / stories / posts get reactions. Replies don't. Reasonable to add a smaller version of `ReactionButtons` to each reply card if engagement signals matter at that level. ~half day.
- **Search ranking by `ts_rank`.** Today FTS results are ordered by `latest_reply_at` / `updated_at`. A proper relevance order would use `ts_rank(search_tsv, query)` — but Supabase JS client's `.textSearch` doesn't expose rank scoring directly; needs an RPC or a `select '... rank'` raw expression. Future polish.
- **"Withdraw invitation" UI.** The `ci_delete_sender` policy is in place for it; just need a list-of-pending-invites surface on the sender side + a button. ~1-2 hours.
- **Reply realtime.** The inline panels re-fetch on the parent's `load()` calls but don't auto-update if a third party posts a reply while the panel is open. Add a Supabase realtime subscription per panel mount.
- **Notification realtime for invitations.** The bell already has a global notifications realtime subscription, so this should "just work" — verify in §10 that user B sees the bell increment without needing to refresh.

---

## Rollback

```sql
-- Triggers + functions
DROP TRIGGER IF EXISTS on_campaign_invitation_response ON campaign_invitations;
DROP TRIGGER IF EXISTS on_campaign_invitation_insert ON campaign_invitations;
DROP FUNCTION IF EXISTS handle_campaign_invitation_response();
DROP FUNCTION IF EXISTS notify_campaign_invitation();
DROP TRIGGER IF EXISTS lfg_post_replies_after_delete ON lfg_post_replies;
DROP TRIGGER IF EXISTS lfg_post_replies_after_insert ON lfg_post_replies;
DROP TRIGGER IF EXISTS war_story_replies_after_delete ON war_story_replies;
DROP TRIGGER IF EXISTS war_story_replies_after_insert ON war_story_replies;
DROP TRIGGER IF EXISTS lfg_post_replies_touch ON lfg_post_replies;
DROP TRIGGER IF EXISTS war_story_replies_touch ON war_story_replies;
DROP FUNCTION IF EXISTS lfg_post_replies_after_delete();
DROP FUNCTION IF EXISTS lfg_post_replies_after_insert();
DROP FUNCTION IF EXISTS war_story_replies_after_delete();
DROP FUNCTION IF EXISTS war_story_replies_after_insert();
DROP FUNCTION IF EXISTS campfire_touch_updated_at();

-- Tables
DROP TABLE IF EXISTS campaign_invitations;
DROP TABLE IF EXISTS lfg_post_replies;
DROP TABLE IF EXISTS war_story_replies;
DROP TABLE IF EXISTS lfg_post_reactions;
DROP TABLE IF EXISTS war_story_reactions;
DROP TABLE IF EXISTS forum_thread_reactions;

-- Reply count columns (parent tables)
ALTER TABLE lfg_posts DROP COLUMN IF EXISTS reply_count, DROP COLUMN IF EXISTS latest_reply_at;
ALTER TABLE war_stories DROP COLUMN IF EXISTS reply_count, DROP COLUMN IF EXISTS latest_reply_at;

-- FTS columns + indexes
DROP INDEX IF EXISTS idx_lfg_posts_fts;
DROP INDEX IF EXISTS idx_war_stories_fts;
DROP INDEX IF EXISTS idx_forum_threads_fts;
ALTER TABLE lfg_posts DROP COLUMN IF EXISTS search_tsv;
ALTER TABLE war_stories DROP COLUMN IF EXISTS search_tsv;
ALTER TABLE forum_threads DROP COLUMN IF EXISTS search_tsv;

NOTIFY pgrst, 'reload schema';
```

UI changes are git-revertable.
