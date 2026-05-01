# Phase 4A — Per-setting feed layer testplan

Verifies the `setting` discriminator landed correctly across all three Campfire surfaces (forums, war stories, LFG), the compose UX writes the right value per scope, and the reader chips + hub dropdown filter as expected.

---

## 0. Prerequisites — apply the migration

**Before any UI test:** run `sql/campfire-setting-discriminator.sql` in Supabase SQL editor against the prod DB.

The migration adds:
- `forum_threads.setting` (text NULL) + `idx_forum_threads_setting`
- `war_stories.setting` (text NULL) + `idx_war_stories_setting`
- `idx_lfg_posts_setting` (column already existed; this is just the index)
- `NOTIFY pgrst, 'reload schema'` so the JS client sees the new column

Confirm in Supabase Studio → Tables that the three indexes exist. If you already had `lfg_posts.setting` rows with free-text values ("Distemper", "Homebrew", etc.) — leave them. Phase 4A doesn't backfill; old freetext rows will only show under the "All" chip.

---

## 1. Forums — compose flow

1. Navigate to `/campfire/forums`.
2. Click `+ New Thread`.
3. Verify the composer now has a **Where to post?** section beneath the Category pills with two pills: **🏷 Setting** (default-selected, accent teal) and **🌐 Global**.
4. With Setting selected, confirm the dropdown below shows: District Zero, Kings Crossroads, then alphabetical (Chased, Empty, Minnie & The Magnificent Mongrels, The Arena, The Rock). `custom` should NOT appear in the list.
5. Pick **Kings Crossroads**, write a title + body, click **Post Thread**.
6. After redirect to the thread detail page, navigate back to `/campfire/forums` and confirm the new thread shows a **Kings Crossroads** badge in the row meta line (orange-tinted pill).
7. Repeat with **Global** scope: confirm the dropdown is replaced by an italic helper line ("Cross-setting — no setting tag. Visible everywhere."). Posted thread should show NO setting badge.
8. **Edit case (visual only — Phase 4A doesn't add an Edit button to forum threads, but the data is round-trip safe):** confirm via Supabase Studio that the new rows have `setting = 'kings_crossroads_mall'` and `setting = NULL` respectively.

## 2. Forums — reader filter chips

1. On `/campfire/forums`, confirm two chip strips render now:
   - **Top strip:** All · District Zero · Kings Crossroads · Global (with per-chip count badges).
   - **Bottom strip:** All · Lore · Rules · Session Recaps · General (existing).
2. Click the **Kings Crossroads** chip → only threads tagged with that setting appear. The category counts on the bottom strip update to reflect the filtered subset.
3. Click **Global** → only threads with `setting IS NULL` appear (any pre-Phase-4A threads will be here, plus any new global threads).
4. Click **All** → everything reappears.
5. Click a category chip (e.g. Lore) WHILE setting filter is on Kings Crossroads → only Kings Crossroads + Lore threads show. Confirm both filter axes apply.

## 3. War Stories — compose flow

1. Navigate to `/campfire/war-stories`. (If the migration banner shows, the SQL hasn't been applied — go back to step 0.)
2. Click `+ New Story`.
3. Verify the composer's **Where to post?** section has three pills: **👥 Campaign** (default-selected if you have any campaigns), **🏷 Setting**, **🌐 Global**.
   - If you don't have any campaigns, the Campaign pill should be visibly disabled (40% opacity) with a tooltip "You aren't a member of any campaign yet."
   - The default falls to **Setting** in that case.
4. With **Campaign** selected, confirm the campaign dropdown appears below; auto-selected to the first campaign in your list. Save a story → row should have `campaign_id = <picked>` and `setting = NULL`. The story card shows the campaign name pill (orange) and NO setting badge.
5. Switch to **Setting** scope, pick District Zero, save → row should have `campaign_id = NULL` and `setting = 'district_zero'`. The card shows a teal **District Zero** badge in the meta line and NO campaign pill.
6. Switch to **Global**, save → both NULL. Card shows neither badge.
7. **Edit a story:** click Edit on one of your saved stories. Confirm the composer reopens with the correct scope pre-selected (Campaign/Setting/Global) and the matching dropdown value populated. Switching scopes should null out the unselected column on save (e.g. switching a campaign-scoped story to global should clear its campaign_id).

## 4. War Stories — reader filter chips

1. On `/campfire/war-stories`, confirm a single chip strip renders: All · District Zero · Kings Crossroads · Global.
2. Click each chip and confirm filtering works as in §2 (chip counts also accurate).
3. Click **All** to reset.

## 5. LFG — compose flow

1. Navigate to `/campfire/lfg`.
2. Click `+ New Post`.
3. The old freetext **Setting** input is gone. The new **Where to post?** radio + dropdown takes its place. Two pills: **🏷 Setting** (default), **🌐 Global**.
4. With Setting → District Zero, fill out a post (title, body, optional schedule), click Post.
5. Refresh the list — the post should show a teal **District Zero** badge in its tag row (formerly where the freetext setting label rendered).
6. Edit the same post → confirm the scope is pre-selected to Setting and the dropdown is on District Zero. Switch to Global, save → badge disappears on the card.
7. **Old free-text rows (if any):** if your LFG history has rows with non-slug `setting` values like "Homebrew" or "Distemper", editing one should snap the scope to Global (since the value isn't a registered slug) and `setting = 'district_zero'` is staged in the dropdown but won't be written unless you flip back to Setting. Confirm this round-trip is non-destructive — clicking Cancel leaves the original freetext row intact.

## 6. LFG — reader filter chips

1. On `/campfire/lfg`, confirm two filter rows render:
   - **Top strip (new):** setting chips (All · DZ · Kings Crossroads · Global).
   - **Bottom strip (existing):** kind chips (All · GMs · Players).
2. Test combined filtering: Setting=DZ + Kind=GMs → only DZ-tagged GM-seeking-players posts show.
3. Confirm freetext-setting rows (if any in your data) only appear under the **All** chip.

## 7. /campfire hub — setting context dropdown

1. Navigate to `/campfire?tab=forums`.
2. A new **Setting context:** selector should appear above the tab bar, with options: All settings, District Zero, Kings Crossroads, Global only.
3. Pick **District Zero** → URL becomes `/campfire?tab=forums&setting=district_zero`. The Forums chip strip below should auto-select the District Zero chip.
4. Switch to the **War Stories** tab without changing the dropdown — its chip strip should also be on District Zero.
5. Switch to the **LFG** tab — same, its setting chip should be on District Zero.
6. Switch to **Messages** or **Timestamps** — the setting dropdown should disappear (it doesn't apply to those tabs).
7. Click the **Clear** button next to the dropdown → URL drops the `?setting=` param, all surface chips reset to All.
8. Click a per-surface chip (e.g. Forums → Kings Crossroads) — this filters that surface but **doesn't** update the hub dropdown (the hub is the writer, surfaces are readers; this is intentional so per-surface tweaks don't fight the hub context).

## 8. Direct deep-link sanity

1. Visit `/campfire/forums?setting=district_zero` directly (not via the hub) → the Forums page renders with the District Zero chip pre-selected.
2. Visit `/campfire/forums?setting=global` → the Global chip is pre-selected (rows with `setting IS NULL`).
3. Visit `/campfire/forums?setting=foobar_unknown_slug` → no rows match (which is correct), and the page doesn't error. Clicking **All** clears the filter.

## 9. Database sanity (post-flow)

In Supabase SQL editor, run:
```sql
SELECT setting, count(*) FROM forum_threads GROUP BY setting;
SELECT setting, count(*) FROM war_stories GROUP BY setting;
SELECT setting, count(*) FROM lfg_posts GROUP BY setting;
```
Confirm:
- `forum_threads`: only `NULL` (older rows) + the slugs you posted under.
- `war_stories`: only `NULL` + the slugs you posted under.
- `lfg_posts`: NULL + the new slugs + any pre-existing freetext values you had before the migration.

`EXPLAIN ANALYZE SELECT * FROM forum_threads WHERE setting = 'district_zero' ORDER BY created_at DESC LIMIT 50;` should show the new `idx_forum_threads_setting` index in the plan.

---

## Phase 4A.5 — Forum-thread campaign scope (added in same session)

The 4A composer for Forums shipped with Setting/Global only because `forum_threads` had no `campaign_id`. Phase 4A.5 closes that gap so all three Phase 4 surfaces (Forums, War Stories, LFG) can use the same compose flow, and so Phase 4B's moderation gate can use `scope === 'campaign'` as the auto-approve path.

### Migration

Apply `sql/forum-threads-campaign-id.sql` to prod. Adds `campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL` plus `idx_forum_threads_campaign`. Mirrors the war_stories shape exactly. Purely additive.

### 10. Forums — Campaign scope flow

1. Navigate to `/campfire/forums`, click `+ New Thread`.
2. The **Where to post?** radio should now have THREE pills: **👥 Campaign** (default-selected when you have any campaigns), **🏷 Setting**, **🌐 Global**.
3. With Campaign selected, a campaign dropdown appears below auto-populated to your most recent campaign. Pick a campaign, write a title + body, post.
4. After redirect, navigate back to `/campfire/forums` and confirm the new thread shows a **👥 [Campaign Name]** orange pill in the row meta line, parallel to the setting badge.
5. If you have NO campaigns: the Campaign pill should be visibly disabled (40% opacity, tooltip "You aren’t a member of any campaign yet.") and the default scope falls to Setting.
6. **Scope switching:** flip from Campaign → Setting on the radio mid-compose. The campaign dropdown disappears, setting dropdown appears. Save → row should have `setting='district_zero'` and `campaign_id=NULL`.
7. **DB sanity:** in Supabase, `SELECT campaign_id, setting, count(*) FROM forum_threads GROUP BY campaign_id, setting;` → confirm only one of the two columns is non-null per row.

### 11. Forums — Campaign tag display

1. On `/campfire/forums`, threads with `campaign_id` set should render the orange `👥 [Campaign Name]` pill in the row meta strip (between any setting badge and the author name).
2. Threads without a campaign tag don't show the pill (parity with War Stories behavior).
3. The pill is informational — it does NOT affect the chip-strip filter (filter only filters by setting). This is intentional for now; campaign-as-filter would need an "Only my campaigns" chip and is out of 4A.5 scope.

### Visibility note (NOT yet implemented)

The campaign_id tag is purely informational in 4A.5. **RLS still says "anyone signed in can read."** Same as War Stories today. So a forum thread tagged with someone else's campaign IS technically visible to you — the tag just labels it. If Xero wants true Vegas-rules privacy ("only my campaign sees campaign-tagged threads"), that's a separate RLS pass that should also apply to War Stories for consistency. Flagged here so it's not forgotten when Phase 4B lands.

---

## Phase 4B — Promotion + moderation flow (added in same session)

Adds the world_communities-style moderation pattern (`moderation_status` / `approved_by` / `approved_at` / `moderator_notes`) to all three Campfire feed tables, tightens SELECT RLS so pending/rejected rows are only visible to author + thrivers, and extends `/moderate` with three new queue sections.

### Migration

Apply `sql/campfire-moderation.sql` to prod. Adds the 4 columns to each of `forum_threads` / `war_stories` / `lfg_posts` plus index on (moderation_status, created_at). The default for the new column is `'approved'` so all existing rows stay public — no content goes dark on apply.

The migration also REPLACES the SELECT policies on all three tables with the three-tier read pattern (approved-public, own, thriver). The original `ft_select` / `ws_select` / `lfg_select` policies are dropped and replaced. Plus a new `*_update_thriver` policy on each table so the moderation page can flip status.

### 12. Compose gating per surface

**Setup:** sign in as a non-Thriver user. Have at least one campaign you GM or are a member of.

#### 12a. Forums — Campaign scope = instant publish
1. /campfire/forums → New Thread → Campaign scope (default), pick a campaign.
2. Title + body, Post.
3. After redirect, navigate back to /campfire/forums. Thread should appear immediately with NO "⏳ Pending review" pill — it's instantly approved.
4. DB sanity: `SELECT moderation_status FROM forum_threads ORDER BY created_at DESC LIMIT 1;` → `approved`.

#### 12b. Forums — Setting scope = pending
1. New Thread → Setting scope, pick District Zero.
2. Post → after redirect, the thread row shows the `⏳ Pending review` pill in the meta strip.
3. The author banner at the top of /campfire/forums says "⏳ You have 1 thread awaiting Thriver review."
4. Sign in as a different non-Thriver user (in another browser/incognito). Navigate to /campfire/forums. The pending thread should NOT be visible — RLS hides it.
5. DB sanity: row has `moderation_status='pending'`, `approved_by=NULL`, `approved_at=NULL`.

#### 12c. Forums — Global scope = pending
Same as 12b but with Global scope. Row tagged neither setting nor campaign.

#### 12d. War Stories — same three flows
Repeat 12a-c on /campfire/war-stories. Same expected behavior:
- Campaign-scoped → instant publish, no pending pill.
- Setting-scoped → pending, banner shows "⏳ You have 1 story awaiting Thriver review."
- Global-scoped → pending.
- Re-edit a campaign-scoped story to setting scope → it should re-queue (moderation_status flips back to pending).

#### 12e. LFG — every post = pending
1. /campfire/lfg → New Post (any kind, any setting/global).
2. Post → row shows `⏳ Pending review`. Banner appears.
3. Other users (non-Thriver) don't see the pending row.
4. DB sanity: every new lfg_posts insert has `moderation_status='pending'`.

### 13. Author can see own pending/rejected

1. As the author, /campfire/forums (or war-stories or lfg) → your own pending posts ARE visible to you, with the pending pill.
2. Sign out and sign in as a different non-Thriver user → those same pending posts are NOT visible.
3. RLS hat-check via Supabase SQL: `SELECT count(*) FROM forum_threads WHERE moderation_status = 'pending';` returns total when run as Thriver, returns only your own when run as non-Thriver author, returns 0 when run as a third party.

### 14. /moderate — three new queue sections

**Required:** sign in as a Thriver.

1. /moderate → tab strip should now have 8 tabs total: Users · Rumor Queue · NPCs · 🌐 Communities · 📦 Modules · **💬 Forums** · **🎭 War Stories** · **🎲 LFG**.
2. Pending counts on the new three tabs should reflect actual pending rows. If you posted setting/global content above, those tabs light up green with a count badge.
3. Click 💬 Forums → see your pending threads. Each row shows title, author, category, setting/campaign tags, body excerpt, plus Approve / Reject / Delete buttons.
4. **Approve flow:** click Approve on a pending row → row drops from the queue. Sign in as a different user, navigate to /campfire/forums → the thread is now visible publicly with no pending pill. DB: `moderation_status='approved'`, `approved_by=<thriver id>`, `approved_at=<now>`.
5. **Reject flow:** click Reject on another pending row. Sign back in as the author → the row still shows in their own feed but with `✗ Rejected` pill instead of pending. The banner now says "✗ 1 thread not approved." (Other users still don't see rejected rows.)
6. **Filter pills (pending/approved/rejected):** clicking each updates the queue. Approved shows previously-approved-by-thriver content. Rejected shows previously-rejected. Each has a Revoke button (approved → rejected) or Approve button (rejected → approved) for reversibility.
7. **Delete:** the Delete button on any row in any filter permanently removes the post (RLS allows author OR thriver to delete; this is the thriver path). Confirm modal first.
8. Repeat steps 3-7 on the **🎭 War Stories** and **🎲 LFG** tabs. Each has the same shape.

### 15. Edit-flow re-queue check

1. As an author, edit one of your previously-APPROVED war stories (campaign scope → setting scope).
2. Save → the row should re-queue: `moderation_status='pending'`, `approved_by=NULL`, `approved_at=NULL`. Pending pill reappears.
3. Reverse: edit a setting-scoped story back to campaign scope → it instant-approves. Note: this does NOT auto-restore the original `approved_by` (thriver review identity is fresh per state).

### 16. Migration rollback

Drop the new columns + indexes + policies safely with:
```sql
DROP POLICY IF EXISTS "ft_update_thriver" ON forum_threads;
DROP POLICY IF EXISTS "ft_select_approved" ON forum_threads;
DROP POLICY IF EXISTS "ft_select_own" ON forum_threads;
DROP POLICY IF EXISTS "ft_select_thriver" ON forum_threads;
-- Restore original open SELECT
CREATE POLICY "ft_select" ON forum_threads FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "ws_update_thriver" ON war_stories;
DROP POLICY IF EXISTS "ws_select_approved" ON war_stories;
DROP POLICY IF EXISTS "ws_select_own" ON war_stories;
DROP POLICY IF EXISTS "ws_select_thriver" ON war_stories;
CREATE POLICY "ws_select" ON war_stories FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "lfg_update_thriver" ON lfg_posts;
DROP POLICY IF EXISTS "lfg_select_approved" ON lfg_posts;
DROP POLICY IF EXISTS "lfg_select_own" ON lfg_posts;
DROP POLICY IF EXISTS "lfg_select_thriver" ON lfg_posts;
CREATE POLICY "lfg_select" ON lfg_posts FOR SELECT USING (auth.uid() IS NOT NULL);

DROP INDEX IF EXISTS idx_forum_threads_moderation;
DROP INDEX IF EXISTS idx_war_stories_moderation;
DROP INDEX IF EXISTS idx_lfg_posts_moderation;

ALTER TABLE forum_threads DROP COLUMN IF EXISTS moderation_status, DROP COLUMN IF EXISTS approved_by, DROP COLUMN IF EXISTS approved_at, DROP COLUMN IF EXISTS moderator_notes;
ALTER TABLE war_stories  DROP COLUMN IF EXISTS moderation_status, DROP COLUMN IF EXISTS approved_by, DROP COLUMN IF EXISTS approved_at, DROP COLUMN IF EXISTS moderator_notes;
ALTER TABLE lfg_posts    DROP COLUMN IF EXISTS moderation_status, DROP COLUMN IF EXISTS approved_by, DROP COLUMN IF EXISTS approved_at, DROP COLUMN IF EXISTS moderator_notes;
NOTIFY pgrst, 'reload schema';
```

---

## Open follow-ups (NOT in 4A / 4A.5 scope)

These came up while building 4A — leaving them flagged for Xero to decide if/when:

1. **Tighten RLS on campaign-tagged threads + War Stories.** Per above — the campaign_id column is just a tag today, not a privacy gate. If "campaign-private" should mean truly private, both `forum_threads` and `war_stories` need RLS that filters by campaign membership when campaign_id is set.

2. **Backfill of old LFG freetext setting rows.** Pre-Phase-4A LFG posts have `setting` values like "Distemper", "Homebrew", "Chased". These don't match any slug, so they only show in the All filter. A backfill could map known values ("Distemper" → null treat-as-Global, "Chased" → chased slug, etc.) — but small-N and the user says they have ~0 of these in prod realistically. Skip unless it bites.

3. **Pre-existing font-size guardrail offenders.** `node scripts/check-font-sizes.mjs` flags two existing issues:
   - `components/TradeNegotiationModal.tsx:217` — `fontSize: '11px'` (auto-fixable)
   - `components/CampaignCommunity.tsx:2200` — `fontSize: '13px'` + `color: '#3a3a3a'` (manual fix to `#cce0f5`)
   Both predate Phase 4A. Not blocking; one-line fixes if Xero wants me to do a sweep.

---

## Rollback (if shit hits the fan)

The migrations are purely additive — no column removals, no constraint adds, no data writes. To roll back 4A + 4A.5:
```sql
-- 4A.5
DROP INDEX IF EXISTS idx_forum_threads_campaign;
ALTER TABLE forum_threads DROP COLUMN IF EXISTS campaign_id;
-- 4A
DROP INDEX IF EXISTS idx_forum_threads_setting;
DROP INDEX IF EXISTS idx_war_stories_setting;
DROP INDEX IF EXISTS idx_lfg_posts_setting;
ALTER TABLE forum_threads DROP COLUMN IF EXISTS setting;
ALTER TABLE war_stories  DROP COLUMN IF EXISTS setting;
NOTIFY pgrst, 'reload schema';
```
Note this does NOT drop `lfg_posts.setting` (that column predates Phase 4A; it lived as freetext).

The UI changes are git-revertable — `git revert <commit>` undoes the compose / reader edits cleanly.
