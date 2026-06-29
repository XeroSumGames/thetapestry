# Finding -> PF: PII reader rewire SHIPPED, with 2 things to know before the revoke

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
