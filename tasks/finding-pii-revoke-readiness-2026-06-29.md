# Finding -> PF: PII reader rewire SHIPPED, with 2 things to know before the revoke

> **STATUS 2026-06-29: Xero in-app eyeball PASSED ("confirmed, all works") - email
> shows, bug report works, moderation shows the target's email, join-by-code works,
> share links render on My Stories / hub / table / community / sessions. PF is
> CLEARED to apply `sql/sec-pii-column-revokes-2026-06-23-APPLY-AFTER-REWIRE.sql`,
> with the one select('*') impersonation confirm in section 2 below.**

Commit: `391f01df` (on top of `528d2480`). All readers off the raw columns; tsc +
892 tests + arch/font/role gates green. Arch seam IMPROVED (.from 1030 -> 1028).

## 1. The handoff under-scoped invite_code by 4 readers (now all fixed)
The handoff listed 7 invite_code readers. A codebase-wide sweep found FOUR more
that display the code and would have rendered `/join/undefined` (or worse) after
the revoke - including the **core table page**:
- `app/stories/page.tsx` - the My Stories list shows the code as text + two Share
  buttons (GM list + player list). Now resolves codes via `get_campaign_invite_code`
  into a per-id map.
- `app/stories/[id]/page.tsx` - hub invite link/code panel + `copyInviteLink`.
  Now `inviteCode` state via RPC.
- `app/stories/[id]/table/page.tsx` - Share button + Observer Link (the play
  surface). Now `inviteCode` state via RPC; both gated on it being present.
- `app/stories/[id]/snapshots/page.tsx` - selected invite_code but never used it;
  just dropped from the select + type.

All other handoff readers done as specced (account/bug session-email, moderation
RPC, both join flows -> find_campaign_by_invite_code, community/sessions/
StoryActionBar -> get_campaign_invite_code, campfire LFG dropped entirely since
Phase 4E uses structured invitations).

## 2. select('*') on campaigns - confirm before you revoke
Three `campaigns.select('*')` reads remain and are NOT converted to explicit
columns: `app/stories/[id]/page.tsx:139`, `app/stories/[id]/table/page.tsx:1222`,
`lib/gm-kit.ts:60`. None of them now READ invite_code off the result (gm-kit
never did; the other two get the code via RPC).

They are safe **iff** PostgREST returns only the granted columns for `select=*`
(omitting the revoked invite_code) rather than erroring "permission denied for
column". Per PostgREST's column-privilege handling of `*`, this is the expected
behavior and the revoke should be safe - but it's the one thing your rolled-back
JWT impersonation can confirm that my static check can't.

**Recommended go/no-go:** in your impersonation pass, after applying the revoke,
load (a) the table page, (b) the My Stories list, (c) a story hub as a plain
member - if all three render (no column-permission error) and show their share
links, you're clear. If `select('*')` errors, ping back and I'll convert those
three to explicit column lists (use the exact regrant set from the revoke SQL)
in one quick commit - then you re-run.

profiles has no `select('*')` readers (confirmed), so the email revoke is
unconditionally safe once the 3 email readers ship (they have).

---

## RESULT 2026-06-29 (PF applied) - email DONE, invite_code BOUNCED BACK TO HP

**profiles.email revoke: APPLIED LIVE + verified.** `sql/sec-pii-revoke-profiles-email-2026-06-29.sql`.
Rolled-back JWT impersonation confirms: `SELECT email FROM profiles` -> permission
denied (leak closed); a real own-profile read of granted columns (id/username/role/
avatar_url) with claims -> returns the row (no breakage); `get_profile_email` RPC ->
returns the email (legit path intact). Re-verified no `profiles.select('*')` and no
embedded `profiles(*)` first, so the `*` problem below cannot bite profiles.

**campaigns.invite_code revoke: NOT applied - section 2's assumption was WRONG, routed
back to HP.** I applied the campaigns half, tested the real REST path, and it BROKE:
post-revoke `campaigns?select=*` returned `42501 permission denied for table campaigns`
(HTTP 401) and stayed broken for 10s+ (not reload lag). This Supabase PostgREST does
NOT omit an ungranted column from `select=*` - it errors. The authenticated role can
read granted columns by EXPLICIT name (impersonation of `SELECT id, name` returns a
row), so the fix is explicit column lists. I rolled back immediately (`GRANT SELECT ON
public.campaigns TO anon, authenticated` + reload); verified `select=*` -> 200 restored.
campaigns is back at baseline (functional, invite_code leak still open as it was all
session).

### HP: to land the invite_code half, convert these 3 `campaigns.select('*')` to explicit columns, then ping PF
- `app/stories/[id]/page.tsx:141`
- `app/stories/[id]/table/page.tsx:1227`
- `lib/gm-kit.ts:60`

Use the campaigns regrant set as the column list (everything EXCEPT invite_code):
`id, name, description, setting, gm_user_id, status, created_at, session_status,
session_count, session_started_at, map_style, map_center_lat, map_center_lng, vehicles,
last_accessed_at, clock, start_canon_day, cover_image_url`. (Verified 2026-06-29 that
this set == all campaigns columns minus invite_code, so `*` -> this list is lossless.)
None of the 3 read invite_code off the result anymore, so dropping it is safe. Once
those ship, PF applies the campaigns half of `sql/sec-pii-column-revokes-2026-06-23-
APPLY-AFTER-REWIRE.sql` (just the campaigns REVOKE+GRANT) and re-verifies the same way.

---

## HP DONE 2026-06-29 (`89ff1b84`) - campaigns select('*') converted, PF CLEARED to revoke

All `campaigns.select('*')` converted to an explicit column list via a shared
`CAMPAIGN_COLUMNS` const in `lib/data/campaigns.ts` (= the exact regrant set; a
comment there says it must mirror this SQL if a column is ever added).

**It was FIVE sites, not three.** A multi-line grep (`from('campaigns')` and
`.select('*')` on separate lines) found two MORE that PF's list missed - both in
`app/stories/page.tsx` (the My Stories GM list + player list). The original
single-line grep couldn't see them; they would have 401'd the My Stories page on
load post-revoke. All five now converted:
- `lib/gm-kit.ts:60`
- `app/stories/page.tsx` (gm list + player list)
- `app/stories/[id]/page.tsx:141`
- `app/stories/[id]/table/page.tsx:1227`

tsc + 892 tests + arch/font/role gates green. **PF: cleared to apply the
campaigns REVOKE+GRANT half.** When verifying, please load My Stories too (not
just the table page) since that's where the two extra `*` reads lived. On
success, close this out in active-lanes (Puffer row) + todo.md.

---

## POST-REVOKE GAP FOUND + FIXED 2026-07-01 (`854f8dc4`) - WRITE paths also return `*`

PF applied the campaigns revoke (`51d5f383`, "gate CLOSED"), but **Create Story
then 401'd `permission denied for table campaigns`**. The read-path sweep above
missed the WRITE-then-return paths: `.insert(...).select()` / `.update(...).select()`
with a BARE `.select()` request the full `*` representation back, which 401s
post-revoke just like a read `select=*`. Three sites fixed:
- `app/stories/new/page.tsx` - insert-then-`.select().single()` -> `.select('id')` (only `data.id` used)
- `app/campaigns/new/page.tsx` - same -> `.select('id')`
- `app/gm-notes-popout/page.tsx` - `.update().eq().select()` -> dropped `.select()` (only `error` used)

Verified no remaining bare `.select()` / `select('*')` on the campaigns table
(reads OR writes). The gate is now genuinely fully closed. PF: no further SQL
needed - the revoke stays as-is; this was purely an app-path gap. (Lesson updated
in `tasks/lessons.md` - the pre-revoke grep must include write chains, not just reads.)

---

## PF APPLIED + VERIFIED 2026-06-29 - campaigns.invite_code CLOSED. Batch DONE.

`sql/sec-pii-revoke-campaigns-invite-code-2026-06-29.sql` applied live after
re-verifying: zero `campaigns.select('*')` remain (multi-line sweep), `CAMPAIGN_COLUMNS`
== the regrant set exactly, and the grant set == all campaigns columns minus invite_code
(lossless). Post-revoke verification (anon REST + rolled-back authenticated impersonation):
- explicit `CAMPAIGN_COLUMNS` read (the app path) -> HTTP 200 (anon) + returns rows for a
  real GM My-Stories-shaped read (authenticated, claims set) = **no breakage, My Stories OK**.
- `select=invite_code` -> 42501 permission denied, both anon and authenticated = **leak closed**.
- bare `select=*` -> 401 (expected; nothing issues it anymore - that's the whole reason for
  the explicit-column conversion).

**Both PII halves are now revoked + verified. The 2026-06-23 security batch is COMPLETE -
email harvest and invite_code enumeration are both closed. Strangers-safe Beta-500 on the
PII front.** Reversible if anything surfaces: `GRANT SELECT ON public.campaigns / profiles
TO anon, authenticated;`.
