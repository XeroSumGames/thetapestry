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

## Open follow-ups (NOT in 4A scope)

These came up while building 4A — leaving them flagged for Xero to decide if/when:

1. **Forum-thread campaign scope.** The locked design says default scope on new posts = campaign-private. War Stories supports it (via existing `campaign_id`). LFG doesn't need it (cross-campaign by nature). **Forums has no `campaign_id` column**, so campaign-private forum threads aren't possible today. The Forums composer ships with Setting/Global only — no Campaign option. Adding `campaign_id` is a one-line ALTER + composer pill + reader chip; do it as Phase 4A.5 if Xero wants campaign-private discussion threads.

2. **Backfill of old LFG freetext setting rows.** Pre-Phase-4A LFG posts have `setting` values like "Distemper", "Homebrew", "Chased". These don't match any slug, so they only show in the All filter. A backfill could map known values ("Distemper" → null treat-as-Global, "Chased" → chased slug, etc.) — but small-N and the user says they have ~0 of these in prod realistically. Skip unless it bites.

3. **Pre-existing font-size guardrail offenders.** `node scripts/check-font-sizes.mjs` flags two existing issues:
   - `components/TradeNegotiationModal.tsx:217` — `fontSize: '11px'` (auto-fixable)
   - `components/CampaignCommunity.tsx:2200` — `fontSize: '13px'` + `color: '#3a3a3a'` (manual fix to `#cce0f5`)
   Both predate Phase 4A. Not blocking; one-line fixes if Xero wants me to do a sweep.

---

## Rollback (if shit hits the fan)

The migration is purely additive — no column removals, no constraint adds, no data writes. To roll back:
```sql
DROP INDEX IF EXISTS idx_forum_threads_setting;
DROP INDEX IF EXISTS idx_war_stories_setting;
DROP INDEX IF EXISTS idx_lfg_posts_setting;
ALTER TABLE forum_threads DROP COLUMN IF EXISTS setting;
ALTER TABLE war_stories  DROP COLUMN IF EXISTS setting;
NOTIFY pgrst, 'reload schema';
```
Note this does NOT drop `lfg_posts.setting` (that column predates Phase 4A; it lived as freetext).

The UI changes are git-revertable — `git revert <commit>` undoes the compose / reader edits cleanly.
