# Test Plan — Phase E Sprints 1, 2, 3 + 3-polish + 4a

**Scope:** The Tapestry persistent world layer for Communities — publish to Distemperverse, Thriver moderation, world-map overlay, sidebar browse folder, GM-to-GM Contact Handshake.

**Ship date:** 2026-04-23.

**Pre-req migrations** (idempotent — safe to re-run):
1. `sql/world-communities.sql` — Sprint 1 mirror table + RLS + back-FK on communities.world_community_id.
2. `sql/community-encounters.sql` — Sprint 4a encounters table + RLS + notify trigger + adds `notifications.metadata` jsonb column.

Earlier Phase A–D migrations should already be in place: `sql/community-members-add-morale-75-reason.sql`, `sql/community-members-add-current-task.sql`, `sql/community-members-add-assignment-pc.sql`.

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

## Known deferrals (call out in playtest if asked)

- **Accept/decline UI on encounters** — DB ready, no front-end surface yet. Use Supabase Studio to manipulate `community_encounters.status` for now.
- **Trade / alliance / feud arcs** — Sprint 4 next-up. Will draw colored Leaflet polylines between two published communities.
- **Schism mechanic** — large communities split into two. Sprint 4.
- **Migration on dissolution** — survivors offered to nearby published communities when a community collapses. Sprint 4.
- **Per-community Campfire feed** — depends on Phase 6 Campfire which isn't built.
- **Community subscription** — players follow communities across campaigns. Phase 6.
- **Campaign-creation wizard "Start around an existing community"** — listed in Phase E spec; will land alongside the Modules system (Phase 5).

---

## Quick smoke test (~5 min if you've already published a few communities)

1. As Thriver, `/moderate` → 🌐 Communities → approve any pending.
2. `/map` → see the green/blue/amber dot at the right size.
3. Click → popup looks right.
4. Click "🤝 My PCs encountered this" (must be GM of another campaign).
5. Pick campaign, type narrative, send.
6. Switch accounts → bell shows the new notification.

If all five steps work, Sprints 1–4a are healthy.
