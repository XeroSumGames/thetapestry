# Phase 4C — Setting Hubs testplan

Verifies the new `/settings/[setting]` dynamic route renders correctly for District Zero + Kings Crossroads, the sidebar links land, the canon-pin map deep-links work, and the "Run a Campaign in [Setting]" CTA pre-fills the new-story flow.

**No SQL migration required.** Phase 4C is a UX-only addition on top of 4A's `setting` discriminator + 4B's moderation gate. As long as both prior testplans are green, this one only needs UI verification.

---

## 1. Hub renders for both featured settings

1. Sign in (any non-Thriver is fine — guests get bounced to /login).
2. Visit `/settings/district_zero` directly. Confirm the page renders with:
   - Header: "The Distemperverse · Setting Hub" eyebrow, big "DISTRICT ZERO" title, italic tagline "East Tulsa, Oklahoma. The District holds.", blurb paragraph below.
   - Two CTA buttons: teal-bordered "Run a Campaign in District Zero" and a gray "🗺 Open on Map".
   - Three sections beneath: Canon Locations (count badge), Communities (count badge), Setting Feed.
3. Visit `/settings/kings_crossroads_mall`. Same shape, different accent (orange `#EF9F27`), tagline "Sussex County, Delaware. A mall complex on the edge of nowhere."
4. Visit `/settings/foobar_unknown`. Should render Next.js `not-found` (404), NOT a blank page or runtime error.

## 2. Canon Locations section

1. On `/settings/district_zero`, the **Canon Locations** section should show grouped lists by category (military · government · resource · etc.) with category-colored icons and counts.
2. Each pin row shows the title in uppercase + the optional `notes` body underneath in a muted color.
3. Click a pin row → navigates to `/map?flyTo=<lat>,<lng>&zoom=16`. The world map flies to that pin (zoom level = setting's `mapZoom + 2`).
4. Hover effect: pin row's border color animates from default `#2e2e2e` to the setting accent color.
5. On `/settings/kings_crossroads_mall`, confirm 8 pins render (the filtered subset from `CHASED_PINS` per `KINGS_CROSSROADS_MALL_PINS` in [lib/setting-pins.ts](lib/setting-pins.ts)).

## 3. Communities section

**Setup data:** publish at least one approved community sourced from a campaign tagged with each setting. (You can do this via existing campaign workflow → publish to Distemperverse → Thriver approves at /moderate.)

1. Communities sourced from a campaign with `setting='district_zero'` should render on `/settings/district_zero`. Each row shows the community name + size band + status + faction label pills.
2. Communities sourced from a campaign with a different setting should NOT appear here (filtered server-side via the two-step join).
3. If a community has homestead coords, the "🗺 View on map →" link appears. Click it → `/map?flyTo=<lat>,<lng>&zoom=16`.
4. Empty state: when there are no communities yet, the section shows a helpful empty-state card prompting "Run a campaign and publish your community to the Distemperverse."
5. Pending communities should NOT be visible (only `moderation_status='approved'` is fetched).

## 4. Setting Feed section

**Setup data:** post at least one approved Forums thread + War Story + LFG post tagged with each setting.

1. The Setting Feed section renders three side-by-side blocks (responsive grid; collapses to single column on narrow viewports): 💬 Forums (green), 🎭 War Stories (orange-bronze), 🎲 Looking for Group (teal).
2. Each block lists up to 5 most-recent approved posts tagged with this setting. Each row shows title (truncated to one line) + author + date.
3. Click "See all →" on the Forums block → routes to `/campfire?tab=forums&setting=district_zero`. Confirm the destination's setting context dropdown is pre-selected to District Zero AND the chip strip on the embedded forums surface follows.
4. Repeat for War Stories and LFG → routes to `/campfire?tab=war-stories&setting=district_zero` and `/campfire?tab=lfg&setting=district_zero` respectively.
5. Pending posts (yours or others') should NOT appear in the hub feed — only approved.
6. Empty block state: "Nothing posted yet."

## 5. "Run a Campaign in [Setting]" CTA

1. On `/settings/district_zero`, click the "Run a Campaign in District Zero" button.
2. Confirm you land on `/stories/new?setting=district_zero` and the **Setting** picker on that page is **pre-selected to District Zero**.
3. Repeat from `/settings/kings_crossroads_mall` → button should land on `/stories/new?setting=kings_crossroads_mall` with Kings Crossroads pre-selected.
4. **Edge case: invalid slug.** Visit `/stories/new?setting=foobar_unknown` directly. The setting picker should fall back to no preselection (empty); no runtime error.

## 6. Sidebar entries

1. Open the left sidebar (any logged-in page).
2. Beneath the "Rumors" link, two new indented entries appear:
   - `· District Zero` (teal accent)
   - `· Kings Crossroads` (orange accent)
3. Click each → navigates to the corresponding hub page.
4. The indent (left padding) makes them read as children of the top-level destinations rather than separate top-level entries.

## 7. Map fly-to deep-links

1. From `/settings/district_zero`, click the "🗺 Open on Map" header button → `/map?flyTo=36.0510,-95.7900&zoom=14`. Map should fly to the District center at zoom 14.
2. Click any pin row in the Canon Locations section → map flies to that pin's exact coords at zoom 16.
3. From a community card with coords, click "🗺 View on map →" → fly to that community's homestead at zoom 16.
4. Verify zoom is reasonable for each setting (Kings Crossroads uses zoom 16 base because it's a small mall complex; DZ uses 14 because the District spans more area).

## 8. Performance / loading state

1. Hard-refresh `/settings/district_zero` while throttling network (DevTools → Slow 3G).
2. Page should show a "Loading…" placeholder briefly, then the header renders, then sections fill in (communities + feed are async). The header (name/tagline/CTA) should not be blocked on the data loads.
3. No console errors during load.

## 9. RLS sanity

The hub queries are public-read on approved content only:
- `world_communities` filter: `moderation_status='approved'` + `source_campaign_id IN (...)` — should return only approved rows.
- `forum_threads` / `war_stories` / `lfg_posts` filters: `moderation_status='approved'` + `setting=<slug>`. RLS already gates this, but the explicit `eq` is a belt-and-braces filter.

Confirm by signing in as a non-author non-thriver user and visiting both hub pages — pending content from other authors must NOT leak through.

---

## Open follow-ups (NOT in 4C scope)

1. **World Event feed.** Phase 4D will surface auto-posts from per-community Morale outcomes / migrations / dissolutions on the hub. Today the Setting Feed only shows manual Forums/War Stories/LFG content.

2. **Other settings get hubs.** DZ + Kings Crossroads only per the locked design. Mongrels / Chased / Custom / Arena are deferred — they fall through to a `notFound()` if you visit `/settings/<their_slug>` directly. Adding a hub for any of them is one entry in `SETTING_META` (lib/setting-meta.ts) plus their existing pin set in lib/setting-pins.ts.

3. **Pagination / Filters / Sort.** The Setting Feed shows top-5 most-recent only. Phase 4E will add full pagination, FTS, reactions, etc. on the underlying surfaces.

4. **Map layer overlay.** A future polish would render the canon pins + published communities directly on the world map as a setting layer (toggle on/off). Today they only render as list rows on the hub with deep-link buttons.

---

## Rollback

Phase 4C is purely additive UI. To roll back:
- `git revert <commit>` on the Phase 4C commit.
- No DB changes; nothing to drop.

The two new files (`lib/setting-meta.ts` + `app/settings/[setting]/page.tsx`) are self-contained; the sidebar + /stories/new edits revert cleanly.
