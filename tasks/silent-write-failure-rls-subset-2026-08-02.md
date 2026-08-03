# Silent write-failure sweep - RLS-shaped subset (routed to Puffer)

**Date:** 2026-08-02. **Source:** the silent-write-failure cataloging pass (full catalog + phasing in `tasks/todo.md` under SESSION FIXES 2026-08-02).

These are the sites from the sweep where a Supabase write's error is swallowed **AND** the write targets a cross-owner / RLS-gated / permission-sensitive table - so a policy denial (or a policy that lets a write silently no-op) would go completely unnoticed. A wrong RLS policy here produces exactly the "the button did nothing" symptom that masked tonight's `campaign_members` RLS-recursion incident.

**Ownership split:**
- **HP (Hunt & Peck):** add error SURFACING (`reportSupabaseError(error, ctx)` / preserve-state-on-fail) to each - purely additive, failure-path only. This is what makes a live RLS denial VISIBLE at runtime. Part of the broader observability sweep.
- **Puffer (hub):** assess whether the underlying RLS/policy is actually WRONG (a write being silently denied when it shouldn't be, or a half-state a policy allows). The two starred items below read like genuine bugs, not just missing observability.

---

## PRIORITY - look at proactively (read like real bugs, not just missing error UI)

- ⭐ **`app/stories/new/page.tsx:196`** - `campaign_members.insert` (GM auto-join on new-campaign create), result discarded. Leaves the GM as `campaigns.gm_user_id` with **NO membership row** - the exact half-state the sibling `app/campaigns/new/page.tsx:89` explicitly guards against. Directly connected to the INSERT policy touched around tonight's incident; would hit **anyone creating a new campaign during a live session**. Active-risk. (Puffer investigating 2026-08-02.)
- ⭐ **`app/moderate/page.tsx:266`** - `world_npcs.update` (approve/reject) via `updateWorldNpc`, no error capture at all. The **only** moderation handler on the page that skips the check+alert every sibling uses. "Should-be-failing-but-silently-isn't" candidate. Lower urgency (admin tool, not the core play loop).

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
