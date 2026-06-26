# Supabase Advisor Triage - 2026-06-23

Replicated the Supabase database-linter checks against the live catalog (the dashboard advisor is the same set). The `rls_disabled_in_public` finding is already fixed (`04527d90`, pregen_campaign_map). Remaining findings below, triaged by real severity.

**Clean (no findings):** security-definer views (0010), RLS-enabled-but-no-policy (0008), extension-in-public (0014). Good.

---

## SECURITY

### S1 [MEDIUM] 33 SECURITY DEFINER functions with a mutable `search_path` (lint 0011)
`is_thriver`, `handle_new_user`, `get_visitor_map_data`, and 30 `notify_*` / community trigger functions run as their owner (elevated) but don't pin `search_path`. The theoretical attack: a user creates an object in a schema on the search_path that shadows what the function references, hijacking the elevated execution.

**Why MEDIUM, not HIGH:** the attack requires `CREATE` privilege on a schema in the path. In standard Supabase, `anon`/`authenticated` do NOT have `CREATE` on `public`, so an untrusted beta user can't actually pull it off today. It's a defense-in-depth + linter-clean item, not an open door.

**Fix (non-breaking):** `ALTER FUNCTION <fn>(<args>) SET search_path = public, extensions;` for each. `public` keeps unqualified table refs resolving; `extensions` keeps extension funcs (gen_random_uuid etc., which live in the `extensions` schema here, not public) resolving. NOT `= ''` (would break every unqualified ref in 33 bodies). **Care:** several are write-path triggers (notify_character_changed, notify_player_joined) - after applying, smoke-test that a character save + a player-join still fire their notifications.

### S2 [LOW] 23 non-SECURITY-DEFINER functions with mutable search_path
Same lint, but these run as the CALLER, so no privilege escalation. Cosmetic/linter-clean. Bundle with S1 or skip.

---

## SCALE / PERFORMANCE

### P1 [MEDIUM-HIGH] 66 unindexed foreign keys
An unindexed FK forces a full child-table scan every time the parent row is updated/deleted, and slows joins/filters on that column. Most of the 66 are cold provenance/audit columns (`approved_by`, `created_by`, `published_by`, `source_module_id`) - low traffic, index later. The **HOT subset to index now** (frequently filtered, on growth tables, or hit by the new RLS policy subqueries):

```sql
-- High-traffic FK columns - index now (CONCURRENTLY to avoid table locks on prod)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characters_user_id            ON public.characters(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_character_states_user_id      ON public.character_states(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_roll_log_user_id              ON public.roll_log(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_user_id         ON public.chat_messages(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_gm_user_id          ON public.campaigns(gm_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_members_character_id ON public.campaign_members(character_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tactical_scenes_campaign_id   ON public.tactical_scenes(campaign_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_campaign_id          ON public.sessions(campaign_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_sender_user_id       ON public.messages(sender_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_attachments_session_id ON public.session_attachments(session_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pregen_library_campaign_id    ON public.pregen_library(campaign_id);
```
`campaigns(gm_user_id)` matters most for THIS session's work: every RLS policy I added (characters GM-read, character_states, roll_log, both cover buckets) runs `campaigns WHERE gm_user_id = auth.uid()` - this index serves all of them. (Tables are tiny now so impact is latent, but these are the columns that bite first as data grows.)

`CONCURRENTLY` can't run inside a txn block - apply these one-per-statement, not wrapped. The ~55 cold FKs (audit columns) -> a later batch; list is in the raw advisor output.

### P2 [LOW] ~42 "multiple permissive policies" (lint 0006)
Per table+command+role, >1 permissive policy = each evaluated per row. Worst: `profiles SELECT x4`, `scene_tokens/tactical_scenes ALL x3`, the campfire tables x2-3. Two were just added by tonight's RLS work (`characters SELECT x2` = co-member + GM-read) - intentional, clarity over a few microseconds/row. Fix is to OR-combine policies into one per command; modest perf gain, real correctness risk in the merge. **LOW - a deliberate consolidation pass later, not now.** Don't merge the security-critical ones casually.

---

## Recommended action
1. **P1 hot-FK indexes - DONE 2026-06-23** (`sql/perf-fk-indexes-2026-06-23.sql`, applied live; 11 indexes CONCURRENTLY, all valid, 0 hot FKs still unindexed).
2. **S1 search_path pin - DONE 2026-06-23** (`sql/definer-fn-search-path-2026-06-23.sql`, applied live; all 33 definer fns pinned to `public, extensions`, 0 remaining unpinned; verified `is_thriver()` callable + `notify_character_changed` fires clean in a rolled-back txn smoke test).
3. **Defer (LOW follow-up batch):** S2 (23 non-definer fns), P2 (~42 multi-permissive policies), the ~55 cold-FK indexes. Add the Supabase advisor/linter to the standing pre-ship checklist so this class is caught continuously (lesson logged 2026-06-23).
