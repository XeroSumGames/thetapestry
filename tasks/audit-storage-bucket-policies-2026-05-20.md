# Audit: Storage Bucket Policies

Closes Phase P4 / A5.2 of `tasks/puffer-fish-platform-plan.md`. Surveys the Supabase Storage bucket inventory, application-layer enforcement, SQL-tracked policies, and gaps between the application contract + dashboard reality.

**Audience:** the hunt-and-peck chat (to write the missing SQL policies) + Xero (to verify dashboard policies match the audit recommendations).

**Status:** AUDIT 2026-05-20. Recommendations only; no SQL shipped.

---

## 1. Bucket inventory

Cross-referencing `lib/safe-upload.ts` BUCKETS + `sql/` SQL-tracked policies + reported usage in code.

| Bucket | App-layer enforcement | SQL-tracked policy | Gap |
|---|---|---|---|
| `session-attachments` | Yes (`lib/safe-upload.ts:27`, attachment whitelist, 10 MB cap) | **None in `sql/`** | Dashboard-only policy; unreproducible |
| `note-attachments` | Yes (attachment whitelist, 10 MB cap) | **None in `sql/`** | Same |
| `pin-attachments` | Yes (image-only whitelist, 10 MB cap) | **None in `sql/`** | Same |
| `war-stories` | Yes (image-only whitelist, 10 MB cap) | **None in `sql/`** | Same |
| `module-covers` | Yes (image-only whitelist, 5 MB cap) | `sql/module-covers-bucket.sql` | Policy is LAX (any authenticated user can write any cover) |
| `character-portraits` | Implicit at the upload site (folder = `<user_id>`) | `sql/character-portraits-bucket.sql` | Policy is TIGHT (folder-based RLS scoping) - exemplar |
| `object-tokens` | Yes (`components/CampaignObjects.tsx:278`, image blob upload) | **None in `sql/`** | Same as the 4 application-layer attachments |

---

## 2. Findings

### Finding 1: 5 of 7 buckets have NO SQL-tracked policies

The application-layer `lib/safe-upload.ts` enforces filename sanitization, size caps, and MIME whitelisting at WRITE time. That's the gate at the front door.

**BUT** the Supabase Storage RLS policies (configured per-bucket in the dashboard) are the back-stop. They control:
- Who can read the bucket (anon? authenticated only? specific role?)
- Who can write to a given path (any authenticated user? only the path-prefix owner?)
- Whether DELETE is allowed.

For the 5 application-only buckets, those policies exist ONLY in the dashboard. Anyone with a fresh Supabase project can't reproduce the live state from the repo.

**Consequence:**
- Disaster recovery (per Y12 backup playbook Scenario C) requires re-establishing storage policies manually.
- A junior or future contributor cannot see the policies without dashboard access.
- A policy drift in the dashboard goes unnoticed until something breaks.

### Finding 2: module-covers bucket policy is LAX

Per `sql/module-covers-bucket.sql:23-37`:
```sql
CREATE POLICY "Authors upload module covers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'module-covers');
```

There's NO folder-scoped check. **Any authenticated user can upload to any path in `module-covers`.** A bad actor could:
- Upload a cover at `<other-author's-module-id>/<timestamp>.jpg`, effectively replacing someone else's cover (since cover paths are author-controlled).
- Spam-upload to consume Storage quota.

The application code at `app/rumors/[id]/edit/page.tsx:199` only allows the module's author to call the upload (per RLS on `modules` table). But if an attacker bypasses the app (direct supabase-js call from a browser console with their own auth token), the storage RLS lets them through.

**Compare to `sql/character-portraits-bucket.sql:33-37`:**
```sql
CREATE POLICY "Character portraits insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'character-portraits'
    AND (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
    )
  );
```

The character-portraits policy uses `storage.foldername(...)` to enforce that the upload's first path segment matches the uploader's user_id. **This is the pattern the other buckets should follow.**

### Finding 3: bucket `public` flag varies

- `module-covers` and `character-portraits` are explicitly `public = true` (per the SQL files).
- The 5 application-layer buckets' public flags are unknown without dashboard inspection.

If any of them is `public = true`, ALL uploads are world-readable by URL. War stories may want this (cross-campaign visibility). Session attachments probably should NOT (GM private notes + uploaded files for a specific session).

---

## 3. Recommended SQL policies per bucket

For the 5 buckets missing SQL-tracked policies, here's the recommended shape. Hunt-and-peck applies these as new SQL files in `sql/` per the migration-discipline doc (R10) + applies to live via `npx supabase db query`.

### `session-attachments`

**Intent:** session attachments are GM-uploaded files visible to campaign members for the session in question.
- **Public?** No. Authenticated campaign members only.
- **Path shape:** `<session_id>/<filename>` (per `app/stories/[id]/table/page.tsx:3518`).
- **Read scope:** campaign members of the session's campaign.
- **Write scope:** GM of the session.
- **Delete scope:** GM of the session.

```sql
INSERT INTO storage.buckets (id, name, public)
  VALUES ('session-attachments', 'session-attachments', false)
  ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "session-attachments read" ON storage.objects;
CREATE POLICY "session-attachments read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'session-attachments'
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.campaign_members cm ON cm.campaign_id = s.campaign_id
      WHERE s.id::text = (storage.foldername(storage.objects.name))[1]
        AND cm.user_id = auth.uid()
    )
  );

-- Plus similar INSERT / UPDATE / DELETE policies gated on GM-of-the-campaign.
```

### `note-attachments`

**Intent:** attachments on `campaign_notes` rows (GM Notes). GM-only.
- **Public?** No.
- **Path shape:** `<campaign_id>/<note_id>/<timestamp>-<filename>`.
- **Read scope:** GM of the campaign (Notes are GM-only by design).
- **Write/Delete scope:** same GM.

### `pin-attachments`

**Intent:** images attached to map pins. GM-uploaded; visible to campaign members.
- **Public?** Depends - pins can be revealed or hidden. **Currently:** public read makes sense (pin contents are GM-published).
- **Path shape:** `<campaign_id>/<pin_id>/<filename>` OR `<user_id>/<pin_id>/<filename>` (varies by call site, per `components/CampaignMap.tsx:760` vs `components/MapView.tsx:978`).
- **Read scope:** campaign members for campaign-pins; anyone for personal-pins.
- **Write scope:** GM (campaign-pins) or owner (personal-pins).

**Path shape inconsistency is itself a finding.** The two MapView/CampaignMap upload sites use different folder roots. Should be reconciled.

### `war-stories`

**Intent:** images embedded in `war_stories` rows. Cross-campaign visibility (per the `war_stories` table's public-ish RLS).
- **Public?** Yes - war stories are intentionally cross-campaign + cross-user visible to authenticated users.
- **Path shape:** `<author_user_id>/<story_id>/<filename>` (per `app/campfire/war-stories/page.tsx:410`).
- **Read scope:** any authenticated user.
- **Write scope:** the story's author (folder-scoped to `auth.uid()`).
- **Delete scope:** same.

### `object-tokens`

**Intent:** map-token icons uploaded for campaign objects.
- **Public?** Yes (rendered on the tactical map).
- **Path shape:** TBD (check `components/CampaignObjects.tsx:278`).
- **Read scope:** authenticated.
- **Write scope:** GM of the campaign that owns the object.

---

## 4. module-covers tightening

Update `sql/module-covers-bucket.sql` to add folder-scoped INSERT/UPDATE/DELETE:

```sql
DROP POLICY IF EXISTS "Authors upload module covers" ON storage.objects;
CREATE POLICY "Authors upload module covers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'module-covers'
    AND (
      -- First path segment is the module_id; verify the auth.uid()
      -- is the module's author OR a Thriver.
      EXISTS (
        SELECT 1 FROM public.modules m
        WHERE m.id::text = (storage.foldername(storage.objects.name))[1]
          AND (m.author_user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver'))
      )
    )
  );

-- Same pattern for UPDATE + DELETE.
```

This closes Finding 2.

---

## 5. Verification queries (for Xero to run against dashboard / live)

Before applying any of the recommended policies, Xero should verify the CURRENT state via the Supabase dashboard. The audit's recommendations are based on inferred intent; live policies may differ.

For each of the 7 buckets:

1. **Dashboard:** Storage -> the bucket -> Configuration. Note: `public` flag, file-size limit (if set), MIME-type restrictions (if set).
2. **SQL:** run in Supabase SQL editor:
   ```sql
   SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
          pg_get_expr(polwithcheck, polrelid) AS check_expr
   FROM pg_policy
   WHERE polrelid = 'storage.objects'::regclass
   ORDER BY polname;
   ```
   This returns every RLS policy on `storage.objects` (which gates all bucket access).
3. **Compare against recommended policy.** If lax: apply tighter version. If matches: no change.

Paste outputs into the audit follow-up:

```
Bucket: <name>
  public: <true/false>
  size_limit_mb: <N or unset>
  mime_types: <list or unset>
  policies: <count>; tight enough? <yes/no>
```

---

## 6. Migration plan

### Phase BP1: Verification pass (Xero, ~30 min)

Run the SQL query from Section 5 + walk the dashboard for each bucket. Document findings.

**Gate:** every bucket has a known public-flag + policy count.

### Phase BP2: Apply tightened module-covers policy

Single small SQL file: `sql/module-covers-tighten-2026-05-20.sql` per Section 4. Apply to live. Verify a cover upload still works from the module-edit page.

**Gate:** module cover upload + read still works; an unauthorized auth.uid() attempting to upload to a non-author module gets RLS-denied.

### Phase BP3: Add SQL policies for the 5 missing buckets

One file per bucket. Apply each independently. Verify the upload path still works after each.

Order (smallest blast radius first):
1. `object-tokens` (smallest user base, GM-only writes)
2. `pin-attachments` (small, but two call sites need path-shape reconciliation first)
3. `note-attachments` (GM-only)
4. `session-attachments` (campaign-member reads, GM writes)
5. `war-stories` (cross-campaign reads, author writes)

**Gate per bucket:** upload + read flows still work; an unauthorized auth.uid() gets denied.

### Phase BP4: Reconcile pin-attachments path shapes

`components/CampaignMap.tsx:760` uses `<campaign_id>/...`; `components/MapView.tsx:978` uses `<user_id>/...`. The RLS policy can't be both. Pick one (recommend `<campaign_id>/...` since pins are campaign-scoped). Update the MapView site to match. Then apply the policy.

**Gate:** existing pin attachments still load (per the path of files already in the bucket).

### Phase BP5: Consider dashboard-level MIME whitelist

Supabase dashboard exposes a per-bucket MIME-type filter. Mirror the `lib/safe-upload.ts` allowed-types whitelist there too. Defense-in-depth: if a client bypasses the helper, the dashboard policy stops the upload before it lands.

---

## 7. Risks

### BP-R1: applying tight policies breaks existing uploads if path shapes don't match

The character-portraits exemplar uses `storage.foldername(name)[1] = auth.uid()::text`. If the bucket's existing files have a different path shape, the new policy silently denies their reads/writes.

**Mitigation:** Phase BP1 verification confirms path shape BEFORE the policy. Phase BP4 reconciliation for any inconsistencies.

### BP-R2: tightening module-covers could lock out existing module authors

If the existing path shape is `<module_id>/<timestamp>.jpg` (per `app/rumors/[id]/edit/page.tsx:196`), the recommended policy's `(storage.foldername(name))[1] = module_id` works. But if any historical upload used a different shape (e.g., a Thriver uploaded via a tool with a different path), those covers may become unreadable.

**Mitigation:** before applying, query `storage.objects` to see existing path shapes:
```sql
SELECT DISTINCT (storage.foldername(name))[1] AS first_seg, count(*)
FROM storage.objects
WHERE bucket_id = 'module-covers'
GROUP BY first_seg;
```

### BP-R3: war-stories cross-campaign visibility

War stories are intentionally cross-campaign-readable. If the recommended policy gates reads on campaign membership, cross-campaign discovery breaks.

**Mitigation:** war-stories read is `authenticated` only, not campaign-member-scoped. The recommended policy in Section 3 is correct on this.

### BP-R4: object-tokens may have anon read

If the tactical map renders for anon users (which it doesn't today; players must auth), `object-tokens` could be public-read. Current policy: authenticated-read should be fine.

**Mitigation:** verify in Phase BP1.

---

## 8. What this audit does NOT propose

- **Migrating away from Supabase Storage:** the current setup works; no alternative needed.
- **Per-file ACLs (signed URLs):** more flexible but more complex. Current bucket-level RLS is sufficient.
- **Storage cost monitoring:** not in scope. If storage growth becomes a concern, separate audit.
- **CDN in front of Storage:** Supabase already CDN-caches. No additional layer needed at alpha tier.

---

## 9. Maintenance

Update this audit when:
- A new bucket is added: append to Section 1's table + write the SQL policy.
- A path shape in any bucket changes: re-verify RLS still works.
- Supabase introduces new bucket-level config options (rate limits, hot/cold storage tiers): re-evaluate.
- A storage-related incident surfaces a gap: document the lesson + update.

Re-audit annually OR when a new bucket type is needed.
