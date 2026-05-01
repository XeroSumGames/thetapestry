# Phase 4E (partial) — Campfire polish wave testplan

Verifies the four bite-sized polish items shipped in this 4E sprint: rich-text rendering on War Stories + Handouts, LFG schedule filter, pagination on all three feeds, and LFG-interest notification UI.

**No SQL migration required** — all changes are UI / client-side. The `lfg_interest` notifications are already being inserted by the trigger from `sql/lfg-interests.sql` (shipped earlier); this just makes them render correctly in the bell.

---

## 1. Rich-text rendering on War Stories + Handouts

**Setup:** post a War Story or open a shared handout that contains a Discord-style timestamp token, e.g. `<t:1751760000:F>` (a UNIX timestamp + format char).

1. Navigate to /campfire/war-stories.
2. Stories whose body contains the token should render the formatted date inline (e.g. "Monday, July 5, 2026 at 9:00 AM" in a teal-tinted chip), NOT the raw `<t:…>` text.
3. URLs in the body should also auto-linkify (the renderer is called with `{ linkify: true }`).
4. Open a shared GM Note via the Handout popout (`/handout?id=<note-id>`) — same behavior; tokens render as time chips, URLs as clickable links.
5. Hover any time chip — tooltip shows the absolute formatted time.

**Format char reference:**
- `t` = short time
- `T` = long time
- `d` = short date
- `D` = long date
- `f` = short date+time (default)
- `F` = long date+time
- `R` = relative ("in 3 days", "2 hours ago")

## 2. LFG schedule filter

1. Navigate to /campfire/lfg.
2. The kind filter row (All / GMs / Players) now shares space with a new schedule input on the right: `Filter by schedule (e.g. Sundays, weekly)…`.
3. Type "sunday" — the visible posts narrow to those whose `schedule` column contains "sunday" (case-insensitive substring match).
4. Type "weekly" — narrows to weekly schedules.
5. Click the `×` button next to the input → clears the filter.
6. Combined with kind + setting filters: schedule filter applies on top of both. E.g. setting=DZ + kind=GMs + schedule="weekly" should AND all three.
7. Posts with `schedule = NULL` never match a non-empty filter (they show only with the filter cleared).

## 3. Pagination on Forums / War Stories / LFG

Each surface fetches 50 rows on initial load. A "Load older …" button appears at the bottom when more rows likely exist (i.e. the most recent fetch returned a full page).

### Forums
1. Navigate to /campfire/forums. Confirm exactly 50 threads (or fewer, if your DB has fewer total) render.
2. If 50+ threads exist: a "Load older threads" button shows below the list.
3. Click → next 50 append to the bottom; button stays if another full page is available, disappears if not.
4. Pinned + setting + category filters all interact with the loaded page — adding more pages just enlarges the pool, doesn't reset filters.

### War Stories
1. Same as Forums: 50 stories on initial load, "Load older stories" button when more exist.
2. Setting chip filter + freetext schedule filter (n/a here) interact with the loaded page.

### LFG
1. Same as Forums: 50 posts, "Load older posts" button.
2. Setting + kind + schedule filters all interact with the loaded page.

### Edge cases
- Surface with <50 rows total: button never renders (correct).
- Click Load → next fetch returns 0 rows: button disappears, list stays.
- Refresh the page mid-pagination: list resets to 50; subsequent clicks fetch fresh.

## 4. LFG-interest notifications

**Setup:** post an LFG ad as user A. Sign in as user B in another browser/incognito and click "I'm Interested" on user A's post.

1. As user A, watch the bell — a new notification with `type='lfg_interest'` arrives via realtime subscription.
2. The notification body renders with username highlighted (teal) + post title in light gray quotes: `<UserB> is interested in "<title>"`.
3. Click the notification → navigates to `/campfire/lfg#lfg-<post-id>`. The post card scrolls into view AND flashes a teal box-shadow highlight for ~1.6s (existing behavior from sql/lfg-interests.sql + lfg page).
4. The notification gets marked `read` after click (existing bell behavior).
5. Realtime: drop user B's interest (untoggle) — the notification stays in the bell (we don't auto-delete; user A can dismiss manually).
6. Multiple interests on the same post → multiple bell entries, one per interest event.

## 5. Sanity / regression

1. Forums thread detail (`/campfire/forums/[id]`) — unaffected by these changes; still renders as before.
2. /messages — already used renderRichText; double-check that's still working (it was untouched).
3. /campfire hub — tab routing still works; setting context dropdown still propagates.

---

## Open follow-ups (NOT in this 4E partial)

The remaining 4E items on the polish backlog — each is its own ship:

- [ ] **Reactions on War Stories + LFG.** Persist Forums B votes pattern, extend to the other surfaces. ~1 day.
- [ ] **Comment threading on War Stories + LFG.** Forums has it via `forum_replies`; the others are flat. New tables + nested rendering. ~1 day.
- [ ] **Full-text search across Forums / War Stories / LFG.** Postgres `tsvector` + GIN indexes per table + search bar on each surface. ~1 day.
- [ ] **Formal `campaign_invitations` accept/reject flow.** Replaces today's DM-with-link pattern. ~1 day.

---

## Rollback

UI changes are git-revertable. No DB migrations to undo.
