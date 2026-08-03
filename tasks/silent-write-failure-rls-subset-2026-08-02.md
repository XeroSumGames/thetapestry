# Silent write-failure sweep - RLS-shaped subset (routed to Puffer)

**Date:** 2026-08-02. **Source:** the silent-write-failure cataloging pass (full catalog + phasing in `tasks/todo.md` under SESSION FIXES 2026-08-02).

These are the sites from the sweep where a Supabase write's error is swallowed **AND** the write targets a cross-owner / RLS-gated / permission-sensitive table - so a policy denial (or a policy that lets a write silently no-op) would go completely unnoticed. A wrong RLS policy here produces exactly the "the button did nothing" symptom that masked tonight's `campaign_members` RLS-recursion incident.

**Ownership split:**
- **HP (Hunt & Peck):** add error SURFACING (`reportSupabaseError(error, ctx)` / preserve-state-on-fail) to each - purely additive, failure-path only. This is what makes a live RLS denial VISIBLE at runtime. Part of the broader observability sweep.
- **Puffer (hub):** assess whether the underlying RLS/policy is actually WRONG (a write being silently denied when it shouldn't be, or a half-state a policy allows). The two starred items below read like genuine bugs, not just missing observability.

---

## PRIORITY - look at proactively (read like real bugs, not just missing error UI)

- ✅ **CLEARED - `app/stories/new/page.tsx:196`** - `campaign_members.insert` (GM auto-join). Simulated the exact live sequence (new campaign insert -> auto-join insert) under the current policy, rolled back, no trace left: succeeds cleanly. Not an active RLS bug - the half-state is still theoretically possible if the insert fails for an unrelated reason (network, etc.), which the observability sweep already covers. (Puffer, 2026-08-03.)
- ✅ **FIXED - `app/moderate/page.tsx:266`** - `world_npcs.update` (approve/reject) via `updateWorldNpc`. This one WAS a real bug: a Thriver moderator could approve their own submissions fine, but approving/rejecting another user's pending NPC silently matched 0 rows - confirmed live (update-then-reread-bypassing-RLS showed the row never changed). Also the pending-queue LIST itself was invisible for other users' submissions (`loadPendingWorldNpcs` is a plain client SELECT, and `world_npcs` had no Thriver SELECT policy - every sibling moderation table already has one). Root cause: the UPDATE policy used an inline correlated subquery on `profiles` instead of the proven `is_thriver()` SECURITY DEFINER helper every sibling table uses. Fixed both the UPDATE and added the missing SELECT policy, `sql/fix-world-npcs-moderation-rls-2026-08-03.sql`, verified live. (Puffer, 2026-08-03.)

## Surface-then-assess (HP surfaces; Puffer confirms if any actually deny at runtime)

- `app/dashboard/page.tsx:81` - `map_pins.update` (Thriver rumor-pin approve/reject), optimistic removal from pending list.
- `components/CampaignMap.tsx:880` - `campaign_pins.insert(...).select().single()`, only `data` destructured; player sees "✓ Pin submitted" for a pin that may never have been created.
- `app/scene-controls-popout/page.tsx:411-440` - `tactical_scenes.update` x2 (deactivate all + activate one); GM thinks the scene switched, players' realtime table never changes.
- `app/stories/[id]/table/page.tsx:1186` - `character_states.insert` (`ensureCharacterStates`), background, no reconcile; a PC with no state row never appears in initiative / can't be damaged.
- `app/stories/[id]/table/hooks/useRollResolution.ts:1188 / :1209 / :1221` - `character_states.update` / `campaign_npcs.update` / `scene_tokens.update` (blast/AoE splash damage). The **unguarded twin** of the file's own single-target path, which already does `.select()` + rowcount + `alert('SILENT RLS FAIL ... run sql/...rls.sql')`. AoE silently applies zero damage.
- `components/ObjectCard.tsx:130 / :149` - `characters.update({data})` + `scene_tokens.update({contents})` (give/take crate item); crate decremented even if the character write failed -> item vanishes / duplicable loot.
- `components/StoryActionBar.tsx:180` (+ dup path `app/stories/page.tsx:307`) - `campaigns.delete` (type-to-confirm Delete Story), immediate `router.push`; user confirms + is redirected, campaign not deleted.
- `components/NpcRoster.tsx:1002` - `insertWorldNpc` (publish NPC to world map), marks published even on failure.
- `components/CampaignPins.tsx:368` - promote pin to world map.

---

*HP is working the surfacing side as part of the broader sweep (exemplar `434f0979` shipped: TableChat.send). This file is the shared record so both lanes can track which of these turn out to be real policy bugs vs. purely missing observability.*
