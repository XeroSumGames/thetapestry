# Testplan — /moderate user-row redesign + Track activity dossier

**Shipped 2026-05-08.**

Two changes:
1. **`/moderate` user-row layout** — was mushed (one line, dates and 6 buttons cramped together). Now: top row = username + email + role chip + joined date + last login; bottom row = all buttons left-aligned including new **Track** button.
2. **`/moderate/users/[userId]/activity`** (new page) — cross-surface dossier. Characters, campaigns owned/joined, recent rolls, forum threads, forum replies, war stories, LFG posts, bug reports, map pins.

DB changes:
- New SECURITY DEFINER RPCs `admin_users_with_login()` and `admin_user_with_login(uuid)` — join `profiles` + `auth.users.last_sign_in_at`. Thriver-gated. Migration: `sql/admin-users-with-login.sql`. Applied to live.

---

## 1. User row visual

1. Sign in as a Thriver, navigate to `/moderate?section=users`.
2. **Each user card now has two rows:**
   - **Top:** username (bold, larger) + email + role chip + suspended chip (if any) on the left; **Joined date** + **Last login date** on the right.
   - **Bottom:** all action buttons in a single row, left-aligned: `Make Survivor`/`Make Thriver`, `Message`, `Characters`, `Track`, `Suspend…` (or `Unsuspend`), `Delete`.
3. Confirm at standard desktop width (1440px+) that nothing overlaps; chips stay on top row, buttons on bottom row.
4. Resize narrower; both rows wrap gracefully (top via `flexWrap:'wrap'`, bottom via `flexWrap:'wrap'`).
5. Confirm "Last login" shows a localized timestamp for users who have signed in, and `never` for users who haven't.

## 2. Track button → activity page

1. Click the **Track** button on any user row.
2. Page should load at `/moderate/users/<userId>/activity` showing:
   - Header — username, role chip, suspended chip (if any), email, **Joined**, **Last login**.
   - Sections (in order, each with count): Characters · Campaigns owned (GM) · Campaigns joined (player) · Recent rolls · Forum threads · Forum replies · War stories · LFG posts · Bug reports · Map pins.
   - Each section shows up to 10 (or 20 for rolls) most recent items. Empty sections render `None.`.
3. **Characters section** has a `View all →` link in the header → `/moderate/users/<userId>/characters` (existing page).
4. **Campaigns** rows are clickable links → `/stories/<id>`.
5. **Forum threads / replies** rows are clickable links → `/campfire/forums/<thread_id>`.
6. **Recent rolls** row format: `<character_name> · <label>` then secondary `<outcome> · <total> · <date>`.
7. **Bug reports** row format: first 80 chars of description, then `<status> · <page_url> · <date>`.
8. Click `Back` button → returns to `/moderate?section=users`.

## 3. RLS / auth gates

1. Sign in as a Survivor (non-Thriver), open `/moderate/users/<any-uuid>/activity` in the URL bar directly.
2. Page should redirect to `/dashboard` (page-level role check). Even if a Survivor bypasses the redirect, the RPC raises `forbidden: thriver role required` and counts/lists come back empty.
3. Confirm: `npx supabase db query --linked` running `select admin_users_with_login()` as a Survivor (via setting auth.uid() in a session) errors with `forbidden`.

## 4. Edge cases

1. **User with no activity** — every section renders `None.`.
2. **User who never signed in** — header shows `Last login never`.
3. **User with a permanently-suspended account** — `Suspended (perm)` chip on both `/moderate` row and activity-page header.
4. **User deleted while activity page open** — RPC returns 0 rows, page redirects back to `/moderate?section=users` with an alert.
5. **High-volume user** (many rolls): `Recent rolls` count shows total, list shows 20 most recent with `showing 20 most recent` subtitle.

## 5. Smoke

1. Hard-refresh `/moderate?section=users`. All users load via the new RPC. Tab counter unchanged.
2. Watch the network panel — `loadUsers` should call `POST .../rest/v1/rpc/admin_users_with_login` (not the old `from('profiles').select('*')`).
3. Open activity page for the first user in the list. All 10 sections render in under 2 seconds (parallel fetch).
