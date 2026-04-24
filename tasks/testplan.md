# Test Plan — Phase E Sprints 1 through 4e

**Scope:** The Tapestry persistent world layer for Communities — publish to Distemperverse, Thriver moderation, world-map overlay, sidebar browse folder, GM-to-GM Contact Handshake, Trade/Alliance/Feud arcs, inline notification actions, Schism mechanic, Migration on dissolution.

**Ship date:** Sprints 1–4a on 2026-04-23; Sprints 4b–4e on 2026-04-23/24.

**Pre-req migrations** (all idempotent — safe to re-run):
1. `sql/world-communities.sql` — Sprint 1 mirror table + RLS + back-FK on communities.world_community_id.
2. `sql/community-encounters.sql` — Sprint 4a encounters table + RLS + notify trigger + adds `notifications.metadata` jsonb column.
3. `sql/world-community-links.sql` — Sprint 4b links table + RLS + propose/response notify triggers.
4. `sql/community-members-add-schism-reason.sql` — Sprint 4d widens `left_reason` CHECK to include `'schism'`.
5. `sql/community-migrations.sql` — Sprint 4e migrations table + RLS + offer/response notify triggers.

Earlier Phase A–D migrations should already be in place: `sql/community-members-add-morale-75-reason.sql`, `sql/community-members-add-current-task.sql`, `sql/community-members-add-assignment-pc.sql`.

Quick verify all Phase E migrations are applied — paste into SQL editor:
```sql
SELECT 'world_communities'             AS tbl, to_regclass('public.world_communities')::text             AS ok UNION ALL
SELECT 'community_encounters',              to_regclass('public.community_encounters')::text                  UNION ALL
SELECT 'world_community_links',             to_regclass('public.world_community_links')::text                 UNION ALL
SELECT 'community_migrations',              to_regclass('public.community_migrations')::text                  UNION ALL
SELECT 'left_reason has schism',            CASE WHEN EXISTS(SELECT 1 FROM pg_constraint WHERE conname='community_members_left_reason_check' AND pg_get_constraintdef(oid) LIKE '%schism%') THEN 'yes' ELSE 'NO' END;
```
All five rows should come back non-null / `'yes'`.

---

## Account setup for full coverage

The handshake flow requires **two GM accounts**. If you only have one (Xero), simulate by creating two campaigns under your account and swapping a "second GM" by changing `campaigns.gm_user_id` directly via Supabase Studio for the duration of the test, then swap back.

Recommended setup:
- **Account A** — your usual Xero account (Thriver). GMs at least one campaign with a Community ≥13 members and a Homestead pin set.
- **Account B** — second test account. GMs a different campaign. Plain Survivor.
- (Optional) **Player C** — a non-GM account in Account B's campaign to test player-facing visibility.

---

## SPRINT 1 — Publish to Distemperverse

### Setup
1. Sign in as Account A.
2. Open the table page for a campaign with a community at 13+ members. If your community has no Homestead pin, set one via the create/edit flow OR drop a campaign pin and link it to the community.

### Happy path — first publish

1. Open Community ▾ → Status. Expand the community body.
2. Look for a new purple-bordered strip labeled **"🌐 The Tapestry"**. It should read "Publish this community to the Distemperverse to make it visible across other campaigns." with a purple **"🌐 Publish to Distemperverse"** button on the right.
3. Click the button. A modal opens titled "🌐 Publish — \<community name\>".
4. Verify the **Preview** card shows:
   - Community name
   - Description (if set)
   - **Size:** matches your member count → band per the threshold table:
     - <13 Small · 13–32 Band · 33–99 Settlement · 100–499 Enclave · 500+ City
   - **Status:** one of Thriving / Holding / Struggling / Dying / Dissolved (mapped from your community state)
   - **Homestead:** pin name in green if set, "none set — will publish unlocated" in amber if not
5. Type a **Faction / flavor label** like "Mongrels" or leave blank.
6. Click **🌐 Publish**. The modal closes; the strip flips to:
   - Background turns purple-tinged.
   - "Published as \<Size Band\> · ⏳ Pending Moderation · \<faction\>"
   - Buttons change to "Update Public Info" + "Unpublish".
7. Hard-reload the table page. State persists.

### DB verification

In Supabase Studio:
- `world_communities` has one new row matching your community.
- `moderation_status` = 'pending'.
- `published_by` = Account A's user id.
- `homestead_lat` / `homestead_lng` populated if pin had coords.
- Source `communities.world_visibility` = 'published', `world_community_id` points to the new row, `published_at` set.

### Update flow

1. Click "Update Public Info" on the strip. Modal title now reads "🌐 Update — \<name\>".
2. Change faction label and hit "Update Public Info".
3. The strip should now show the new faction label without re-entering the moderation queue.
4. DB: world_communities.faction_label and last_public_update_at updated; moderation_status unchanged.

### Unpublish flow

1. Click "Unpublish" on the strip. Confirm.
2. Strip reverts to the pre-publish state (Publish button purple).
3. DB: `world_communities` row is gone, `communities.world_visibility` = 'private', `world_community_id` = NULL, `published_at` = NULL.

### Edge cases

- [ ] Publish with no Homestead pin → preview shows amber "unlocated" warning. Submit anyway → world_communities row inserts with NULL coords.
- [ ] Re-publish after unpublish → goes through moderation again (status = pending, moderator resets).
- [ ] Republish 2x quickly → no duplicate world_communities rows (UNIQUE constraint on source_community_id).
- [ ] Try as non-GM player — no Publish strip appears at all (gated `isGM && isCommunity && status !== 'dissolved'`).
- [ ] Try on a dissolved community — strip hidden.

---

## SPRINT 2 — Thriver Moderation Queue

### Setup
1. Account A still signed in (must be Thriver; check `profiles.role` in DB).
2. From Sprint 1 you should have at least one pending world_communities row.

### Happy path — approve

1. Navigate to `/moderate`.
2. Tab row should now show four tabs: **Users · Rumor Queue · NPCs · 🌐 Communities**. Click **🌐 Communities**.
3. Filter row: **pending / approved / rejected**. Default = pending.
4. Verify the queue card shows:
   - Header: "🌐 \<name\>"
   - Attribution: "Published by \<username\> on \<date\> · from \<source campaign name\>"
   - Three chips on the right: Size Band (blue) / Status (green) / Faction Label (amber, if set)
   - Description block (if set)
   - Homestead row: lat/lng with a "View on map" link (or amber "unlocated" warning)
   - Last update timestamp
5. Click **Approve**. The card disappears from the pending list.
6. Switch to the **approved** filter. The card reappears with green left border.
7. DB: `moderation_status` = 'approved', `approved_by` = your user id, `approved_at` set.

### Reject + revoke

1. Find another pending community (or republish one to create one). On the pending tab click **Reject**. Card disappears.
2. Switch to **rejected** filter. Card has red left border. Action button now says **Approve** (lets you reverse a rejection).
3. Switch back to **approved** filter. Action button there says **Revoke** (flips back to rejected).
4. Cycle approved → revoke → rejected → approve → approved. State should match each step in DB.

### Delete

1. Click **Delete** on any card. Confirm.
2. Card disappears. DB: row hard-deleted from world_communities.
3. The source community's world_visibility / world_community_id should NOT be auto-cleared — that's by design (the GM can republish; the source row is decoupled). Workaround if it's stale: have the GM unpublish manually.

### View on map

- Click "View on map" on a card with coords → opens OpenStreetMap in a new tab at the Homestead. Sanity check.

### RLS sanity

- Sign out of Thriver. Sign in as a non-Thriver (Account B). Navigate to `/moderate`. The Communities tab should still be visible (page doesn't gate per-tab) but the load should return 0 rows for non-Thriver since the RLS on world_communities only allows Thriver to read pending/rejected. **Bug to watch for:** if you see a non-Thriver seeing pending rows, the RLS is broken.

---

## SPRINT 3 — World Map Overlay

### Setup
1. Make sure you have at least 2–3 **approved** world_communities with non-null Homestead coords. Approve from Sprint 2 first.

### Happy path — markers

1. Navigate to `/map`.
2. Verify approved communities render as **colored circles** (no emoji, distinct from pin emoji-icons).
3. Size by band:
   - Small ~ 20 px
   - Band ~ 24 px
   - Settlement ~ 28 px
   - Enclave ~ 32 px
   - City ~ 36 px
4. Color by status:
   - Thriving → green
   - Holding → pale blue
   - Struggling → amber
   - Dying → pale red
   - Dissolved → grey
5. Markers cluster with map_pins at low zoom; fan out at high zoom (Leaflet markercluster).

### Popup

1. Click a community marker. Popup shows:
   - "🌐 \<community name\>" header
   - Description
   - Three chips: Size Band / Status / Faction Label (last is conditional)
   - Attribution: "From **\<source campaign name\>**"
   - Last update date
2. Popup HTML escapes user content — try a community whose description has `<script>alert(1)</script>` in it (set via DB or edit). Should render as literal text, not execute.

### Visibility filter

1. (If you've already shipped Sprint 3 polish) The sidebar should show a **🌐 Published Communities** folder above the regular pin categories. See Sprint 3-polish below.
2. Toggle the eye icon. Markers disappear from the map. Toggle back on. They reappear.
3. Refresh the page. The hidden state persists (localStorage `tapestry_hidden_folders` includes `world_community`).

### Edge cases

- [ ] Pending or rejected world_communities should NOT render on the map (only approved).
- [ ] Communities with NULL coords are absent from the map (filtered in the query).
- [ ] Multiple communities at the exact same coords cluster together correctly.
- [ ] Sign out → reload `/map`. Approved communities should still render (read policy allows public).

---

## SPRINT 3 POLISH — Sidebar Folder

### Happy path

1. Open `/map`. In the sidebar (toggle "Pins ☰" if collapsed), verify the **🌐 Published Communities** folder sits above the normal category folders. Header in purple, count badge matches the marker count.
2. Click the folder header to expand. Each row shows:
   - Status-colored dot
   - Community name
   - Size Band chip on the right
   - Hover tooltip: name · band · status · faction · source campaign
3. Click a community row in the sidebar. The map should `flyTo` the Homestead and **auto-open the popup** for that marker after the fly animation completes (~1.3s delay).
4. Click the **eye icon** on the folder header. The map markers disappear (folder dim, count still visible). The list inside the folder still browseable.
5. Refresh — folder open/closed state and hidden state persist (localStorage).

### Search interaction

1. Type a partial community name in the pin search box. The folder should filter to matching communities only.
2. Try matching by source campaign name or faction label. Both fields are searchable per the filter logic.
3. Clear search. Folder count restores.

### Edge case

- [ ] No approved communities → folder doesn't render at all (skipped by `wcFolderHasContent`).

---

## SPRINT 4a — GM-to-GM Contact Handshake

### Setup
- Account A: signed in, at least one published+approved community visible on `/map`.
- Account B: a second account that GMs a *different* campaign. (For Xero-only testing, fake by editing `campaigns.gm_user_id` to your alt account or by making a fresh test campaign on Account A and using a "different campaign" rule; the encounter UI gates on GM-of-non-source-campaign.)

### Happy path — encounter

1. Sign in as Account B.
2. Navigate to `/map`. Click an approved community marker (one published from Account A, NOT one from any of B's own campaigns).
3. The popup now shows a **purple "🤝 My PCs encountered this"** button at the bottom. Click it.
4. Encounter modal opens titled "🤝 Encounter — \<community name\>".
5. Verify:
   - "Encountering campaign" dropdown lists Account B's campaigns. Source campaign should NOT be in the list.
   - "What happened (optional)" is a textarea.
6. Pick a campaign, type "We traded medical supplies for ammunition while sheltering from a Distemper surge.", click **🤝 Send Encounter**.
7. Alert: "Encounter sent. The source community's GM will see it in their notifications."
8. DB: `community_encounters` row inserted with status='pending', narrative stored, encountering_user_id = Account B's id.

### Notification (recipient side)

1. Switch to **Account A** (the source community's GM). Hard-refresh.
2. Open the notification bell (top right). New unread notification:
   - Title: "Cross-Campaign Encounter"
   - Body: colorized line — "**\<Account B username\>**'s campaign **"\<B campaign name\>"** encountered your community **"\<your community name\>"**"
   - Italicized narrative line below: *"We traded medical supplies for ammunition…"*
3. Click the notification. Marks as read; navigates to `/communities/\<id\>`.

### Self-encounter guard

1. From Account A, click your own published community on the map.
2. Click "🤝 My PCs encountered this".
3. Alert: "To flag an encounter you need to GM a campaign other than the one this community came from. Either create a campaign, or this community is one of your own."
4. Modal does NOT open.

### Duplicate-pending guard

1. From Account B, encounter the same Account A community a second time without it being accepted/declined.
2. Submit. Alert: "You already have a pending encounter request for this community. Wait for the source GM to respond, or check Notifications."
3. DB unchanged — no second row inserted (UNIQUE constraint on world_community + encountering_campaign + status='pending').

### Accept / decline (manual for now — UI surface deferred)

1. The accept/decline UI lives in DB only for the moment (Sprint 4 follow-up will add a surface). Manually:
   - In Supabase Studio, find the encounter row, set `status='accepted'` and `responded_at = now()`.
   - Confirm RLS lets the source GM update (try via the API as Account A — should succeed).
2. After acceptance, Account B can encounter the same community again — a new row goes in with status='pending' (no UNIQUE collision since the prior row is no longer pending).

### Sign-in gating

- [ ] Sign out → reload `/map`. Click a community marker. The popup should NOT show the "🤝 My PCs encountered this" button (gated on `currentUserId`).
- [ ] Sign in as a non-GM Player C. Click an approved community marker. Button shows. Click → alert says "you need to GM a campaign other than the source." (gated on `myGmCampaigns.filter(c.id !== source).length > 0`).

### RLS sanity

- [ ] Try via direct API as a non-source non-encountering user: SELECT from community_encounters returns 0 rows.
- [ ] Try INSERT with `encountering_user_id` ≠ auth.uid(): rejected.
- [ ] Try UPDATE status as someone who's neither source GM nor encountering GM nor Thriver: rejected.

---

## Cross-cutting checks

- [ ] **TypeScript** — `npx tsc --noEmit` exits 0 (verified at each commit).
- [ ] **Font-size guardrail** — `node scripts/check-font-sizes.mjs` reports OK (verified at each commit).
- [ ] **Vercel build** — main branch builds cleanly. If a build fails after a push, the SQL migrations probably haven't been applied yet on the live DB; queries return errors that surface at runtime, not build time, but RLS misconfiguration can.
- [ ] **Mobile sanity** — open `/map` on a phone. Markers render, sidebar works, encounter button on popups is tappable.

---

## SPRINT 4b — Trade / Alliance / Feud arcs

### Setup
- At least **two approved** world communities on the map, owned by **different GM accounts** (Account A's community and Account B's). Homesteads must have coords so the polyline has endpoints.
- Sign in as Account B (the proposer).

### Happy path — propose a trade link

1. `/map`. Click the marker for **Account A's** community.
2. Popup shows (below encounter button) a grey **"🔗 Propose link"** button. Click it.
3. Modal opens titled "🔗 Propose Link — \<Account A community name\>".
4. Verify:
   - "From my community" dropdown lists Account B's **published** (approved) communities. Communities B hasn't published shouldn't be listed.
   - Three big link-type cards: **💱 Trade** (green), **🤝 Alliance** (blue), **⚔️ Feud** (red). Default = trade.
   - Narrative textarea below the cards.
5. Pick a source community, leave type = Trade, type "Weekly trade caravans run between us — clean water for medicine.", hit **"Propose Trade Link"**.
6. Modal closes. No polyline appears on the map yet (status='pending').
7. DB: `world_community_links` has one new row — status='pending', link_type='trade', proposed_by_user_id=B's id, proposed_from_community_id=B's community, narrative set.

### Notification (recipient side) — accept

1. Switch to **Account A**. Hard-refresh.
2. Open the bell. New notification:
   - Title: **"💱 Trade route proposed"**
   - Body: "\<B username\> proposes a trade between "\<B community\>" and your "\<A community\>": \<narrative\>"
   - Two purple inline buttons below the body: **✓ Accept** and **✗ Decline** (Sprint 4c surface).
3. Click **✓ Accept**.
4. Row disappears or shows "Accepted" and buttons vanish (per Sprint 4c spec — `actionedIds` hides them).
5. DB: `world_community_links.status` flipped to 'active', `responded_at` set.

### Polyline renders

1. Hard-refresh `/map` as either account.
2. A **green solid polyline** now connects the two community dots.
3. Hover the polyline. Tooltip shows "**TRADE**" in green + the narrative line.

### Link type visuals

1. Propose and accept two more links between other community pairs — one **alliance** and one **feud**.
2. On `/map`:
   - Alliance → **blue solid** line, tooltip header blue.
   - Feud → **red dashed** line (6,6 dash), tooltip header red.

### Notification (proposer side) — response

1. After Account A accepts (step above), switch to **Account B**. Bell.
2. New notification: "✓ Link accepted" — body "\<A community\> active your trade proposal with \<B community\>". Clicking opens `/communities/\<B source community id\>`.

### Decline path

1. Propose a fresh link (Account B → Account A). Switch to A. Click **✗ Decline** inline.
2. DB: `status='declined'`, `responded_at` set.
3. Map still shows nothing — declined links don't render.
4. Account B gets a "✗ Link declined" notification.

### Edge cases

- [ ] Propose without picking a source community → button disabled (source dropdown starts empty if B has no published communities; in that case an alert fires: "You need at least one published community to propose a link").
- [ ] Propose the exact same pair + type twice while still pending → UNIQUE constraint rejects. Expect "link already pending" or a DB error alert.
- [ ] Click "🔗 Propose link" on your own community's popup → source dropdown omits it; effectively blocked (can't propose self-link; endpoints must be distinct per CHECK constraint).
- [ ] Thriver bypass: sign in as Thriver → can see pending links in other people's pairs via a direct `SELECT * FROM world_community_links` — RLS read policy explicitly allows Thriver.
- [ ] Revoke: either GM can delete the row (SQL Editor for now — no UI yet). Polyline disappears on next page load.

---

## SPRINT 4c — Inline Accept/Decline in NotificationBell

**Covers three notification types:** `community_encounter` (Sprint 4a), `community_link_proposal` (Sprint 4b), `community_migration` (Sprint 4e). The happy paths for each type are covered in the matching sprint section above — this section is for the **shared bell behavior**.

### Happy path — all three types

1. Prime the bell with one pending encounter + one pending link proposal + one pending migration targeted at the same account.
2. Open the bell. Each of the three notifications renders with:
   - Body text (type-specific)
   - Two inline buttons below: **✓ Accept** (green) and **✗ Decline** (red)
3. Click **✓ Accept** on each in turn. Buttons disappear; a small "✓ Accepted" or "Actioned" chip takes their place (handled by `actionedIds` state).
4. DB for each:
   - encounter → `community_encounters.status = 'accepted'`, `responded_at` set.
   - link → `world_community_links.status = 'active'`, `responded_at` set.
   - migration → `community_migrations.status = 'accepted'`, `responded_at` set.
5. For each, the proposer/offerer side gets a "✓ accepted" / "✗ declined" response notification (Sprint 4b/4e response triggers). These secondary notifications are **pure-info** — no Accept/Decline buttons.

### Error handling

- [ ] Kill the network, click **✓ Accept** → should alert the user with the error message instead of silently hiding the buttons. Actual behavior: confirm by disabling Wi-Fi briefly and testing.
- [ ] Double-click **✓ Accept** rapidly → `actionedIds` check prevents a second write; only one status flip.

### RLS / security

- [ ] Forge the notification recipient: sign in as a user who isn't the source-GM, paste the notification id into the bell fetch manually (devtools) → accepting via the SQL path the bell uses will be rejected by RLS on the underlying table.
- [ ] Inline buttons only render for the three action-bearing types — `community_link_response`, `community_migration_response`, `community_encounter_response`, and everything else (community_milestone, @-mention, etc.) should have no inline buttons.

---

## SPRINT 4d — Schism

### Setup
- An active community (not dissolved) with **≥ 14 members** (so at least a 13/1 split is possible). If you don't have one, recruit/add until total ≥ 14. Sign in as the GM.

### Happy path — split

1. `/stories/\<id\>/table` (or wherever your CampaignCommunity panel surfaces). Expand the community body.
2. Near the bottom of the body (above "Delete Community"), a purple-outlined **"⛓ Schism"** button appears. Gated on `isGM && status !== 'dissolved' && total >= 14`.
3. Click it. Modal opens titled something like "⛓ Schism — \<community\>".
4. Verify:
   - "Breakaway name" textbox prefilled with `"\<original\> Breakaway"`.
   - Optional description textarea (placeholder "Splintered from …" if blank).
   - Optional homestead pin dropdown (campaign's pins).
   - Member picker listing every current (non-leader maybe? — confirm) member with checkboxes.
5. Pick 2–4 members to leave with the breakaway. Hit **"⛓ Confirm Schism"**.
6. Modal closes. Page reloads member lists. Expect:
   - Original community's total is reduced by the breakaway count; those members show `left_reason='schism'` in `community_members`.
   - A **new** community row exists in `communities` with the breakaway name + description + homestead_pin_id.
   - Fresh `community_members` rows exist for the breakaway — one per picked member, same NPC refs, fresh ids, `left_at IS NULL`.
7. Sidebar "My Communities" now lists the breakaway as a separate row.

### Edge cases

- [ ] Pick zero members → "⛓ Confirm Schism" disabled.
- [ ] Leave the name field blank → "⛓ Confirm Schism" disabled with alert "Give the breakaway community a name."
- [ ] Try on a 13-member community — "⛓ Schism" button hidden entirely (gated on `total >= 14`).
- [ ] Try on a dissolved community — button hidden.
- [ ] Sign in as a player (non-GM) → button hidden.
- [ ] Partial failure (member removal succeeds, new-community insert fails) → alert: "Schism partial: new community created + members removed but the new roster insert failed: \<msg\>. You may need to add the breakaway members manually." Verify the alert actually fires by temporarily revoking INSERT RLS on community_members via SQL (and remember to reapply).
- [ ] Breakaway with <13 members stays **Group** status (not Community). Grow past 13 → Community milestone notification fires normally (existing trigger from Phase B).

### Historical integrity

- [ ] Original community's roster history still shows the schism-leavers with `left_reason='schism'` — you can reconstruct who left for the breakaway. Query `SELECT npc_id, left_at, left_reason FROM community_members WHERE community_id=<original> AND left_reason='schism'`.

---

## SPRINT 4e — Migration on dissolution

### Setup
- A **dissolved** community (status='dissolved') with at least one NPC survivor (`left_reason='dissolved'`). Easiest way: find one that died from three consecutive Morale failures, or manually UPDATE an existing active community to status='dissolved' + bulk-update its members to left_reason='dissolved' for testing.
- At least one **other** approved world_community exists somewhere (as the migration target).

### Happy path — offer survivors

1. Open the dissolved community in the CampaignCommunity panel. Expand.
2. A purple-bordered **"📤 Survivor Migration"** strip sits inside the body, showing:
   - Headline "📤 Survivor Migration"
   - Line: "N survivor(s) can be offered to other communities in the Distemperverse."
   - **"📤 Offer Survivors"** button.
3. Click it. Modal opens.
4. Verify:
   - Survivor checklist — each NPC with a name, their relative recruitment type (Cohort, Apprentice, etc.) visible.
   - Target picker — dropdown of all approved world_communities (should omit this dissolved community's own world row if it was published).
   - Narrative textarea.
5. Check 2 survivors, pick a target, type "These three wandered 90 miles before your scouts found them — looks rough.", hit **"Send Migration Offer(s)"**.
6. Alert: "Sent 2 migration offers. The receiving GM will see them in their notifications."
7. DB: Two new rows in `community_migrations`, status='pending', target_world_community_id set, source_member_id + source_npc_id + npc_name snapshotted, narrative stored.

### Notification (receiver side) — accept

1. Switch to the **target community's GM** account. Bell.
2. Two unread notifications, one per offered survivor:
   - Title: **"📤 Migration request"**
   - Body: "Survivor "\<NPC name\>" from "\<source community\>" seeks shelter in your "\<target community\>": \<narrative\>"
   - Inline **✓ Accept** / **✗ Decline** buttons (Sprint 4c).
3. Click **✓ Accept** on one of them.
4. DB: `community_migrations.status='accepted'` for that row.

### Notification (offerer side) — response

1. Switch back to the **offering GM**. Bell.
2. New notification: "✓ Migrant accepted" with body "\<target community\> accepted "\<NPC name\>" from your "\<source community\>"".

### Edge cases

- [ ] Dissolved community with zero NPC survivors → strip shows the alternate line "No NPC survivors recorded. Migration only applies to NPCs scattered by the dissolution." No **Offer Survivors** button.
- [ ] Zero approved world_communities to target → survivors list shows but an amber "No published communities exist yet to offer them to." line replaces the button.
- [ ] Click **Offer Survivors** without picking any checkbox → alert: "Pick at least one survivor to offer."
- [ ] Don't pick a target → alert: "Pick a target community for the survivors."
- [ ] Withdraw: source GM can manually DELETE the migration row (no UI yet). Target notification stays but is orphaned (known deferral).
- [ ] Non-GM on dissolved community → Migration strip hidden (gated on `isGM`).

### Known gap (deferred)

- **Auto-copy on acceptance is NOT implemented.** Accepting a migration flips status='accepted' and fires the response notification but does **not** copy the NPC row into the target campaign, and does **not** insert a community_members row in the target community. The target GM must manually use their existing add-member flow to bring the NPC in. This is flagged in `tasks/todo.md` for a follow-up Postgres trigger on `community_migrations` UPDATE pending→accepted.

---

## Known deferrals (call out in playtest if asked)

- **Migration auto-copy on acceptance** — DB row flips status but doesn't copy the NPC into the target campaign. Manual add-member required. Fix: Postgres trigger on community_migrations UPDATE pending→accepted.
- **Per-community Campfire feed** — depends on Phase 6 Campfire which isn't built.
- **Community subscription** — players follow communities across campaigns. Phase 6.
- **Campaign-creation wizard "Start around an existing community"** — listed in Phase E spec; will land alongside the Modules system (Phase 5).
- **Link withdraw UI** — either GM can DELETE a `world_community_links` row via SQL, but no front-end button yet.
- **Migration withdraw UI** — same story for `community_migrations` rows.

---

## Quick smoke test (~10 min covering all of Phase E)

1. As Thriver, `/moderate` → 🌐 Communities → approve any pending.
2. `/map` → see the green/blue/amber dot at the right size.
3. Click a foreign community → popup looks right.
4. Click **"🤝 My PCs encountered this"** (must be GM of another campaign) → pick campaign, narrative, send.
5. Click **"🔗 Propose link"** on the same popup → pick source + Trade + narrative → propose.
6. Switch to the source GM → bell shows encounter + link notifications with inline ✓/✗ buttons. Accept both.
7. Hard-refresh `/map` → green polyline connects the two communities.
8. In the CampaignCommunity panel for a ≥14-member community, click **⛓ Schism** → pick 2 members → confirm. See the new breakaway community in the sidebar.
9. Dissolve a community (or pick one already dissolved) → click **📤 Offer Survivors** → pick 1 + target + narrative → send.
10. Switch accounts → bell shows migration request; accept inline.

If all ten steps work, Sprints 1–4e are healthy.
