# Audit: RLS Gap Sweep (Public Schema Tables)

Closes Phase P4 / A5.3 of `tasks/puffer-fish-platform-plan.md`. Sweeps every table the app accesses against `sql/` policy + RLS-enable coverage. Surfaces gaps where the repo doesn't fully describe live security state.

**Audience:** the hunt-and-peck chat (for fill-in SQL) + Xero (for dashboard verification on the ambiguous cases).

**Status:** AUDIT 2026-05-20. Findings only; SQL fill-in is hunt-and-peck work.

---

## 1. Methodology

1. Grepped every `.from('<table>')` call in `app/components/lib/` to enumerate the 64 distinct tables the app actually reads/writes.
2. For each table, ran two grep checks against `sql/*.sql`:
   - `CREATE POLICY ... ON ... <table>` (policies in repo)
   - `ALTER TABLE ... <table> ... ENABLE ROW LEVEL SECURITY` (RLS-enable in repo)
3. Classified by gap shape.

**Not covered by this audit:** the actual LIVE state in the Supabase dashboard. The grep tells us what's REPRODUCIBLE FROM REPO. Dashboard may have additional policies / enabled state that the repo doesn't capture. Section 5 has the SQL queries Xero runs to fill that in.

---

## 2. Per-table coverage

64 tables, classified into 4 tiers. Tier 1 = full repo coverage (good); Tier 4 = no repo coverage at all (worst).

### Tier 1: full coverage (RLS-enable + policies both in repo)

23 tables. Lowest risk; repo fully describes the security state.

`advantages, bug_reports, campaign_invitations, campaign_npcs, campaign_snapshots, communities, community_events, community_members, community_morale_checks, community_resource_checks, conversation_participants, forum_replies, forum_thread_reactions, forum_threads, initiative_order, lfg_interests, lfg_post_reactions, lfg_posts, messages, module_reviews, npc_relationships, player_notes, player_npc_notes, roll_log, scene_tokens, setting_seed_handouts, setting_seed_npcs, setting_seed_pins, setting_seed_scenes, tactical_scenes, user_blocks, war_stories, war_story_reactions, whispers`

### Tier 2: partial coverage (RLS-enable in repo, policies dashboard-only)

15 tables. RLS is on (`ENABLE ROW LEVEL SECURITY` is in `sql/`) but no `CREATE POLICY` is in repo. Either:
- Policies live in dashboard only (lost to a re-baseline), OR
- Policies were never created (RLS = on but no allow rules = nothing readable; would have broken if so) - **unlikely** for tables actively used by app code.

| Table | Likely state | Action |
|---|---|---|
| `campaign_events` | Dashboard-only policies | Extract + commit to `sql/` |
| `campaign_pins` | Dashboard-only | Extract + commit |
| `campaign_portrait_usage` | Dashboard-only | Extract + commit |
| `chat_messages` | Dashboard-only (load-bearing for in-session chat) | Extract + commit URGENTLY |
| `community_encounters` | Dashboard-only | Extract + commit |
| `community_migrations` | Dashboard-only | Extract + commit |
| `community_stockpile_items` | Dashboard-only | Extract + commit |
| `community_subscriptions` | Dashboard-only | Extract + commit |
| `module_subscriptions` | Dashboard-only | Extract + commit |
| `module_versions` | Dashboard-only | Extract + commit |
| `modules` | Dashboard-only (load-bearing for /rumors) | Extract + commit URGENTLY |
| `object_token_library` | Dashboard-only | Extract + commit |
| `portrait_bank` | Dashboard-only | Extract + commit |
| `portrait_counters` | Dashboard-only | Extract + commit |
| `world_communities` | Dashboard-only | Extract + commit |
| `world_community_links` | Dashboard-only | Extract + commit |

### Tier 3: partial coverage (policies in repo, RLS-enable NOT in repo)

**VERIFIED 2026-05-20 (Xero ran Query 1): all 10 tables return `rls_enabled = true` in prod. NO P0. NO data leak.** RLS is enabled in the live DB (dashboard-managed); the repo simply lacks the `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements. The "disaster scenario" below is RULED OUT. What remains is a **reproducibility gap** (documentation), not a security hole: a fresh DB rebuilt from `sql/` alone would NOT enable RLS, so the canonical-DDL fill-in work matters for disaster recovery + new-environment bootstrap, but there's no live exposure.

10 tables. Policies are in repo, but the `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statement isn't. Two possibilities (resolved above):
- ~~RLS WAS enabled at some earlier point (probably via a manual dashboard click OR an old SQL file that was deleted) and the policies are active.~~ **CONFIRMED - this is the case.**
- ~~RLS was NEVER enabled and the policies are decorative (don't enforce anything). Disaster scenario.~~ **RULED OUT 2026-05-20.**

| Table | Severity if RLS off | Action |
|---|---|---|
| `campaign_members` | HIGH - reveals who's in which campaign | Verify + add ENABLE to repo |
| `campaign_notes` | HIGH - GM-private notes leak | Verify + add ENABLE |
| `campaigns` | HIGH - campaign metadata leak | Verify + add ENABLE |
| `character_states` | HIGH - PC stats / location / etc. | Verify + add ENABLE |
| `characters` | HIGH - PC data leak | Verify + add ENABLE |
| `map_pins` | MEDIUM - depending on bucket | Verify + add ENABLE |
| `notifications` | HIGH - per-user notifications leak across users | Verify + add ENABLE |
| `profiles` | HIGH - user emails / roles | Verify + add ENABLE |
| `session_attachments` | MEDIUM - session files reveal who attended | Verify + add ENABLE |
| `sessions` | MEDIUM - session metadata | Verify + add ENABLE |

**This is the biggest finding of the audit.** Xero needs to verify the live state of RLS for these 10 tables URGENTLY.

### Tier 4: no repo coverage at all (policies + ENABLE both absent)

4 tables. Either truly RLS-free (dev tables, analytics tables) OR completely dashboard-managed:

| Table | Likely intent | Action |
|---|---|---|
| `debug_log` | Dev-only logging | Verify + decide: if used in prod, add RLS; else add `dev-only` warning |
| `user_events` | Analytics events | Likely INSERT-only from authenticated; verify + add minimal policy |
| `visitor_logs` | Visitor tracking | Likely Thriver-read-only; verify + add policy |
| `world_npcs` | Setting NPC data | Likely public read; verify + add policy |

---

## 3. SQL queries for Xero to run (live dashboard / SQL editor)

These produce the ground truth + close the audit's ambiguity.

### Query 1: which tables have RLS enabled?

```sql
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY rls_enabled, c.relname;
```

If any Tier-3 table from Section 2 returns `rls_enabled = false`, that's a P0 finding - rows leak to anyone with the anon key.

### Query 2: count of policies per table

```sql
SELECT
  c.relname AS table_name,
  count(p.polname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
GROUP BY c.relname
ORDER BY policy_count, c.relname;
```

For Tier-2 tables: confirms whether dashboard policies exist (count > 0) or if the table is truly policy-less (count = 0 = nothing readable since RLS is on).

### Query 3: full per-table policy dump

```sql
SELECT
  c.relname AS table_name,
  p.polname AS policy_name,
  p.polcmd AS command,  -- 'r' = SELECT, 'a' = INSERT, 'w' = UPDATE, 'd' = DELETE, '*' = ALL
  pg_get_expr(p.polqual, p.polrelid) AS using_expr,
  pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname, p.polname;
```

Use this to extract dashboard-only policies into SQL files for the Tier-2 fill-in work.

---

## 4. Recommended remediation order

Run Section 3 queries first. THEN:

### Phase RL1: verify Tier-3 RLS state (Xero) - DONE 2026-05-20

Query 1 ran 2026-05-20. **All 10 Tier-3 tables returned `rls_enabled = true`.** No P0. No live exposure.

Remaining (downgraded to documentation, no urgency): add the missing `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;` statements to a dated `sql/` file for reproducibility, so a fresh DB rebuild reproduces the live RLS-on state. No live change (the statements are no-ops against prod where RLS is already on). Hunt-and-peck folds this into the canonical-DDL work for the 15 orphan tables (R12 / pre-launch audit) - same reverse-engineering pattern.

### Phase RL2: extract Tier-2 dashboard policies into `sql/` (~3-5 sessions)

For each Tier-2 table, run Query 3 + write the policies to a new `sql/<table>-policies-2026-05-20.sql` file. Apply to live as `DROP POLICY IF EXISTS ... CREATE POLICY ...` (idempotent re-creation).

Order: load-bearing tables first (`chat_messages`, `modules`, then the rest).

### Phase RL3: Tier-4 decisions (Xero, ~30 min)

Per the table in Section 2 Tier 4. For each:
- Decide intent (dev-only? prod-readable? prod-insert-only?).
- Add minimal RLS policy.
- Commit to `sql/`.

### Phase RL4: ongoing - prevent regression

Add a guardrail OR convention: every new table added to `sql/` MUST include both `ENABLE ROW LEVEL SECURITY` and at least one `CREATE POLICY`. The migration discipline doc (R10) covers naming + idempotency; extend it to require RLS coverage for new tables.

---

## 5. Risks

### RL-R1: Tier-3 tables may have RLS off in prod

The biggest risk this audit surfaces. If any of the 10 Tier-3 tables has `rls_enabled = false`, every row leaks to anyone with the anon key (which is publicly visible per `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

**Mitigation:** Phase RL1 verification is P0. Don't defer.

### RL-R2: dashboard policy extraction may introduce duplicates

When extracting Tier-2 policies, the generated SQL needs `DROP POLICY IF EXISTS ... CREATE POLICY` idempotent shape. Without the DROP, re-applying creates a second copy of the policy with the same expression (Postgres allows multiple-OR policies, but the audit log spec's `pg_policy` query would show duplicates).

**Mitigation:** every extraction starts with `DROP POLICY IF EXISTS "<exact-name>" ON public.<table>;`. The R10 migration-discipline doc covers this convention.

### RL-R3: extraction may strip dashboard-side comments

Dashboard-edited policies sometimes have implicit context that's lost when extracted as raw SQL. Annotate each extracted policy with a `--` comment explaining intent.

### RL-R4: audit ran from a single snapshot

This audit was 2026-05-20 at one moment. New tables added after this audit + dashboard policy changes since are NOT reflected.

**Mitigation:** re-run Sections 2 + 3 quarterly OR after every multi-table migration.

---

## 6. What this audit does NOT cover

- **Per-policy correctness.** Even if RLS is on + a policy exists, the policy might be WRONG (e.g., `USING (true)` is RLS-enabled but lets everyone read). Per-policy review is a separate, deeper audit.
- **`storage.objects` policies.** Covered separately by `tasks/audit-storage-bucket-policies-2026-05-20.md` (A5.2).
- **Edge function bypass.** Edge functions use service-role keys that bypass RLS entirely. RLS is the back-stop for client-driven access; edge functions need their own authorization checks at the function entry.
- **`auth.users` policies.** Managed by Supabase Auth; not in scope.
- **Indexes for RLS performance.** A correct policy on a large table can still be slow without supporting indexes. Performance-tier work; out of scope for this security audit.

---

## 7. Maintenance

Update this audit when:
- A new table is added to `sql/` - re-run the per-table grep + update Section 2.
- A Tier-3 verification completes - move the table to Tier 1 with a date.
- A Tier-2 extraction completes - update the table's row.
- Quarterly re-audit OR after every multi-table migration.

Archive when: every table is in Tier 1 (full repo coverage) AND the grep methodology in Section 1 returns zero gaps.
