# Handoff -> HP: rewire email + invite_code readers, then PF revokes the columns

Last 2 items of the 2026-06-23 security batch. Both are PII/access leaks where a logged-in user can `GET /rest/v1/<table>?select=<col>` and harvest the whole column. The DB seams are shipped (definer RPCs, live). Your job: switch the readers to the RPCs / auth session. Then ping PF to apply `sql/sec-pii-column-revokes-2026-06-23-APPLY-AFTER-REWIRE.sql` (revoke table SELECT + regrant all columns except the sensitive one). Order matters - revoke AFTER your rewire ships, or those readers hit "permission denied for column".

## A. profiles.email (PII / GDPR) - 3 readers
Seam: `supabase.rpc('get_profile_email', { p_user_id })` (returns email only for own row or to a Thriver). Own-email readers can also just use the auth session.
1. **`app/account/page.tsx:94`** - `select('id, username, email, role, avatar_url')`: drop `email` from the select; show the user's email from `getCachedAuth()`/`supabase.auth.getUser()` (it's the auth source of truth) instead.
2. **`components/BugReportButton.tsx:39`** - `select('username, email')`: drop `email`; use the auth session's email.
3. **`app/moderate/users/[userId]/characters/page.tsx:38`** - `select('username, email, created_at')` (Thriver viewing a target): drop `email` from the select; fetch it via `rpc('get_profile_email', { p_user_id: userId })`.
(There are no `profiles.select('*')` calls - confirmed - so nothing else breaks.)

## B. campaigns.invite_code (anyone can harvest all codes -> join any game) - 6 readers
Seams: `rpc('find_campaign_by_invite_code', { p_code })` for JOIN (returns id/name/setting/description/cover_image_url/gm_user_id for an exact code, no enumeration); `rpc('get_campaign_invite_code', { p_campaign_id })` for the GM/member SHARE-link display.
1. **`app/join/[code]/page.tsx:28`** - `from('campaigns').select('*').eq('invite_code', code)`: replace with `rpc('find_campaign_by_invite_code', { p_code: code }).single()`. (Also kills the `select('*')` that would otherwise break on revoke.)
2. **`app/stories/join/page.tsx:31`** - same swap (it uppercases; the RPC trims+uppers too).
3. **`app/stories/[id]/community/page.tsx:81`**, **`sessions/page.tsx:75`**, **`snapshots/page.tsx:47`**, **`components/StoryActionBar.tsx:97`** - these read `invite_code` by campaign id to DISPLAY the share link (member/GM context). Drop `invite_code` from those selects; fetch it via `rpc('get_campaign_invite_code', { p_campaign_id: id })` where the link is actually rendered.

## Then ping PF
Once A+B ship and you've confirmed in-app that account email shows, bug report works, moderation shows the user's email, joining by code works, and the GM still sees the invite link - PF applies the column-revoke SQL and re-verifies via impersonation. Reversible (re-GRANT the column) if anything surfaces.

**Why PF didn't just do it:** the revoke is one SQL file, but it's only safe to land in the same window as your reader rewire - 9 app files across account/bug-report/moderate/join/community/sessions/snapshots/StoryActionBar are your lane, and need an in-app eyeball the CLI can't give.
