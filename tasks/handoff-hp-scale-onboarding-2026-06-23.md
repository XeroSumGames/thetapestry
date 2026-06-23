# Handoff -> Hunt & Peck: Tier 2 (scale) + Tier 3 (onboarding)

Source: `tasks/stability-audit-2026-06-23.md`. Tier 1 (security RLS) is done + live (Puffer, `659183b4`). These two tiers are app-code = your lane. All findings have file:line in the audit doc; this is the build-order + acceptance.

Context: great 2026-06-23 playtest; we're hardening to open from friends -> wider beta (Beta-500 ~7/1). None of these block a friends game; all matter once there are strangers + concurrency.

---

## TIER 2 - SCALE (do first; biggest leverage)

**T2-1 [HIGH] Add `campaign_id` filters to 3 unfiltered table-page subscriptions.** `app/stories/[id]/table/page.tsx`: `scene_tokens` (~467-468), `npc_relationships` (~1581-1590), `community_members` (~1577-1580). They have no `filter:`, so every change to those tables in ANY campaign is pushed to EVERY table client app-wide (token drag is the chattiest VTT event). Add `filter: \`campaign_id=eq.${id}\`` to each subscription. All three tables have `campaign_id`. **Single highest-leverage change.** Verify: open two tables in two different campaigns; a token move in one no longer triggers a refetch in the other (watch the recorder `net`/`realtime` events, or network tab).

**T2-2 [HIGH] Debounce + delta-cache the Sidebar presence-roster query.** `components/Sidebar.tsx:89-100` runs `profiles.select('id,username').in('id', ids)` on EVERY presence `sync` event (Thrivers only) - this is the `/characters` `profiles?select=id` storm from tonight's dump. Fix: (a) debounce the handler ~1-2s trailing so a burst of syncs collapses to one query; (b) cache an `id->username` map and only fetch ids not already cached (the delta), not the whole set each time. Verify: load `/characters` as a Thriver with others online; the repeated identical `profiles` GETs collapse to occasional delta fetches.

**T2-3 [HIGH] Cap/paginate two unbounded growth-table reads.** `rollLogForCampaign` (`lib/data/roll-log.ts:65`, no `.limit()`, pulled at end-session) and `getCampaignNpcs` (`lib/data/campaign-npcs.ts:24`, `SELECT *` incl. dead/inactive). Long campaigns -> multi-thousand-row synchronous reads. Fix: add a sensible `.limit()` / pagination to roll_log (the end-session snapshot only needs recent rolls), and status-filter the NPC fetch to active/relevant.

**T2-4 [MEDIUM] Make full-refetch realtime handlers apply payloads incrementally.** `character_states`->`loadEntries` (~5 queries per 1-WP hit, `page.tsx:1520`), `chat_messages`->refetch-100 (`TableChat.tsx:147`), `roll_log`->refetch-50 (`RollsFeed.tsx:229`). Apply `payload.new`/`payload.old` to local state for INSERT/UPDATE/DELETE; keep full refetch only for initial load + reconnect. `campaign_npcs` (`page.tsx:1554`) already does this - copy that pattern.

**T2-5 [MEDIUM] Batch the `campaign-clock` drainer loops.** `lib/campaign-clock.ts` (streaming/pending heals, rations, subsistence, infection) do one query per row; a GM clock-advance becomes 2N-4N round-trips. Batch the SELECTs with `.in('character_id', ids)` into a Map; collect UPDATEs into one multi-row write per table.

**T2-6 [LOW] Verify indexes exist** (can't see them statically): `(campaign_id, created_at)` on `roll_log`/`chat_messages`; `campaign_id` on `character_states`/`campaign_npcs`; `notifications.user_id`; `conversation_participants.user_id|conversation_id`. If any are missing, route to Puffer for an index migration.

---

## TIER 3 - ONBOARDING (cold-signup bounce risk)

**T3-1 [HIGH] No discoverable "Join a Story" for a player who signed up cold.** A stranger lands on `/dashboard`; its empty state (`app/dashboard/page.tsx:112-172`) is 100% GM funnel ("Create Your First Story"). The sidebar (`components/Sidebar.tsx:221-228`) has no Join entry. The only join affordances are on `/stories` (which they aren't routed to). Fix: add a "Join a Story" secondary button to the dashboard empty state + a "Join a Story" sidebar link (-> `/stories/join` or the code-redeem page). **Single biggest bounce risk.**

**T3-2 [HIGH] `/characters/random` is an infinite-spinner dead-end when logged out.** `app/characters/random/page.tsx:99` sets status 'ready' on `!user` and only ever renders pulsing dots - no login redirect, no GhostWall (the `new`/`quick` wizards gate correctly). Fix: on `!user`, render GhostWall or `router.push('/login?redirect=/characters/random')`, matching the siblings.

**T3-3 [HIGH] Hardest character path is styled as the default.** "Backstory Generation" (the 10-step CDP wizard) is the red primary everywhere (`app/characters/page.tsx`, `app/welcome/page.tsx:133`, `Sidebar.tsx:247`); the one-click Paradigm + the in-lobby pregen picker (the genuine best newcomer experience) are de-emphasized/late. Fix: lead first-timers with Paradigm/pregen, or add one-line subtitles ("fastest start" vs "full custom") so the easy path is obvious.

**T3-4 [MEDIUM] Mojibake in Quick Character UI.** `app/characters/quick/page.tsx:245,291,324,351,353` render `�` glyphs (corrupted em-dashes) to users - also a no-em-dash-rule violation. Replace with ASCII `-`/`*`.

**T3-5 [MEDIUM] `creationMethod` mis-stamped.** `app/characters/quick/page.tsx:170` sets `creationMethod='backstory'` on the Quick path; the Backstory wizard (`new/`) sets none. Set `'quick'` in quick, `'backstory'` in new/.

**T3-6 [MEDIUM] Jargon with no inline glossary.** CDP/RAPID/AMod/SMod/CMod/WP/RP/vocational(*) appear with no first-use definition across the wizards. Add a one-time inline tooltip on first mention. (Polish; lower than the above.)

**LOW polish (batch when convenient):** Paradigm flow flashes "Random Character" heading (`random/page.tsx:107,230` - change when `?paradigm=`); unlabeled green Pregen button needs a `title=` (`new/page.tsx:269-273`); secondary-stat legend on the saved character card.

---

## What's SOLID - do not touch
Email-confirmation flow (signup/login/callback handle confirm-on/off + Resend), deep-link `?redirect=` survival, observer mode (fully built), the in-lobby pregen picker, fog_state + token-reveal realtime propagation, and the `.limit()`-bounded NotificationBell/TableChat/RollsFeed feeds. No `[PLACEHOLDER]` copy leaked anywhere in the traced path.

## NOT your lane (Puffer is handling)
The Tier-1 security RLS (done, `659183b4`), the deferred MEDIUM RLS items (`campaign_members` read - needs a SECURITY DEFINER helper to avoid recursion; `object-tokens` insert), and the LOS-through-windows re-triage (needs live instrumentation - the architecture is sound, do NOT "fix" it). Route any DB/index/RLS need back to Puffer rather than cross-editing `sql/`.
