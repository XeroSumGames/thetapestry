# Handoff -> HP: switch join-by-code to the invite RPC (then PF scopes campaigns)

**Why:** `campaigns` SELECT is `USING(true)` -> any authenticated user can enumerate every campaign and harvest every `invite_code` -> join any private game (HIGH leak, 2026-06-23 audit). We can't scope the table read until the join flow stops reading campaigns directly as a non-member.

**PF already shipped the seam (live):** SECURITY DEFINER RPC `find_campaign_by_invite_code(p_code text)` -> returns `(id, name, setting, description, cover_image_url, gm_user_id)` for an EXACT code match, no enumeration, never echoes the code. Granted to `authenticated`.

## Your changes (HP)
1. **`app/join/[code]/page.tsx`** (~line 28): replace
   `supabase.from('campaigns').select('*').eq('invite_code', code).single()`
   with `supabase.rpc('find_campaign_by_invite_code', { p_code: code }).single()` (returns one row; same fields the page uses - id/name/setting/cover_image_url).
2. **`app/stories/join/page.tsx`** (~line 31): same swap (`.eq('invite_code', ...)` -> the RPC; the page uppercases the code, the RPC already trims+uppers).
3. **`app/campfire/lfg/page.tsx:132`** reads `select('id, name, invite_code')` - audit this. If it's exposing campaign invite codes in the LFG list, it must stop (don't select invite_code there; show a Join link/button that routes through `/join/<code>` only for codes the user legitimately has). Confirm what this read is for and whether it needs campaigns the user isn't a member of.
4. Grep for any other non-member `campaigns` reads (`from('campaigns')` where the user may not be a member/GM) - story list, lobby, snapshots/sessions/community pages read by id where the user IS a member (fine). The join + LFG paths are the only non-member ones found.

## Then ping PF
Once 1-4 land and joining still works, PF scopes `campaigns` SELECT to member/GM (+ thriver) - that's the change that actually closes the leak; doing it before your rewire would break joining. Leave a note in active-lanes or todo when done.

**Acceptance:** join via an invite link/code still works for a brand-new non-member; the LFG list no longer exposes invite codes; a logged-in user can no longer `GET /rest/v1/campaigns?select=invite_code` and get every code (after PF's scope lands).
