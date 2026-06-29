# Puffer Fish handoff - pre-Beta-500 security/scale/realtime hardening (2026-06-23)

**Lane:** Puffer Fish (architecture / risk / SQL / RLS / realtime / observability). **North star:** TheTapestry stable/polished/fun for the 9/1 Kickstarter; Beta-500 ~7/1. **HEAD at handoff:** `07a0f495`, main clean + synced.

## What this session did
A pre-Beta-500 "bring in strangers" audit ([tasks/stability-audit-2026-06-23.md](stability-audit-2026-06-23.md)) + a Supabase-advisor triage ([tasks/supabase-advisor-triage-2026-06-23.md](supabase-advisor-triage-2026-06-23.md)) found HIGH clusters in security, realtime fan-out, and onboarding. The master punch list is [tasks/punch-list-2026-06-23.md](punch-list-2026-06-23.md). **Every PF-owned item across Security + Scale + Realtime-desync is now DONE or staged.** All live-DB changes applied + verified (read-only / rolled-back impersonation).

### Applied live this session (all committed)
- **RLS reads scoped** (dropped broad `auth.role()=authenticated`/`USING(true)` shadow policies): characters, character_states, roll_log (+ insert now campaign-gated), sessions, campaign_members (via new SECURITY DEFINER `is_campaign_member()`), chat_messages (+ whisper privacy).
- **Storage writes scoped** (were bucket-only): campaign-covers, module-covers, object-tokens, campaign-npcs, session-attachments (by folder = campaign/session id).
- **pregen_campaign_map**: RLS was OFF entirely (Supabase linter) -> enabled + policies.
- **portrait_bank**: INSERT gated to owner; SELECT respects is_private.
- **BLOCKER fixed - Thriver self-escalation**: `normalize_profile_role` now blocks an authenticated non-Thriver from setting role='thriver' (service_role/dashboard still can).
- **Advisor**: search_path pinned on 33 SECURITY DEFINER functions; 11 hot FK indexes added.
- **Scale/realtime**: denormalized `campaign_id` onto scene_tokens/npc_relationships/community_members (backfill + BEFORE INSERT trigger) + added `campaign_id` filter to those 3 fan-out subs; M-RT-1 grid/lock now reach players mid-session.
- **RPC seams** (live, for the pending app rewires): `find_campaign_by_invite_code`, `get_campaign_invite_code`, `get_profile_email`, `is_campaign_member`.

## PENDING (pick up here)
1. **2-client realtime verify (owed, PF can't do from CLI).** Confirm the campaign_id sub-filters + grid/lock work live: token move in campaign A must NOT wake campaign B's client but MUST still update A's; a GM mid-session grid toggle reaches a player. Steps in the last chat message / commit `07a0f495`. If a filter silently killed a sub, realtime for tokens/reveals/community breaks - watch for that.
2. **Email + invite_code column revokes (PF applies AFTER HP rewires readers).** The leaks (profiles.email + campaigns.invite_code world-readable) are NOT yet closed - the DB seams (RPCs) are live but the column-revoke is STAGED in [sql/sec-pii-column-revokes-2026-06-23-APPLY-AFTER-REWIRE.sql](../sql/sec-pii-column-revokes-2026-06-23-APPLY-AFTER-REWIRE.sql). HP rewires 3 email + 6 invite_code readers per [tasks/handoff-hp-pii-revokes-2026-06-23.md](handoff-hp-pii-revokes-2026-06-23.md), then PF applies that file + re-verifies via impersonation. Until then these two reads remain open (MEDIUM/HIGH).
3. **HP-owned items** (routed, not PF): scale (presence-debounce, unbounded `rollLogForCampaign`/`getCampaignNpcs`, incremental realtime handlers, campaign-clock N+1) + onboarding (Join discoverability, /characters/random logged-out dead-end, path prominence, mojibake, creationMethod) - all in [tasks/handoff-hp-scale-onboarding-2026-06-23.md](handoff-hp-scale-onboarding-2026-06-23.md).

## Discipline / incident notes
- **NEVER run a mutating test against live without an explicit rollback** - a CTE/RETURNING UPDATE auto-commits. This session I accidentally promoted user `pan12210505@gmail.com` (Bernice) to Thriver via an un-rolled-back test; caught it, reverted to survivor (only Xero is Thriver). Use the `DO $$ ... RAISE EXCEPTION 'rollback' ...$$` or rolled-back `BEGIN; SET LOCAL ROLE authenticated; ...; ROLLBACK;` impersonation pattern. Logged in [tasks/lessons.md](lessons.md).
- All live SQL: confirm intent with Xero, then PF applies via `npx supabase db query --linked -f sql/<file>.sql` + verifies in pg_catalog/pg_policies. RLS reads verified via rolled-back JWT impersonation (`set_config('request.jwt.claims', ...)` + `SET LOCAL ROLE authenticated`).
- An RLS audit must scan BOTH `pg_class.relrowsecurity=false` (RLS-off tables) AND `pg_policies` (loose policies) - the first audit missed pregen_campaign_map because a no-policy table is invisible to a policy scan.
- No em/en-dashes anywhere (pre-commit blocks); push straight to main (Vercel = live).
