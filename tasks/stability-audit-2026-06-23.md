# Stability / Readiness Audit - 2026-06-23 (pre-Beta-500, "bring in strangers" lens)

**Trigger:** great 2026-06-23 playtest; Xero: "feels very close to bringing in others." Beta-500 ~7/1 (~8 days). Last full audit 2026-06-12 (clean); ~335 commits since, heavy pregen + RLS/storage churn.
**Method:** live gates (all GREEN) + 4 parallel sub-audits (untrusted-user RLS, scale/perf, LOS/realtime, first-run onboarding). No code edited in this pass.
**Headline:** **0 BLOCKER.** The core loop is fun + the foundations are solid. But "open to untrusted users" surfaces a real **HIGH cluster** in three areas - security read/storage holes, realtime fan-out, and join-discoverability - none of which a friends-only playtest exercises. All fixes are well-scoped and reversible.

---

## Live gates - ALL GREEN
tsc 0 · role-literals OK · font-sizes OK · arch ratchet at baseline · publication drift OK (21 tables) · db-emdashes OK · 877 unit tests (last run). Nothing red at the gate level.

---

## BLOCKER
None.

---

## HIGH - gates "bring in strangers"; fix before opening Beta-500

### Security - untrusted-user read/storage exposure (Puffer / SQL)
The pattern in every read case: an old broad `auth.role()='authenticated'` / `USING(true)` policy left sitting *next to* a newer scoped policy. RLS policies OR-combine, so the broad one wins and the scoped one is dead. Harmless among friends; a data-exposure/griefing surface the moment accounts are untrusted. All verified against the LIVE DB (the `sql/_baseline/schema.sql` snapshot is stale for several of these).

- **H-SEC-1 - `characters` readable by ANY logged-in user.** Full XSECharacter blob (name, sheet, stats, notes, backstory) of every user, any campaign. Policy "Characters viewable by authenticated users" `USING (auth.role()='authenticated')`. Fix: `DROP` it - the scoped membership policy + thriver bypass already cover legit reads. Writes are fine (owner-only, known-closed).
- **H-SEC-2 - `character_states` readable by ANY logged-in user.** Live HP/RP/stress/conditions for every PC everywhere. Policy "Members can view all states in their campaign" is misnamed - actually `auth.role()='authenticated'`. Fix: replace with the campaign-membership SELECT pattern already in `sql/character-states-rls-fix.sql`.
- **H-SEC-3 - `roll_log`: world-readable AND cross-campaign insertable.** Read `USING(true)` (every roll, every campaign). Insert `WITH CHECK (auth.uid()=user_id)` with NO campaign-membership predicate → a stranger can inject rolls into any campaign's live feed. Fix: scope read to member/GM/thriver; add campaign-membership to the insert WITH CHECK.
- **H-SEC-4 - `campaign-covers` storage: stranger can overwrite/delete any cover.** Public bucket, predictable keys (`<campaign_id>/…`), U/D policies gate only on `bucket_id` - no folder/GM check (the file comment admits it relies on app-layer guards, which a direct Storage API call bypasses). Defacement/griefing. Fix: add GM-of-campaign folder check to I/U/D (pattern exists in `sql/gm-notes-attachments-policy-fix.sql`).
- **H-SEC-5 - `module-covers` storage: same class** for the `/rumors` marketplace. U/D gate only on `bucket_id`. Fix: scope writes to module author + thriver.

### Scale - realtime fan-out (Hunt & Peck, mostly one-line)
- **H-SCALE-1 - 3 unfiltered `postgres_changes` subs broadcast every campaign's changes to every client.** `app/stories/[id]/table/page.tsx`: `scene_tokens` (467-468, the chattiest event in a VTT - every token drag), `npc_relationships` (1581-1590), `community_members` (1577-1580). No `filter:`, so at N concurrent tables every token move on *any* table wakes *every* table client. Fix: add `filter: campaign_id=eq.${id}` to each. **Single highest-leverage change in the audit.**
- **H-SCALE-2 - Sidebar presence-roster re-queries `profiles` on every presence `sync`** (`components/Sidebar.tsx:89-100`, Thrivers). This is the `/characters` `profiles?select=id` storm from tonight's dump. Sync frequency scales with platform-wide concurrency → continuous load on the largest table. Fix: debounce (1-2s trailing) + delta-cache id→username (fetch only new ids).
- **H-SCALE-3 - unbounded fetches on growth tables.** `rollLogForCampaign` (`lib/data/roll-log.ts:65`, no limit, pulled at end-session) and `getCampaignNpcs` (`lib/data/campaign-npcs.ts:24`, SELECT * incl. dead/inactive). Long campaigns = multi-thousand-row synchronous reads. Fix: paginate/cap roll_log; status-filter NPCs.

### Onboarding - cold-signup bounce risk (Hunt & Peck)
- **H-UX-1 - No discoverable "Join a Story" for a player who signed up cold.** A stranger lands on `/dashboard`; its empty state is 100% GM funnel ("Create Your First Story"). Sidebar has no Join entry. The only join affordances live on `/stories` (which they don't get routed to). A player who just wants into their friend's game has no obvious path. Fix: add "Join a Story" to the dashboard empty state + sidebar. **Single biggest bounce risk.**
- **H-UX-2 - `/characters/random` is an infinite-spinner dead-end when logged out** (`app/characters/random/page.tsx:99`): sets status 'ready' but only renders pulsing dots, no login redirect/GhostWall (the `new`/`quick` wizards gate correctly). Fix: GhostWall or `?redirect=` like the siblings.
- **H-UX-3 - Hardest path styled as the default.** "Backstory Generation" (10-step CDP wizard) is the red primary everywhere; Paradigms (one-click) and the in-lobby pregen picker (the genuine best newcomer experience) are de-emphasized/late. Fix: lead first-timers with Paradigm/pregen, or subtitle "fastest start" vs "full custom."

---

## MEDIUM
- **M-SEC-1 - `campaign_members` roster readable by any logged-in user** (`auth.role()='authenticated'`). Membership-graph disclosure; the pivot that makes H-SEC-1/2 easy. Fix: scope to self + member/GM of that campaign + thriver bypass.
- **M-SEC-2 - `object-tokens` bucket: any logged-in user can upload arbitrary images** (INSERT gates only on `bucket_id`, no per-user folder; no U/D policy so no overwrite). Storage-abuse vector. Fix: per-user folder scope on INSERT.
- **M-SCALE-1 - full-refetch realtime handlers** (amplifiers, all campaign-scoped so correct, just wasteful under combat velocity): `character_states`→`loadEntries` (~5 queries per 1-WP hit, `page.tsx:1520`), `chat_messages`→refetch 100 (`TableChat.tsx:147`), `roll_log`→refetch 50 (`RollsFeed.tsx:229`). Fix: apply `payload.new/old` incrementally; `campaign_npcs` (page.tsx:1554) already shows the pattern.
- **M-SCALE-2 - N+1 in `campaign-clock` drainers** (`lib/campaign-clock.ts`: streaming/pending heals, rations, subsistence, infection) - a GM clock-advance becomes 2N-4N round-trips. Fix: batch `.in()` reads + multi-row writes.
- **M-RT-1 - grid/lock settings (`show_grid`, `grid_color`, `grid_opacity`, `is_locked`) only apply on first load** (`components/TacticalMap.tsx:674-682`, `isFirstLoad`-gated). A GM toggling grid/lock mid-session doesn't reach a player who already loaded. The one genuine independent realtime-desync bug found. Fix: apply on the `!isGM` branch like `cell_px` already does.
- **M-UX-1 - unexplained jargon, no inline glossary** (CDP/RAPID/AMod/SMod/CMod/WP/RP/vocational*) throughout the wizards. Fix: one-time inline tooltip on first use.
- **M-UX-2 - mojibake in Quick Character UI** (`app/characters/quick/page.tsx:245,291,324,351,353`: `�` glyphs, was em-dashes - also a no-em-dash-rule violation, visible to users). Fix: ASCII `-`/`·`.
- **M-UX-3 - `creationMethod` mis-stamped** (`quick/page.tsx:170` sets `'backstory'` on the Quick path; Backstory wizard sets none). Corrupts method-keyed logic. Fix: set `'quick'` here, `'backstory'` in `new/`.

---

## LOW
- **L-SEC-1** `portrait_bank` INSERT/SELECT both loose (`true`) - shared low-sensitivity pool; gate on owner col if one exists, else document as intentional.
- **L-SCALE-1** missing-index smells to verify live (can't see indexes): `(campaign_id, created_at)` on `roll_log`/`chat_messages`; `campaign_id` on `character_states`/`campaign_npcs`; `notifications.user_id`; `conversation_participants.user_id|conversation_id`.
- **L-RT-1** `lighting_mode` propagates correctly but shares walls' single-delivery dependency - give it the same fallback broadcast if H-RT triage shows a delivery problem.
- **L-UX-1/2/3** Paradigm flow flashes "Random Character" heading; unlabeled green Pregen button (add `title=`); secondary-stat legend on saved card.

---

## RE-CLASSIFIED - the open "LOS through open windows" HIGH (todo ~L359)
**Prior root cause REFUTED.** The diagnosis ("door/window toggle fires no broadcast, nothing pushes walls live") is contradicted by current code: the toggle calls the membership-gated `toggleWallSegmentDoor` RPC → `UPDATE tactical_scenes.walls` → `tactical_scenes` is published with REPLICA IDENTITY FULL → players have a SELECT policy → the `postgres_changes` sub at `TacticalMap.tsx:759` runs `loadScenes()` → `setScene` → `wallsLocal` effect (451-461) → LOS recompute. The propagation path exists end-to-end. If it still reproduces live, it's **operational (delivery/data-state), not architectural.** Action: **instrument the line-759 handler at a live table to confirm the player session receives the event** before writing any fix; add a belt-and-suspenders `walls_changed` broadcast on the existing `tacticalChannel` (mirror the `token_changed` pattern) as reliability hardening. Do NOT ship an architecture "fix" for a sound architecture. (Note: this means the long-standing HIGH may be partly stale - possibly already mitigated by work since it was filed.)

---

## What's solid (don't touch / don't re-flag)
RLS WRITE scoping on characters/character_states/scene_tokens/campaign_npcs/sessions/chat_messages/pregen_library is good (the known cross-user write class holds). Email-confirmation + deep-link `?redirect=` survival + observer mode + the in-lobby pregen picker are genuinely well-built. fog_state + token reveal propagate correctly (the models to copy). NotificationBell/TableChat/RollsFeed feeds are properly `.limit()`-bounded. No `[PLACEHOLDER]` copy leaked to users.

---

## Recommended burn-down order (→ Beta-500)
1. **Tier 1 - Security, before ANY stranger logs in (Puffer/SQL, ~1 sql file each, reversible):** H-SEC-1..5 + M-SEC-1/2. Drop the broad SELECTs, scope roll_log read+insert, folder-scope the two cover buckets, scope campaign_members, tighten object-tokens. This is the hard gate - do not open to untrusted users with characters/roll_log world-readable and covers world-writable. Needs Xero's go (live schema), then I apply + verify.
2. **Tier 2 - Scale, as concurrency climbs (HP):** H-SCALE-1 (campaign_id filters - biggest win) → H-SCALE-2 (presence debounce) → H-SCALE-3 (cap unbounded reads) → M-SCALE-1/2.
3. **Tier 3 - Onboarding, so cold signups don't bounce (HP):** H-UX-1 (Join discoverability) → H-UX-2 (Random dead-end) → H-UX-3 (path prominence) → M-UX-1/2/3.
4. **Instrument + re-triage the LOS HIGH** (Puffer): confirm live before any fix; ship the grid/lock first-load fix (M-RT-1) regardless.
