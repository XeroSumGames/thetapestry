# Spec: Audit Log for Destructive Operations

Closes Phase P3 / A4.3 of `tasks/puffer-fish-platform-plan.md`. Spec for an application-level audit log capturing destructive operations (DELETE, UPDATE-with-data-loss, bulk operations) so recovery is possible without PITR.

**Audience:** the hunt-and-peck chat that will execute. Puffer-fish wrote this; puffer-fish maintains the spec.

**Status:** SPEC. No code shipped yet. Pairs with [tasks/ops-soft-delete-stance-2026-05-19.md](ops-soft-delete-stance-2026-05-19.md) (which tables soft-delete vs hard-delete) and [tasks/ops-backup-playbook-2026-05-19.md](ops-backup-playbook-2026-05-19.md) (recovery scenarios).

---

## 1. Why this matters now

Per [tasks/launch-plan-2026-06-15.md](launch-plan-2026-06-15.md) status log (2026-05-20), Xero opted to defer Supabase Pro + PITR as long as possible. The backup playbook documents that without PITR, Scenarios A/B/C (single row recovery / full campaign recovery / db-wide recovery) all collapse to "we lose data."

An application-level audit log doesn't replace PITR (it can't recover from db-wide corruption, doesn't capture schema changes, has its own dependencies). But it DOES enable:

- **Single-row recovery** for accidentally-deleted rows: read the audit row's `before_state` JSON, re-INSERT.
- **Diff-of-change** investigation: "what was this row before X happened?"
- **Compliance posture:** "we have an audit trail" is a paid-tier table-stakes claim.
- **Multi-user incident forensics:** if a user reports "someone changed my X," the audit log shows when + by whom.

Cost: a write-amplification (every destructive op adds a second row to a different table) + storage growth on the audit table. Both are acceptable at alpha + early-paid scale.

---

## 2. The canonical shape

A single new table: `audit_log`. Append-only, never UPDATEd, retention-policy controlled.

```sql
CREATE TABLE IF NOT EXISTS public.audit_log (
  id                  bigserial PRIMARY KEY,
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  actor_user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role          text,           -- 'thriver' | 'survivor' | 'ghost' | 'system' (denormalized snapshot)
  campaign_id         uuid,           -- nullable for non-campaign-scoped ops (account deletion, etc.)
  table_name          text NOT NULL,
  row_id              text NOT NULL,  -- text not uuid because some tables use composite keys
  operation           text NOT NULL CHECK (operation IN ('DELETE', 'BULK_DELETE', 'CRITICAL_UPDATE', 'CASCADE_DELETE')),
  before_state        jsonb,          -- the row's state pre-op; NULL if not captured
  after_state         jsonb,          -- the row's state post-op for UPDATE; NULL for DELETE
  reason              text,           -- optional GM-supplied or system-supplied context
  client_ip           text,           -- captured from x-forwarded-for at write time
  user_agent          text,
  recovery_attempted  boolean DEFAULT false,
  recovered_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_audit_log_occurred_at ON public.audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id ON public.audit_log (actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_campaign_id ON public.audit_log (campaign_id, occurred_at DESC) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_table_row ON public.audit_log (table_name, row_id, occurred_at DESC);

-- RLS: Thrivers read everything; users read their own actor_user_id rows; nothing else readable.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_thriver_read" ON public.audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'thriver'));
CREATE POLICY "audit_log_self_read" ON public.audit_log FOR SELECT
  USING (actor_user_id = auth.uid());

-- No INSERT / UPDATE / DELETE policies = nobody writes via the client.
-- All writes go through the trigger functions OR the service-role-key edge functions.
```

### Field rationale

- `actor_role` is a SNAPSHOT at write time, not a JOIN. Roles can change after the audit row is written; the audit needs to capture who-was-what when the op happened.
- `before_state` is the ENTIRE pre-op row as JSON. Storage cost > recovery utility tradeoff: yes. Without `before_state`, the audit row tells you WHAT happened but not HOW TO UNDO it.
- `recovery_attempted` + `recovered_at` are operational metadata - did we already use this audit row for recovery? Prevents double-recovery on the same incident.
- `client_ip` + `user_agent` are forensic-grade: helps distinguish "user deleted from their phone" from "someone else used their session."

---

## 3. What gets logged

Three categories. Trigger-driven where possible (DB-level enforcement); application-level for the cases triggers can't see.

### 3.1 Trigger-driven (recommended for these tables)

Add `BEFORE DELETE` triggers to:

- `characters` - PC delete
- `character_states` - CASCADEs from characters
- `campaigns` - GM campaign delete
- `campaign_members` - leave / kick
- `campaign_npcs` - GM NPC remove
- `campaign_pins`
- `campaign_notes`
- `tactical_scenes`
- `scene_tokens` (DELETE only, not soft-archive)
- `community_members` (DELETE only, not soft-leave)
- `community_stockpile_items`
- `world_communities`
- `forum_threads`
- `war_stories`
- `lfg_posts`
- `module_reviews`
- `modules` (hard-delete; archived ones don't trigger)
- `roll_log` (only the session-clear bulk delete on session-start; tag as `BULK_DELETE`)
- `chat_messages` (same)

Trigger function shape:

```sql
CREATE OR REPLACE FUNCTION audit_log_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  INSERT INTO audit_log (
    actor_user_id, actor_role, campaign_id, table_name, row_id,
    operation, before_state
  ) VALUES (
    auth.uid(),
    v_role,
    -- campaign_id extraction varies by table; use a column lookup
    CASE WHEN TG_TABLE_NAME IN ('characters') THEN NULL
         WHEN TG_TABLE_NAME = 'campaigns' THEN OLD.id
         ELSE OLD.campaign_id::uuid
    END,
    TG_TABLE_NAME,
    OLD.id::text,
    'DELETE',
    to_jsonb(OLD)
  );
  RETURN OLD;
END;
$$;

CREATE TRIGGER audit_delete_characters BEFORE DELETE ON characters
  FOR EACH ROW EXECUTE FUNCTION audit_log_on_delete();
-- Repeat for each table.
```

Trigger pros:
- Captures EVERY delete regardless of code path.
- `to_jsonb(OLD)` captures the whole row automatically.
- DB-level enforcement; impossible to bypass from the client.

Trigger cons:
- CASCADE deletes can fire MANY trigger rows; on a campaign delete you'd get hundreds of audit rows.
- `auth.uid()` may be null for system-driven deletes (cron jobs, edge functions).

### 3.2 Application-level (for trigger-blind cases)

Some destructive ops happen via paths triggers can't see or can't classify:

- **Edge functions** (`delete-user`, `notify-thriver`) - these run with service-role auth; `auth.uid()` returns NULL. App-level audit at the function entrypoint.
- **Bulk operations** (Restore from snapshot wipes campaign_npcs/pins/scenes/notes) - want to log the BULK_DELETE as one row, not N rows.
- **Critical UPDATEs that overwrite data** (e.g., `restoreCampaignFromSnapshot`) - app-level log of the snapshot ID + the wipe scope.

App-level shape:

```ts
// lib/audit-log.ts (NEW FILE)
export async function logAuditEvent(
  supabase: SupabaseClient,
  args: {
    operation: 'DELETE' | 'BULK_DELETE' | 'CRITICAL_UPDATE' | 'CASCADE_DELETE'
    table_name: string
    row_id: string
    campaign_id?: string
    before_state?: any
    after_state?: any
    reason?: string
  }
): Promise<void> {
  // Best-effort. Failure to log MUST NOT block the actual operation;
  // we'd rather have the data change without an audit row than block
  // the change because logging failed.
  try {
    await supabase.from('audit_log').insert(args)
  } catch (err) {
    console.warn('[audit-log] failed to log:', err)
  }
}
```

### 3.3 Not logged (deliberately)

- Single-character UPDATEs (HP changes, stress increments, etc.). Too noisy; PITR-tier recovery for these.
- Session-scope writes (`roll_log` row inserts, `chat_messages`). Captured by the session itself.
- Reads. The audit log is for destructive ops only.

---

## 4. Retention policy

Without PITR, the audit log IS the recovery tool. Retention drives recovery window.

Recommended:
- **Default: 365 days.** Long enough that "I deleted X last quarter" recoveries work.
- **Rotation: hard delete rows older than 365 days via a scheduled job.**
- **Storage budget:** at 1000 destructive ops/day x 1KB avg row = 1MB/day = 365MB/year. Negligible.

Rotation script:

```sql
-- Run via scheduled job or cron-driven RPC. Idempotent.
DELETE FROM audit_log WHERE occurred_at < now() - INTERVAL '365 days';
```

If Pro+PITR is later added (per A4.1), retention can extend to longer windows OR the audit log becomes the secondary recovery tool with PITR as primary.

---

## 5. Recovery from an audit row

Given an audit row pointing to a specific delete:

```sql
-- Identify the row.
SELECT id, table_name, row_id, before_state, occurred_at
FROM audit_log
WHERE table_name = 'campaign_npcs'
  AND row_id = '<id-the-user-claims-was-deleted>'
ORDER BY occurred_at DESC
LIMIT 1;

-- Restore the row.
-- Build the INSERT from before_state JSON:
INSERT INTO campaign_npcs (id, campaign_id, name, ...)
SELECT * FROM jsonb_populate_record(NULL::campaign_npcs, '<before_state json>');

-- Mark the audit row recovered.
UPDATE audit_log
SET recovery_attempted = true, recovered_at = now()
WHERE id = <audit_log_id>;
```

The recovery flow happens manually via the SQL editor (no UI for it). Add to the incident response runbook as a documented procedure.

### Caveats

- **Foreign key dependencies:** if the deleted row had FKs to other rows that were ALSO deleted (CASCADE), each one needs recovery in the right order. The `campaign_id` index helps query the cascade scope.
- **Schema changes since the delete:** if columns were added or removed, `jsonb_populate_record` skips unknown keys + uses defaults for missing ones. Verify the recovered row makes semantic sense.
- **Stale references:** if the deleted row referenced something else that's now gone (e.g., a character whose user account was deleted), the INSERT may fail FK constraints. Patch case-by-case.

---

## 6. Migration plan

Phased so each step is verifiable. Hunt-and-peck owns execution.

### Phase AL1: Create the table + indexes + RLS

1. SQL migration `sql/audit-log-table-YYYY-MM-DD.sql` per the schema in Section 2.
2. Apply to live via `npx supabase db query --linked -f sql/...`.
3. **Verify:** `SELECT count(*) FROM audit_log` returns 0; RLS policies present per `pg_policies`.

**Gate:** SQL applies cleanly. No writes happen yet (no triggers, no app calls).

### Phase AL2: Trigger function + apply to high-stakes tables

Highest-stakes tables first (data loss = high user pain):

1. `audit_log_on_delete()` function per Section 3.1.
2. Triggers on `campaigns`, `characters`, `campaign_npcs`, `campaign_members`. (5 tables.)
3. **Verify:** delete a test character on a test campaign; check `audit_log` for the row.

**Gate:** test deletes produce audit rows.

### Phase AL3: Triggers on remaining hard-delete tables

Per Section 3.1's full list minus AL2's set.

### Phase AL4: App-level logging at edge functions + bulk ops

1. `lib/audit-log.ts` per Section 3.2.
2. Wire into `delete-user` edge function (the largest single audit event).
3. Wire into `restoreCampaignFromSnapshot` (the bulk-wipe event).

### Phase AL5: Recovery UI (optional)

A `/moderate/audit-log` page for Thrivers: filter by user / campaign / table / date, recover row.

This is hunt-and-peck UI work; spec it as a follow-up if/when a Thriver actually needs recovery.

### Phase AL6: Retention cron

Schedule the 365-day deletion via the existing scheduled-task infra (per memory `reference_health_pulse_routine` shape). Or skip if storage growth is acceptable.

---

## 7. Tests

- Trigger tests (PL/pgSQL): delete a row, query the audit log, assert the row.
- App-level helper tests: mock supabase client, assert insert called.
- Recovery flow tests: insert audit row, run recovery SQL, assert original row restored.

These are integration-tier tests; the unit-test ladder (Phase P7) probably needs to grow first.

---

## 8. Risk register

### AL-R1: CASCADE delete write-amplification

A campaign delete CASCADEs to ~10 tables. With audit triggers, that's ~10 trigger fires per CASCADE step. A 100-NPC campaign delete = 100+ audit rows.

**Mitigation:** acceptable cost at alpha scale. If storage growth becomes a problem at paid-tier scale, add a `CASCADE_DELETE` operation type that captures the parent + a count of children (not individual children).

### AL-R2: Trigger overhead on hot tables

`character_states` updates fire on every WP change, every stress increment, every initiative update. We're NOT triggering on UPDATE (only DELETE), so this is fine - but if the spec drifts to "log every update," reconsider.

**Mitigation:** the trigger is DELETE-only by design. Stay strict.

### AL-R3: `auth.uid()` is NULL for service-role contexts

Edge functions running with service-role auth: `auth.uid()` returns NULL inside the trigger. The audit row has `actor_user_id = NULL`.

**Mitigation:** acceptable. The app-level logging (Section 3.2) for edge functions populates `actor_user_id` explicitly from the caller-JWT-derived user.

### AL-R4: Recovery flow has no UI

Recoveries happen via SQL editor. Manual. Error-prone.

**Mitigation:** acceptable for alpha-tier (Xero is the only one running recoveries). When recovery is needed for a paying-tier user, prioritize the Phase AL5 UI.

### AL-R5: Audit log itself can be deleted

If a malicious Thriver wanted to cover tracks, they could DELETE from audit_log. RLS allows it because Thriver bypass.

**Mitigation:** restrict DELETE via explicit RLS:
```sql
CREATE POLICY "audit_log_no_delete" ON public.audit_log FOR DELETE USING (false);
```
Only the retention cron (running with service-role) can DELETE. Belt-and-suspenders: enforce in the trigger function that the audit_log table itself is never the source.

---

## 9. What this spec is NOT proposing

- **Replacement for Supabase PITR.** If db-wide corruption happens, the audit log is also corrupted. PITR is still the right fix when affordable.
- **Real-time auditing for every UPDATE.** Single-row UPDATEs (HP, stress, position changes) are noise; the audit log captures destructive ops only.
- **GDPR-grade right-to-erasure compliance documentation.** The audit log helps but doesn't replace a lawyer-reviewed RTE flow.
- **Compliance certification** (SOC 2, ISO 27001). Audit logs are a building block; full compliance is a year-long lawyer engagement.

---

## 10. Maintenance

Update this spec when:
- A new table is added that should be audited - add to the Section 3.1 list + create the trigger.
- A new destructive operation type emerges (e.g., bulk-archive) - extend the `operation` CHECK constraint.
- A recovery surfaces a gotcha - log under Section 8 risks.
- The retention policy changes - update Section 4.

When all 6 phases (AL1-AL6) ship + the spec has been exercised in at least one real recovery, archive to `tasks/spec-audit-log-destructive-ops-archived.md` with a postmortem.
