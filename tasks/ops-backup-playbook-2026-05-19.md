# Backup & Restore Playbook

Closes Pre-Launch Audit item **Y12**. Documents what Supabase provides at our current plan tier, what to do when something goes wrong, and the drill we owe ourselves before paid signups open.

Pairs with the soft-delete stance doc at [tasks/ops-soft-delete-stance-2026-05-19.md](ops-soft-delete-stance-2026-05-19.md). Everything that hard-deletes lands here for recovery.

---

## TL;DR (the part Xero reads at 2am during an incident)

1. **A whole campaign is gone.** First try restoring a snapshot from the GM's `CampaignSnapshots` UI (in-app, no Supabase login needed). If no snapshot exists, see "Supabase PITR" below.
2. **A single character is gone.** No in-app recovery. Supabase PITR or accept the loss.
3. **All data is gone (entire project).** Supabase dashboard -> Database -> Backups. Pro tier required. We are not there yet.
4. **A user wants their data back after account deletion.** Not possible. `delete-user` edge function is irreversible by design (GDPR).

If the recovery requires Supabase PITR and we're on the free tier, the answer is: **we can't recover.** Plan accordingly.

---

## What Supabase provides

| Plan | Daily backup | PITR (point-in-time restore) | Retention | Cost |
|---|---|---|---|---|
| Free (current) | NONE | NONE | n/a | $0 |
| Pro | Daily | Up to 7 days back (paid add-on) | 7 days | $25/mo base + $100/mo PITR add-on |
| Team | Daily | Up to 14 days back | 14 days | $599/mo |

**Today's exposure:** Tapestry runs on the free tier. If the database is corrupted, dropped, or a runaway query wipes data, **we have no Supabase-side recovery.** Plan to upgrade to Pro + the PITR add-on before paid signups open. Tracked in [tasks/scaling-plan-tier-abc.md](scaling-plan-tier-abc.md) under "Supabase Pro upgrade."

---

## In-app recovery: campaign snapshots

`lib/campaign-snapshot.ts` provides a per-campaign save / restore mechanism that runs in the GM's browser. Snapshots are JSON blobs stored in the `campaign_snapshots` table; restoring wipes the campaign's content rows and reinserts from the snapshot.

**Captures:** `campaign_npcs`, `campaign_pins`, `tactical_scenes`, `scene_tokens` (nested under scenes), `campaign_notes`, `campaigns.vehicles` JSONB, pregens (`characters` where `type='pregen'`), optionally `character_states`.

**Does NOT capture:** `initiative_order`, `roll_log`, `chat_messages` (session-scope; cleared on restore), and the community subsystem (six tables, pending - see snapshot.ts header comment).

**Recovery flow (from the GM side, no Supabase login required):**
1. GM opens the campaign's settings -> Snapshots tab.
2. Pick the snapshot to restore (timestamp + description visible).
3. Confirm. Restore wipes current campaign content rows and reinserts.
4. **Live + irreversible.** No undo; restoring a snapshot is itself destructive.

**Operational limits:**
- Snapshots are user-initiated. If the GM never took one, there's nothing to restore from.
- A restore that fails partway leaves the campaign in a wiped state (the DELETE already happened). Re-run the restore or restore from an earlier snapshot. Documented at `lib/campaign-snapshot.ts:25-29`.
- Cross-account restore (Thriver restoring another GM's snapshot to that GM's campaign) is supported but adds an audit row.

---

## Recovery scenarios

### Scenario A: GM accidentally hard-deleted a character / NPC / pin

**Recovery path:**
1. Check if the GM has a recent campaign snapshot. If yes, restore from that snapshot (it'll wipe everything else added since, but recovers the deleted row).
2. If no snapshot, the row is gone. On free tier, no further recovery. On Pro+PITR, see Scenario C.

**Detection:** the player or GM noticing. There's no audit log of deletes.

### Scenario B: GM accidentally deleted an entire campaign

**Recovery path:**
1. The campaign row's CASCADE will have wiped everything by `campaign_id`. Snapshots in `campaign_snapshots` are themselves CASCADEd, so the in-app snapshot recovery does NOT work here.
2. On Pro+PITR, restore the whole project to a point before the delete and re-export the affected tables. **This is a destructive operation for everyone else** - it rolls back ALL data project-wide. Coordinate with Xero before doing this.
3. On free tier, the campaign is gone.

**Mitigation:** the GM-side "Delete campaign" button needs a strong-confirm (type DELETE) gate. Currently a single confirm. Flagged as an open policy question in the soft-delete stance doc. Today's recovery is "ask the GM if it was important enough to upgrade to Pro+PITR for one restore."

### Scenario C: Database-wide corruption / wipe (worst case)

**Recovery path (Pro+PITR only):**
1. Supabase dashboard -> project -> Database -> Backups.
2. Select a restore point (granular to ~1 minute on PITR).
3. Restore creates a NEW Supabase project at that state. Original project is NOT modified.
4. Switch the Vercel `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars to the restored project. Redeploy.
5. Test with `/api/health`.
6. Communicate the rollback window to all affected users.

**Recovery time objective:** ~2-4 hours from incident to live-on-restored-project, assuming we've drilled it.

**Free tier:** the answer is "we can't recover the whole project." If this scenario lands before we're on Pro, we lose everything. **This is the strongest argument for upgrading before paid signups.**

### Scenario D: A user demands their deleted account's data back

**Recovery path:** none.

The `delete-user` edge function hard-deletes everything owned by the user across all tables + storage by design. This is the right behavior for GDPR right-to-erasure. If a user changes their mind after delete, the answer is "we cannot recover this; you may create a new account."

This needs to be documented in the public TOS / Privacy Policy before paid signups (bright line per operating-mode.md).

### Scenario E: A storage bucket file is deleted (uploaded image, attachment)

**Recovery path:** none today. Storage objects are not part of PITR (database-only).

**Mitigation:** the upload pipeline now uses `lib/safe-upload.ts` (2026-05-19) which doesn't prevent loss but does mean bad uploads are rejected at the gate. Lossy operations on storage (the GmNotes `remove()` calls, the `delete-user` storage sweep) are intentional. No recovery story; accept the loss.

---

## Drill plan

We owe ourselves one end-to-end drill before paid signups. Listed in [tasks/scaling-plan-tier-abc.md](scaling-plan-tier-abc.md) under "Backup restore drill". Concrete steps:

1. **Provision a fresh Supabase project on the Pro plan (paid for one cycle then cancel).** Or use a throwaway project. ~30 min.
2. **Restore from a recent PITR point.** Document each click. Time the restore wall-clock. ~30 min.
3. **Point a throwaway Vercel deployment at the restored project.** ~15 min env-var swap + redeploy.
4. **Smoke-test:** sign up, create a campaign, add a character, run a roll, log out, log back in. ~15 min.
5. **Write the gotchas back into this doc.** Any unexpected step, env var, or RLS issue gets documented.

Total: ~2 hours. Do this drill BEFORE the upgrade is needed, not after.

---

## Open questions for Xero

1. **When to upgrade to Pro+PITR.** Today: free tier, no PITR. Recommended trigger: as soon as the first paying signup is imminent, OR when uptime starts mattering to the playtester group, whichever comes first.
2. **Daily-snapshot encouragement / automation.** Should we nudge GMs to take a snapshot at start of each session? Or auto-snapshot pre-session? Currently snapshots are entirely GM-initiated and ad-hoc.
3. **Snapshot expiration.** Snapshots live forever in `campaign_snapshots` and bloat the table. Add a "delete snapshots older than 30 days" routine? Today: no expiration.
4. **Cross-snapshot communities scope.** Per the snapshot.ts header comment, communities are NOT in snapshots. If a community wipe happens, recovery is PITR-only.

---

## What's NOT in scope

- Disaster recovery for Vercel itself. If Vercel is down, our app is down. Mitigation: Vercel SLA is the SLA. No multi-region deploy planned.
- Email/notification re-send. If we lose the notification queue, sent emails stay sent. Lost in-app notifications are accepted as transient.
- Sentry data recovery. Sentry has its own retention; we don't back it up.

---

## Maintenance notes

Update this doc when:
- We upgrade Supabase plans (the retention table changes).
- We complete the drill (move concrete numbers from "~2-4 hours" to actual measured times).
- Any open question gets a Xero ruling.
- A real incident teaches us a step we missed.

Last full audit: 2026-05-19 (initial draft, no drill executed yet). Re-audit after the drill + every 6 months thereafter; or when Y12 in the pre-launch punch list reopens.
